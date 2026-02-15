import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, X-Client-Info, Apikey',
};

const API_BASE = 'https://api.exchangerate-api.com/v4/latest';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

interface GetExchangeRateRequest {
  baseCurrency: string;
  quoteCurrency: string;
}

interface ExchangeRate {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rateScaled: string;
  fetchedAt: string;
}

function toScaled(value: number): bigint {
  return BigInt(Math.round(value * 10000));
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

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(bearerToken);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { baseCurrency, quoteCurrency }: GetExchangeRateRequest =
      await req.json();

    if (!baseCurrency || !quoteCurrency) {
      return new Response(
        JSON.stringify({ error: 'Missing baseCurrency or quoteCurrency' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Handle same currency case
    if (baseCurrency === quoteCurrency) {
      const result: ExchangeRate = {
        baseCurrencyCode: baseCurrency,
        quoteCurrencyCode: quoteCurrency,
        rateScaled: toScaled(1).toString(),
        fetchedAt: new Date().toISOString(),
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try to get cached rate
    try {
      const { data } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('base_currency_code', baseCurrency)
        .eq('quote_currency_code', quoteCurrency)
        .maybeSingle();

      if (data) {
        const fetchedTime = new Date(data.fetched_at).getTime();
        const now = Date.now();

        if (now - fetchedTime < CACHE_DURATION_MS) {
          const result: ExchangeRate = {
            baseCurrencyCode: data.base_currency_code,
            quoteCurrencyCode: data.quote_currency_code,
            rateScaled: data.rate_scaled.toString(),
            fetchedAt: data.fetched_at,
          };

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } catch (error) {
      console.warn('Failed to query cached exchange rate:', error);
    }

    // Fetch fresh rate from external API
    try {
      const response = await fetch(`${API_BASE}/${baseCurrency}`);
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();
      const rate = data.rates[quoteCurrency];

      if (!rate) {
        console.warn(`No rate found for ${baseCurrency} to ${quoteCurrency}`);
        return new Response(
          JSON.stringify({
            error: `No rate found for ${baseCurrency} to ${quoteCurrency}`,
          }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          },
        );
      }

      const rateScaled = toScaled(rate);
      const fetchedAt = new Date().toISOString();

      // Cache the rate in database
      try {
        const { error } = await supabase.from('exchange_rates').upsert(
          {
            base_currency_code: baseCurrency,
            quote_currency_code: quoteCurrency,
            rate_scaled: Number(rateScaled),
            fetched_at: fetchedAt,
          },
          {
            onConflict: 'base_currency_code,quote_currency_code',
          },
        );

        if (error) {
          console.error('Failed to cache exchange rate:', error);
        }
      } catch (error) {
        console.error('Failed to cache exchange rate:', error);
      }

      const result: ExchangeRate = {
        baseCurrencyCode: baseCurrency,
        quoteCurrencyCode: quoteCurrency,
        rateScaled: rateScaled.toString(),
        fetchedAt,
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch exchange rate',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }
  } catch (error) {
    console.error('Error processing exchange rate request:', error);
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
