import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
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

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Disconnect user from all their groups
    // This sets connected_user_id to null for all group_members where the user is connected
    const { error: disconnectError } = await supabaseClient
      .from('group_members')
      .update({ connected_user_id: null })
      .eq('connected_user_id', user.id);

    if (disconnectError) {
      console.error('Failed to disconnect user from groups:', disconnectError);
      return new Response(
        JSON.stringify({
          error: 'Failed to disconnect from groups',
          details: disconnectError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Step 2: Delete user from public.users table
    // This will cascade delete user_currency_preferences and user_group_preferences
    const { error: publicUserError } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', user.id);

    if (publicUserError) {
      console.error('Failed to delete public user:', publicUserError);
      return new Response(
        JSON.stringify({
          error: 'Failed to delete user profile',
          details: publicUserError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Step 3: Cleanup orphaned groups
    // Call the cleanup function to remove groups with no connected members
    try {
      const cleanupResponse = await fetch(
        `${supabaseUrl}/functions/v1/cleanup-orphaned-groups`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: supabaseServiceKey,
            'Content-Type': 'application/json',
          },
        },
      );

      if (!cleanupResponse.ok) {
        console.error('Cleanup function failed, but user was deleted');
      } else {
        const cleanupResult = await cleanupResponse.json();
        console.log('Cleanup result:', cleanupResult);
      }
    } catch (cleanupError) {
      // Don't fail the entire request if cleanup fails
      console.error('Failed to call cleanup function:', cleanupError);
    }

    // Step 4: Delete user from auth.users
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return new Response(
        JSON.stringify({
          error: 'Failed to delete user',
          details: deleteError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in delete-user function:', error);
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
