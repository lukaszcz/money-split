import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface VerifyRecoveryPasswordRequest {
  email: string;
  password: string;
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
    const { email, password }: VerifyRecoveryPasswordRequest = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing email or password' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing server configuration for recovery verification');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        {
          status: 500,
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

    // Get user by email
    const { data: userData, error: userError } =
      await supabaseClient.auth.admin.getUserByEmail(email);

    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ isRecoveryPassword: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there's a recovery password for this user
    const { data: recoveryData, error: recoveryError } = await supabaseClient
      .from('recovery_passwords')
      .select('password_hash, expires_at')
      .eq('user_id', userData.user.id)
      .single();

    if (recoveryError || !recoveryData) {
      return new Response(JSON.stringify({ isRecoveryPassword: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if recovery password is expired
    const expiresAt = new Date(recoveryData.expires_at);
    if (expiresAt <= new Date()) {
      // Clean up expired password
      await supabaseClient
        .from('recovery_passwords')
        .delete()
        .eq('user_id', userData.user.id);

      return new Response(
        JSON.stringify({
          isRecoveryPassword: false,
          expired: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Verify the password
    const isMatch = await bcrypt.compare(password, recoveryData.password_hash);

    if (isMatch) {
      // Delete the recovery password after successful verification (one-time use)
      await supabaseClient
        .from('recovery_passwords')
        .delete()
        .eq('user_id', userData.user.id);

      return new Response(
        JSON.stringify({
          isRecoveryPassword: true,
          userId: userData.user.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return new Response(JSON.stringify({ isRecoveryPassword: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Recovery password verification error:', error);
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
