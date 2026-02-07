import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { Resend } from 'npm:resend@4.0.0';

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

    const { data: userData, error: userError } =
      await supabaseClient.auth.admin.getUserByEmail(email);

    if (userError || !userData?.user) {
      if (userError) {
        console.error(
          'Failed to fetch user by email during password recovery:',
          {
            message: userError.message,
            status: userError.status,
          },
        );
      }
      return createGenericSuccessResponse();
    }

    const recoveryPassword = generatePassword();
    const expiresAt = new Date(Date.now() + PASSWORD_TTL_MS).toISOString();
    const existingMetadata = userData.user.user_metadata ?? {};

    const { error: updateError } =
      await supabaseClient.auth.admin.updateUserById(userData.user.id, {
        password: recoveryPassword,
        user_metadata: {
          ...existingMetadata,
          recoveryPasswordExpiresAt: expiresAt,
        },
      });

    if (updateError) {
      console.error('Failed to update recovery password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to set recovery password' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

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

    const { error: emailError } = await resend.emails.send({
      from: 'moneysplit@moneysplit.polapp.pl',
      to: email,
      subject: 'Your MoneySplit recovery password',
      html: emailHtml,
    });

    if (emailError) {
      console.error('Failed to send recovery email:', emailError);
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
        details: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
