import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!bearerToken) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Admin client for DB operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user is authenticated and get their email
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError || !user || !user.email) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized or missing email' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const userId = user.id;
    const userEmail = user.email;

    console.log(
      `Attempting to connect user ${userId} (${userEmail}) to group members`,
    );

    // Update all group_members rows with matching email and NULL connected_user_id
    const { data: updatedMembers, error: updateError } = await supabase
      .from('group_members')
      .update({ connected_user_id: userId })
      .eq('email', userEmail)
      .is('connected_user_id', null)
      .select('id, group_id');

    if (updateError) {
      console.error('Error connecting user to group members:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to connect to groups' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const connectedCount = updatedMembers?.length || 0;

    console.log(
      `Successfully connected user ${userId} to ${connectedCount} group member(s)`,
    );

    // Update known users for each connected member
    if (updatedMembers && updatedMembers.length > 0) {
      for (const member of updatedMembers) {
        try {
          // Call the update-known-users function for this member
          const { error: knownUsersError } = await supabase.functions.invoke(
            'update-known-users',
            {
              body: { groupId: member.group_id, newMemberId: member.id },
              headers: {
                Authorization: `Bearer ${bearerToken}`,
              },
            },
          );

          if (knownUsersError) {
            console.error(
              `Failed to update known users for member ${member.id}:`,
              knownUsersError,
            );
            // Continue with other members even if this fails
          }
        } catch (error) {
          console.error(
            `Error updating known users for member ${member.id}:`,
            error,
          );
          // Continue with other members even if this fails
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        connectedCount,
        message: `Successfully connected to ${connectedCount} group(s)`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('Error in connect-user-to-groups function:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
