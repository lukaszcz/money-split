import { supabase } from '../lib/supabase';

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
  try {
    const { data, error } = await supabase.functions.invoke(
      'get-exchange-rate',
      {
        body: { baseCurrency, quoteCurrency },
      },
    );

    if (error) {
      console.error('Failed to get exchange rate:', error);
      return null;
    }

    if (!data) {
      console.warn('No data returned from exchange rate function');
      return null;
    }

    return {
      baseCurrencyCode: data.baseCurrencyCode,
      quoteCurrencyCode: data.quoteCurrencyCode,
      rateScaled: BigInt(data.rateScaled),
      fetchedAt: data.fetchedAt,
    };
  } catch (error) {
    console.error('Failed to fetch exchange rate:', error);
    return null;
  }
}
