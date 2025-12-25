import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationRequest {
  email: string;
  groupName: string;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, groupName }: InvitationRequest = await req.json();

    if (!email || !groupName) {
      return new Response(
        JSON.stringify({ error: "Missing email or groupName" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY environment variable is not set");
      return new Response(
        JSON.stringify({ error: "Server configuration error: Missing API key" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resend = new Resend(RESEND_API_KEY);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: #f9fafb;
              border-radius: 8px;
              padding: 32px;
            }
            .header {
              text-align: center;
              margin-bottom: 32px;
            }
            .header h1 {
              color: #111827;
              font-size: 24px;
              margin: 0;
            }
            .content {
              background: white;
              border-radius: 8px;
              padding: 24px;
              margin-bottom: 24px;
            }
            .content p {
              margin: 0 0 16px 0;
            }
            .group-name {
              font-weight: 600;
              color: #2563eb;
            }
            .cta-button {
              display: inline-block;
              background: #2563eb;
              color: white;
              text-decoration: none;
              padding: 12px 32px;
              border-radius: 8px;
              font-weight: 600;
              margin: 16px 0;
            }
            .footer {
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 You're Invited!</h1>
            </div>
            <div class="content">
              <p>Hi there!</p>
              <p>You've been invited to join the group <span class="group-name">"${groupName}"</span> on the MoneySplit expense sharing app.</p>
              <p>Join now to:</p>
              <ul>
                <li>Track shared expenses with your group</li>
                <li>See who owes what in real-time</li>
                <li>Settle up easily with multi-currency support</li>
              </ul>
              <p style="text-align: center;">
                <a href="#" class="cta-button">Get Started</a>
              </p>
              <p style="font-size: 14px; color: #6b7280;">If you didn't expect this invitation, you can safely ignore this email.</p>
            </div>
            <div class="footer">
              <p>© 2025 Lukasz Czajka. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.emails.send({
      from: "moneysplit@moneysplit.polapp.pl",
      to: email,
      subject: `You're invited to join "${groupName}"`,
      html: emailHtml,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send invitation email", details: error }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Invitation email sent to ${email} for group ${groupName}. Email ID: ${data?.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Invitation sent to ${email}`,
        emailId: data?.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing invitation:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});