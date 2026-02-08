import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createMockSupabaseClient,
  MockSupabaseClient,
  resetAllMocks,
} from '../utils/mockSupabase';
import {
  __resetExchangeRateCacheForTests,
  getExchangeRate,
  prefetchExchangeRates,
  prefetchExchangeRatesOnLogin,
  resolveExchangeRateForEdit,
} from '../../services/exchangeRateService';
import { toScaled } from '../../utils/money';

jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('exchangeRateService', () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  beforeAll(() => {
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    __resetExchangeRateCacheForTests();
    mockSupabase = createMockSupabaseClient();
    supabaseModule = require('../../lib/supabase');
    supabaseModule.supabase = mockSupabase;
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetAllMocks(mockSupabase);
    __resetExchangeRateCacheForTests();
  });

  describe('getExchangeRate', () => {
    it('returns 1:1 locally for same-currency conversion without invoking edge function', async () => {
      const result = await getExchangeRate('USD', 'USD');

      expect(result).toEqual({
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'USD',
        rateScaled: toScaled(1),
        fetchedAt: expect.any(String),
      });
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
    });

    it('invokes the edge function and maps a successful response', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'EUR',
          rateScaled: '85000',
          fetchedAt: '2026-02-07T00:00:00.000Z',
        },
        error: null,
      });

      const result = await getExchangeRate('USD', 'EUR');

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'get-exchange-rate',
        {
          body: { baseCurrency: 'USD', quoteCurrency: 'EUR' },
        },
      );
      expect(result).toEqual({
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'EUR',
        rateScaled: BigInt(85000),
        fetchedAt: '2026-02-07T00:00:00.000Z',
      });
    });

    it('converts numeric rate values to bigint', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          baseCurrencyCode: 'GBP',
          quoteCurrencyCode: 'JPY',
          rateScaled: 1857500,
          fetchedAt: '2026-02-07T00:00:00.000Z',
        },
        error: null,
      });

      const result = await getExchangeRate('GBP', 'JPY');

      expect(result).not.toBeNull();
      expect(result!.rateScaled).toBe(BigInt(1857500));
      expect(typeof result!.rateScaled).toBe('bigint');
    });

    it('returns a fresh cached rate from local storage without invoking edge function', async () => {
      storage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          'USD:EUR': {
            baseCurrencyCode: 'USD',
            quoteCurrencyCode: 'EUR',
            rateScaled: '85000',
            fetchedAt: new Date().toISOString(),
          },
        }),
      );

      const result = await getExchangeRate('USD', 'EUR');

      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
      expect(result).toEqual({
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'EUR',
        rateScaled: BigInt(85000),
        fetchedAt: expect.any(String),
      });
    });

    it('persists successful function responses into local storage', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'CAD',
          rateScaled: '136000',
          fetchedAt: '2026-02-07T00:00:00.000Z',
        },
        error: null,
      });

      await getExchangeRate('USD', 'CAD');

      expect(storage.setItem).toHaveBeenCalledWith(
        'exchange_rate_cache_v1',
        expect.stringContaining('"USD:CAD"'),
      );
    });

    it('returns stale cached value when refresh fails', async () => {
      storage.getItem.mockResolvedValueOnce(
        JSON.stringify({
          'USD:JPY': {
            baseCurrencyCode: 'USD',
            quoteCurrencyCode: 'JPY',
            rateScaled: '1500000',
            fetchedAt: '2020-01-01T00:00:00.000Z',
          },
        }),
      );
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Function returned 500' },
      });

      const result = await getExchangeRate('USD', 'JPY');

      expect(result).toEqual({
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'JPY',
        rateScaled: BigInt(1500000),
        fetchedAt: '2020-01-01T00:00:00.000Z',
      });
    });

    it('returns null and logs when the function returns an error', async () => {
      const invokeError = { message: 'Function returned 500' };
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: invokeError,
      });

      const result = await getExchangeRate('USD', 'CAD');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Failed to get exchange rate:',
        invokeError,
      );
    });

    it('returns null and warns when the function returns no data', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await getExchangeRate('USD', 'AUD');

      expect(result).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        'No data returned from exchange rate function',
      );
    });

    it('returns null and logs when invoking the function throws', async () => {
      const invokeError = new Error('Network timeout');
      mockSupabase.functions.invoke.mockRejectedValue(invokeError);

      const result = await getExchangeRate('EUR', 'USD');

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        'Failed to fetch exchange rate:',
        invokeError,
      );
    });
  });

  describe('prefetchExchangeRates', () => {
    it('deduplicates pairs and skips same-currency rates', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'EUR',
          rateScaled: '85000',
          fetchedAt: '2026-02-07T00:00:00.000Z',
        },
        error: null,
      });

      await prefetchExchangeRates([
        { baseCurrency: 'USD', quoteCurrency: 'EUR' },
        { baseCurrency: 'usd', quoteCurrency: 'eur' },
        { baseCurrency: 'EUR', quoteCurrency: 'EUR' },
      ]);

      expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveExchangeRateForEdit', () => {
    it('returns original rate when expense currency is unchanged', async () => {
      const result = await resolveExchangeRateForEdit(
        'USD',
        'usd',
        'EUR',
        BigInt(12345),
      );

      expect(result).toBe(BigInt(12345));
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
    });

    it('fetches a new rate when expense currency changes', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          baseCurrencyCode: 'GBP',
          quoteCurrencyCode: 'EUR',
          rateScaled: '117000',
          fetchedAt: '2026-02-07T00:00:00.000Z',
        },
        error: null,
      });

      const result = await resolveExchangeRateForEdit(
        'USD',
        'GBP',
        'EUR',
        BigInt(12345),
      );

      expect(result).toBe(BigInt(117000));
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'get-exchange-rate',
        {
          body: { baseCurrency: 'GBP', quoteCurrency: 'EUR' },
        },
      );
    });
  });

  describe('prefetchExchangeRatesOnLogin', () => {
    it('prefetches rates for expense currencies against group currencies', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            {
              currency_code: 'USD',
              groups: { main_currency_code: 'EUR' },
            },
            {
              currency_code: 'USD',
              groups: { main_currency_code: 'EUR' },
            },
            {
              currency_code: 'EUR',
              groups: { main_currency_code: 'EUR' },
            },
          ],
          error: null,
        }),
      } as any);
      mockSupabase.functions.invoke.mockResolvedValue({
        data: {
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'EUR',
          rateScaled: '85000',
          fetchedAt: '2026-02-07T00:00:00.000Z',
        },
        error: null,
      });

      await prefetchExchangeRatesOnLogin();

      expect(mockSupabase.from).toHaveBeenCalledWith('expenses');
      expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'get-exchange-rate',
        {
          body: { baseCurrency: 'USD', quoteCurrency: 'EUR' },
        },
      );
    });
  });
});
