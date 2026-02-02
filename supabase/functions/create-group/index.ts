import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CreateGroupRequest {
  name: string;
  mainCurrencyCode: string;
  initialMembers: { name: string; email?: string }[];
}

interface GroupMember {
  id: string;
  groupId: string;
  name: string;
  email?: string;
  connectedUserId?: string;
  createdAt: string;
}

interface Group {
  id: string;
  name: string;
  mainCurrencyCode: string;
  createdAt: string;
  members: GroupMember[];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Create admin client with service role key (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validate user token
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { name, mainCurrencyCode, initialMembers }: CreateGroupRequest =
      await req.json();

    if (!name || !mainCurrencyCode) {
      return new Response(
        JSON.stringify({
          error: 'Missing required fields: name and mainCurrencyCode',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Get user profile from public.users table
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Failed to fetch user profile:', profileError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch user profile',
          details: profileError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // If user profile doesn't exist, create it
    let finalUserProfile = userProfile;
    if (!userProfile) {
      const { data: newProfile, error: createProfileError } =
        await supabaseAdmin
          .from('users')
          .insert({
            id: user.id,
            name: user.email?.split('@')[0] || 'User',
            email: user.email || null,
          })
          .select()
          .single();

      if (createProfileError) {
        console.error('Failed to create user profile:', createProfileError);
        return new Response(
          JSON.stringify({
            error: 'Failed to create user profile',
            details: createProfileError.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }
      finalUserProfile = newProfile;
    }

    // Create the group
    const { data: groupData, error: groupError } = await supabaseAdmin
      .from('groups')
      .insert({ name, main_currency_code: mainCurrencyCode })
      .select()
      .single();

    if (groupError) {
      console.error('Failed to create group:', groupError);
      return new Response(
        JSON.stringify({
          error: 'Failed to create group',
          details: groupError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const groupId = groupData.id;
    const members: GroupMember[] = [];

    // Add creator as the first member (using service role to bypass RLS)
    const { data: creatorMember, error: creatorError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: groupId,
        name: finalUserProfile.name,
        email: finalUserProfile.email || null,
        connected_user_id: user.id,
      })
      .select()
      .single();

    if (creatorError) {
      console.error('Failed to add creator as member:', creatorError);
      // Try to clean up the group
      await supabaseAdmin.from('groups').delete().eq('id', groupId);
      return new Response(
        JSON.stringify({
          error: 'Failed to add creator as group member',
          details: creatorError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    members.push({
      id: creatorMember.id,
      groupId: creatorMember.group_id,
      name: creatorMember.name,
      email: creatorMember.email || undefined,
      connectedUserId: creatorMember.connected_user_id || undefined,
      createdAt: creatorMember.created_at,
    });

    // Add initial members
    for (const member of initialMembers || []) {
      let connectedUserId: string | undefined;

      // Check if user with this email already exists
      if (member.email) {
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('email', member.email)
          .maybeSingle();

        if (existingUser) {
          connectedUserId = existingUser.id;
        }
      }

      const memberName =
        member.name || (member.email ? member.email.split('@')[0] : 'Unknown');

      const { data: newMember, error: memberError } = await supabaseAdmin
        .from('group_members')
        .insert({
          group_id: groupId,
          name: memberName,
          email: member.email || null,
          connected_user_id: connectedUserId || null,
        })
        .select()
        .single();

      if (memberError) {
        console.error('Failed to add member:', memberError);
        // Continue with other members, don't fail the entire request
        continue;
      }

      members.push({
        id: newMember.id,
        groupId: newMember.group_id,
        name: newMember.name,
        email: newMember.email || undefined,
        connectedUserId: newMember.connected_user_id || undefined,
        createdAt: newMember.created_at,
      });
    }

    const group: Group = {
      id: groupData.id,
      name: groupData.name,
      mainCurrencyCode: groupData.main_currency_code,
      createdAt: groupData.created_at,
      members,
    };

    return new Response(JSON.stringify({ success: true, group }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in create-group function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
