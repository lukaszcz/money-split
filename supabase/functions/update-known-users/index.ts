import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface UpdateKnownUsersRequest {
  groupId: string;
  newMemberId: string;
}

Deno.serve(async (req: Request) => {
  try {
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

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with the user's auth token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { groupId, newMemberId }: UpdateKnownUsersRequest = await req.json();

    if (!groupId || !newMemberId) {
      return new Response(
        JSON.stringify({ error: 'Missing groupId or newMemberId' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Get the new member's connected_user_id
    const { data: newMember, error: memberError } = await supabase
      .from('group_members')
      .select('connected_user_id')
      .eq('id', newMemberId)
      .maybeSingle();

    if (memberError) {
      console.error('Error fetching new member:', memberError);
      return new Response(JSON.stringify({ error: 'Failed to fetch member' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!newMember || !newMember.connected_user_id) {
      // New member is not connected to a user yet, nothing to update
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Member not connected to user, no updates needed',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const newUserId = newMember.connected_user_id;

    // Get all members of the group with connected users
    const { data: groupMembers, error: groupMembersError } = await supabase
      .from('group_members')
      .select('connected_user_id')
      .eq('group_id', groupId)
      .not('connected_user_id', 'is', null);

    if (groupMembersError) {
      console.error('Error fetching group members:', groupMembersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch group members' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const connectedUserIds = groupMembers
      .map((m) => m.connected_user_id)
      .filter((id): id is string => id !== null && id !== newUserId);

    if (connectedUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No other connected users in group',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Update known users bidirectionally
    const now = new Date().toISOString();
    const updates: Array<{ user_id: string; known_user_id: string }> = [];

    // Add new user to existing members' known users
    for (const existingUserId of connectedUserIds) {
      updates.push({
        user_id: existingUserId,
        known_user_id: newUserId,
      });
    }

    // Add existing members to new user's known users
    for (const existingUserId of connectedUserIds) {
      updates.push({
        user_id: newUserId,
        known_user_id: existingUserId,
      });
    }

    // Use upsert to insert or update
    for (const update of updates) {
      const { error: upsertError } = await supabase
        .from('user_known_users')
        .upsert(
          {
            user_id: update.user_id,
            known_user_id: update.known_user_id,
            last_shared_at: now,
          },
          {
            onConflict: 'user_id,known_user_id',
          },
        );

      if (upsertError) {
        console.error('Error upserting known user:', upsertError);
        // Continue with other updates even if one fails
      }
    }

    console.log(
      `Updated known users for group ${groupId}, new member ${newMemberId}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Known users updated successfully',
        updatesCount: updates.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error updating known users:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
