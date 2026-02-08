import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { Resend } from 'npm:resend@4.0.0';
import bcrypt from 'npm:bcryptjs@2.4.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PasswordRecoveryRequest {
  email: string;
}

const PASSWORD_TTL_MS = 5 * 60 * 1000;
const PASSWORD_RECOVERY_GENERIC_RESPONSE = JSON.stringify({ success: true });

function createGenericSuccessResponse() {
  return new Response(PASSWORD_RECOVERY_GENERIC_RESPONSE, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function generatePassword(length = 12): string {
  const charset =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$?';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => charset[value % charset.length]).join(
    '',
  );
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
    const { email }: PasswordRecoveryRequest = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !resendApiKey) {
      console.error('Missing server configuration for password recovery');
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

    const { data: publicUser, error: publicUserError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (publicUserError || !publicUser) {
      if (publicUserError) {
        console.error(
          'Failed to fetch public user by email during password recovery:',
          {
            message: publicUserError.message,
            code: publicUserError.code,
          },
        );
      }
      return createGenericSuccessResponse();
    }

    // Check if there's an existing unexpired recovery password
    const { data: existingRecovery, error: checkError } = await supabaseClient
      .from('recovery_passwords')
      .select('expires_at')
      .eq('user_id', publicUser.id)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Failed to check existing recovery password:', checkError);
      return new Response(
        JSON.stringify({ error: 'Failed to check recovery status' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (existingRecovery) {
      const existingExpiry = new Date(existingRecovery.expires_at);
      if (existingExpiry > new Date()) {
        console.log(
          'User already has an active recovery password, rejecting new request',
        );
        return createGenericSuccessResponse();
      }
    }

    const recoveryPassword = generatePassword();
    const expiresAt = new Date(Date.now() + PASSWORD_TTL_MS).toISOString();
    const resend = new Resend(resendApiKey);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #111827;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #f9fafb;
              border-radius: 8px;
              padding: 32px;
            }
            .content {
              background: #fff;
              border-radius: 8px;
              padding: 24px;
            }
            .code {
              font-size: 20px;
              font-weight: 700;
              letter-spacing: 1px;
              background: #e5e7eb;
              padding: 12px 16px;
              border-radius: 8px;
              display: inline-block;
            }
            .footer {
              margin-top: 24px;
              font-size: 14px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h1>Password recovery</h1>
              <p>Use the one-time password below to sign in. It expires in 5 minutes.</p>
              <p class="code">${recoveryPassword}</p>
              <p>If you did not request a password recovery, you can ignore this email.</p>
            </div>
            <div class="footer">© 2025 Lukasz Czajka. All rights reserved.</div>
          </div>
        </body>
      </html>
    `;

    // Hash the recovery password before storing.
    const passwordHash = await bcrypt.hash(recoveryPassword, 10);

    // Store the hashed recovery password in the database
    const { error: upsertError } = await supabaseClient
      .from('recovery_passwords')
      .upsert(
        {
          user_id: publicUser.id,
          password_hash: passwordHash,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        },
      );

    if (upsertError) {
      console.error('Failed to store recovery password:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create recovery password' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Send the recovery password via email
    const { error: emailError } = await resend.emails.send({
      from: 'moneysplit@moneysplit.polapp.pl',
      to: email,
      subject: 'Your MoneySplit recovery password',
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send recovery email:', emailError);
      // Clean up the recovery password since email failed
      await supabaseClient
        .from('recovery_passwords')
        .delete()
        .eq('user_id', publicUser.id);
      return new Response(
        JSON.stringify({ error: 'Failed to send recovery email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    return createGenericSuccessResponse();
  } catch (error) {
    console.error('Password recovery error:', error);
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
