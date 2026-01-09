import { supabase } from '../lib/supabase';
import { toScaled } from '../utils/money';

const API_BASE = 'https://api.exchangerate-api.com/v4/latest';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

export interface ExchangeRate {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rateScaled: bigint;
  fetchedAt: string;
}

export async function getExchangeRate(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<ExchangeRate | null> {
  if (baseCurrency === quoteCurrency) {
    return {
      baseCurrencyCode: baseCurrency,
      quoteCurrencyCode: quoteCurrency,
      rateScaled: toScaled(1),
      fetchedAt: new Date().toISOString(),
    };
  }

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
        return {
          baseCurrencyCode: data.base_currency_code,
          quoteCurrencyCode: data.quote_currency_code,
          rateScaled: BigInt(data.rate_scaled),
          fetchedAt: data.fetched_at,
        };
      }
    }
  } catch (error) {
    console.warn('Failed to query cached exchange rate:', error);
  }

  try {
    const response = await fetch(`${API_BASE}/${baseCurrency}`);
    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const data = await response.json();
    const rate = data.rates[quoteCurrency];

    if (!rate) {
      console.warn(`No rate found for ${baseCurrency} to ${quoteCurrency}`);
      return null;
    }

    const rateScaled = toScaled(rate);
    const fetchedAt = new Date().toISOString();

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

    return {
      baseCurrencyCode: baseCurrency,
      quoteCurrencyCode: quoteCurrency,
      rateScaled,
      fetchedAt,
    };
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    return null;
  }
}
