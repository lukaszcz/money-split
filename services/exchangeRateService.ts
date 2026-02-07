import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { toScaled } from '../utils/money';

export interface ExchangeRate {
  baseCurrencyCode: string;
  quoteCurrencyCode: string;
  rateScaled: bigint;
  fetchedAt: string;
}

export interface ExchangeRatePair {
  baseCurrency: string;
  quoteCurrency: string;
}

type SerializedExchangeRate = Omit<ExchangeRate, 'rateScaled'> & {
  rateScaled: string;
};

const EXCHANGE_RATE_CACHE_KEY = 'exchange_rate_cache_v1';
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

let exchangeRateCache: Map<string, ExchangeRate> | null = null;
const inFlightRequests = new Map<string, Promise<ExchangeRate | null>>();

const normalizeCurrencyCode = (currencyCode: string): string =>
  currencyCode.toUpperCase();

const buildCacheKey = (baseCurrency: string, quoteCurrency: string): string =>
  `${baseCurrency}:${quoteCurrency}`;

const isRateStale = (rate: ExchangeRate): boolean => {
  const fetchedTime = Date.parse(rate.fetchedAt);
  if (Number.isNaN(fetchedTime)) {
    return true;
  }

  return Date.now() - fetchedTime > CACHE_DURATION_MS;
};

const parseSerializedRate = (value: unknown): SerializedExchangeRate | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const serialized = value as Partial<SerializedExchangeRate>;
  if (
    typeof serialized.baseCurrencyCode !== 'string' ||
    typeof serialized.quoteCurrencyCode !== 'string' ||
    typeof serialized.rateScaled !== 'string' ||
    typeof serialized.fetchedAt !== 'string'
  ) {
    return null;
  }

  return {
    baseCurrencyCode: serialized.baseCurrencyCode,
    quoteCurrencyCode: serialized.quoteCurrencyCode,
    rateScaled: serialized.rateScaled,
    fetchedAt: serialized.fetchedAt,
  };
};

const deserializeCache = (raw: string): Map<string, ExchangeRate> => {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const cache = new Map<string, ExchangeRate>();

  for (const [key, value] of Object.entries(parsed)) {
    const serializedRate = parseSerializedRate(value);
    if (!serializedRate) {
      continue;
    }

    cache.set(key, {
      baseCurrencyCode: serializedRate.baseCurrencyCode,
      quoteCurrencyCode: serializedRate.quoteCurrencyCode,
      rateScaled: BigInt(serializedRate.rateScaled),
      fetchedAt: serializedRate.fetchedAt,
    });
  }

  return cache;
};

const serializeCache = (cache: Map<string, ExchangeRate>): string => {
  const serialized: Record<string, SerializedExchangeRate> = {};

  for (const [key, value] of cache.entries()) {
    serialized[key] = {
      baseCurrencyCode: value.baseCurrencyCode,
      quoteCurrencyCode: value.quoteCurrencyCode,
      rateScaled: value.rateScaled.toString(),
      fetchedAt: value.fetchedAt,
    };
  }

  return JSON.stringify(serialized);
};

async function loadCache(): Promise<Map<string, ExchangeRate>> {
  if (exchangeRateCache) {
    return exchangeRateCache;
  }

  try {
    const raw = await AsyncStorage.getItem(EXCHANGE_RATE_CACHE_KEY);
    exchangeRateCache = raw ? deserializeCache(raw) : new Map();
  } catch (error) {
    console.error('Failed to load exchange rate cache:', error);
    exchangeRateCache = new Map();
  }

  return exchangeRateCache;
}

async function persistCache(cache: Map<string, ExchangeRate>): Promise<void> {
  try {
    await AsyncStorage.setItem(EXCHANGE_RATE_CACHE_KEY, serializeCache(cache));
  } catch (error) {
    console.error('Failed to persist exchange rate cache:', error);
  }
}

async function setCachedRate(rate: ExchangeRate): Promise<void> {
  const cache = await loadCache();
  cache.set(buildCacheKey(rate.baseCurrencyCode, rate.quoteCurrencyCode), rate);
  await persistCache(cache);
}

function createSameCurrencyRate(currencyCode: string): ExchangeRate {
  return {
    baseCurrencyCode: currencyCode,
    quoteCurrencyCode: currencyCode,
    rateScaled: toScaled(1),
    fetchedAt: new Date().toISOString(),
  };
}

function dedupePairs(pairs: ExchangeRatePair[]): ExchangeRatePair[] {
  const uniquePairs = new Map<string, ExchangeRatePair>();

  for (const pair of pairs) {
    const baseCurrency = normalizeCurrencyCode(pair.baseCurrency);
    const quoteCurrency = normalizeCurrencyCode(pair.quoteCurrency);

    if (baseCurrency === quoteCurrency) {
      continue;
    }

    const key = buildCacheKey(baseCurrency, quoteCurrency);
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, { baseCurrency, quoteCurrency });
    }
  }

  return Array.from(uniquePairs.values());
}

export async function getExchangeRate(
  baseCurrency: string,
  quoteCurrency: string,
): Promise<ExchangeRate | null> {
  const normalizedBase = normalizeCurrencyCode(baseCurrency);
  const normalizedQuote = normalizeCurrencyCode(quoteCurrency);

  if (normalizedBase === normalizedQuote) {
    return createSameCurrencyRate(normalizedBase);
  }

  const cacheKey = buildCacheKey(normalizedBase, normalizedQuote);
  const cache = await loadCache();
  const cachedRate = cache.get(cacheKey);

  if (cachedRate && !isRateStale(cachedRate)) {
    return cachedRate;
  }

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const request = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke(
        'get-exchange-rate',
        {
          body: {
            baseCurrency: normalizedBase,
            quoteCurrency: normalizedQuote,
          },
        },
      );

      if (error) {
        console.error('Failed to get exchange rate:', error);
        return cachedRate || null;
      }

      if (!data) {
        console.warn('No data returned from exchange rate function');
        return cachedRate || null;
      }

      const fetchedRate: ExchangeRate = {
        baseCurrencyCode: normalizeCurrencyCode(data.baseCurrencyCode),
        quoteCurrencyCode: normalizeCurrencyCode(data.quoteCurrencyCode),
        rateScaled: BigInt(data.rateScaled),
        fetchedAt: data.fetchedAt,
      };
      await setCachedRate(fetchedRate);
      return fetchedRate;
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      return cachedRate || null;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, request);
  return request;
}

export async function resolveExchangeRateForEdit(
  originalCurrency: string,
  editedCurrency: string,
  quoteCurrency: string,
  originalRateScaled: bigint,
): Promise<bigint | null> {
  const normalizedOriginal = normalizeCurrencyCode(originalCurrency);
  const normalizedEdited = normalizeCurrencyCode(editedCurrency);

  if (normalizedOriginal === normalizedEdited) {
    return originalRateScaled;
  }

  const rate = await getExchangeRate(normalizedEdited, quoteCurrency);
  return rate?.rateScaled ?? null;
}

export async function prefetchExchangeRates(
  pairs: ExchangeRatePair[],
): Promise<void> {
  const uniquePairs = dedupePairs(pairs);
  await Promise.all(
    uniquePairs.map((pair) =>
      getExchangeRate(pair.baseCurrency, pair.quoteCurrency),
    ),
  );
}

type ExchangeRatePrefetchRow = {
  currency_code: string;
  groups:
    | {
        main_currency_code: string;
      }
    | {
        main_currency_code: string;
      }[]
    | null;
};

const getMainCurrencyCodeFromRow = (
  row: ExchangeRatePrefetchRow,
): string | null => {
  if (!row.groups) {
    return null;
  }

  if (Array.isArray(row.groups)) {
    if (row.groups.length === 0) {
      return null;
    }
    return row.groups[0].main_currency_code;
  }

  return row.groups.main_currency_code;
};

export async function prefetchExchangeRatesOnLogin(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('expenses')
      .select('currency_code, groups!inner(main_currency_code)');

    if (error) {
      console.error(
        'Failed to load currencies for exchange rate prefetch:',
        error,
      );
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    const pairs: ExchangeRatePair[] = (data as ExchangeRatePrefetchRow[])
      .map((row) => {
        const quoteCurrency = getMainCurrencyCodeFromRow(row);
        if (!quoteCurrency) {
          return null;
        }

        return {
          baseCurrency: row.currency_code,
          quoteCurrency,
        };
      })
      .filter((pair): pair is ExchangeRatePair => pair !== null);

    await prefetchExchangeRates(pairs);
  } catch (error) {
    console.error('Failed to prefetch exchange rates on login:', error);
  }
}

export function __resetExchangeRateCacheForTests(): void {
  exchangeRateCache = null;
  inFlightRequests.clear();
}
