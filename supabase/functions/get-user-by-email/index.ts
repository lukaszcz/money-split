import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface GetUserByEmailRequest {
  email: string;
}

interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
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
    const { email }: GetUserByEmailRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({
          error: 'Missing required field: email',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Fetch user by email using service role (bypasses RLS)
    const { data: userData, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (fetchError) {
      console.error('Failed to fetch user by email:', fetchError);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch user',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!userData) {
      return new Response(JSON.stringify({ success: true, user: null }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user_result: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email || undefined,
      createdAt: userData.created_at,
    };

    return new Response(JSON.stringify({ success: true, user: user_result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-user-by-email function:', error);
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
