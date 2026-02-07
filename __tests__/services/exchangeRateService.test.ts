import {
  createMockSupabaseClient,
  MockSupabaseClient,
  resetAllMocks,
} from '../utils/mockSupabase';
import { getExchangeRate } from '../../services/exchangeRateService';

jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;

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
    mockSupabase = createMockSupabaseClient();
    supabaseModule = require('../../lib/supabase');
    supabaseModule.supabase = mockSupabase;
  });

  afterEach(() => {
    resetAllMocks(mockSupabase);
    jest.restoreAllMocks();
  });

  describe('getExchangeRate', () => {
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
});
