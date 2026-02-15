import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import bcrypt from 'npm:bcryptjs@2.4.3';
import { normalizeEmail } from '../_shared/email.ts';

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

const TEMPORARY_PASSWORD_LENGTH = 32;

function generateTemporaryPassword(length = TEMPORARY_PASSWORD_LENGTH): string {
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
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
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
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

    // Get user by email from public.users
    const { data: publicUser, error: publicUserError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (publicUserError || !publicUser) {
      if (publicUserError) {
        console.error(
          'Failed to fetch public user by email during recovery verification:',
          {
            message: publicUserError.message,
            code: publicUserError.code,
          },
        );
      }
      return new Response(JSON.stringify({ isRecoveryPassword: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there's a recovery password for this user
    const { data: recoveryData, error: recoveryError } = await supabaseClient
      .from('recovery_passwords')
      .select('password_hash, expires_at')
      .eq('user_id', publicUser.id)
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
        .eq('user_id', publicUser.id);

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
      // Delete the recovery password before applying changes to make it one-time use.
      const { data: consumedRecoveryRows, error: consumeRecoveryError } =
        await supabaseClient
          .from('recovery_passwords')
          .delete()
          .eq('user_id', publicUser.id)
          .select('id');

      if (consumeRecoveryError) {
        console.error(
          'Failed to consume recovery password before password update:',
          consumeRecoveryError,
        );
        return new Response(
          JSON.stringify({ error: 'Failed to complete recovery sign-in' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      if (!consumedRecoveryRows || consumedRecoveryRows.length === 0) {
        return new Response(JSON.stringify({ isRecoveryPassword: false }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const temporaryPassword = generateTemporaryPassword();
      const { error: updateError } =
        await supabaseClient.auth.admin.updateUserById(publicUser.id, {
          password: temporaryPassword,
        });

      if (updateError) {
        console.error(
          'Failed to set temporary password after recovery password verification:',
          updateError,
        );
        return new Response(
          JSON.stringify({ error: 'Failed to complete recovery sign-in' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      return new Response(
        JSON.stringify({
          isRecoveryPassword: true,
          temporaryPassword,
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
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
