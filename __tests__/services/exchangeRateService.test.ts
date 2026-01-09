import { toScaled } from '../../utils/money';
import { createMockSupabaseClient } from '../utils/mockSupabase';
import type { MockSupabaseClient } from '../utils/mockSupabase';

// Mock the supabase module
let mockSupabase: MockSupabaseClient;
jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock fetch
global.fetch = jest.fn();

describe('exchangeRateService', () => {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;

  // Suppress console output for cleaner test runs
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
    require('../../lib/supabase').supabase = mockSupabase;
    (global.fetch as jest.Mock).mockClear();
  });

  describe('getExchangeRate', () => {
    const { getExchangeRate } = require('../../services/exchangeRateService');

    describe('same currency shortcut', () => {
      it('should return 1:1 rate when currencies are identical', async () => {
        const result = await getExchangeRate('USD', 'USD');

        expect(result).toEqual({
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'USD',
          rateScaled: toScaled(1),
          fetchedAt: expect.any(String),
        });

        // Should not query database or API
        expect(mockSupabase.from).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should return 1:1 rate for EUR to EUR', async () => {
        const result = await getExchangeRate('EUR', 'EUR');

        expect(result).not.toBeNull();
        expect(result!.rateScaled).toBe(toScaled(1));
        expect(result!.baseCurrencyCode).toBe('EUR');
        expect(result!.quoteCurrencyCode).toBe('EUR');
      });
    });

    describe('cache hit - fresh data', () => {
      it('should return cached rate when data is fresh (< 12 hours)', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        const cachedRate = {
          base_currency_code: 'USD',
          quote_currency_code: 'EUR',
          rate_scaled: 85000, // 0.85
          fetched_at: oneHourAgo.toISOString(),
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: cachedRate,
            error: null,
          }),
        } as any);

        const result = await getExchangeRate('USD', 'EUR');

        expect(result).toEqual({
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'EUR',
          rateScaled: BigInt(85000),
          fetchedAt: cachedRate.fetched_at,
        });

        // Should query database
        expect(mockSupabase.from).toHaveBeenCalledWith('exchange_rates');

        // Should NOT call API
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('should return cached rate when data is 11 hours old', async () => {
        const elevenHoursAgo = new Date(Date.now() - 11 * 60 * 60 * 1000);
        const cachedRate = {
          base_currency_code: 'GBP',
          quote_currency_code: 'JPY',
          rate_scaled: 1650000, // 165.00
          fetched_at: elevenHoursAgo.toISOString(),
        };

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: cachedRate,
            error: null,
          }),
        } as any);

        const result = await getExchangeRate('GBP', 'JPY');

        expect(result).not.toBeNull();
        expect(result!.rateScaled).toBe(BigInt(1650000));
        expect(global.fetch).not.toHaveBeenCalled();
      });
    });

    describe('cache hit - stale data', () => {
      it('should fetch from API when cached data is stale (> 12 hours)', async () => {
        const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000);
        const staleCachedRate = {
          base_currency_code: 'USD',
          quote_currency_code: 'EUR',
          rate_scaled: 85000,
          fetched_at: thirteenHoursAgo.toISOString(),
        };

        // Mock database returning stale data
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: staleCachedRate,
            error: null,
          }),
        } as any);

        // Mock API response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            rates: {
              EUR: 0.87,
            },
          }),
        });

        // Mock database upsert
        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({
            error: null,
          }),
        } as any);

        const result = await getExchangeRate('USD', 'EUR');

        expect(result).not.toBeNull();
        expect(result!.rateScaled).toBe(toScaled(0.87));

        // Should have called API
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.exchangerate-api.com/v4/latest/USD',
        );
      });

      it('should fetch from API when data is exactly 13 hours old', async () => {
        const exactlyThirteenHours = new Date(Date.now() - 13 * 60 * 60 * 1000);
        const staleCachedRate = {
          base_currency_code: 'EUR',
          quote_currency_code: 'GBP',
          rate_scaled: 86000,
          fetched_at: exactlyThirteenHours.toISOString(),
        };

        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: staleCachedRate,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { GBP: 0.88 } }),
        });

        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        await getExchangeRate('EUR', 'GBP');

        expect(global.fetch).toHaveBeenCalled();
      });
    });

    describe('cache miss', () => {
      it('should fetch from API when no cached data exists', async () => {
        // Mock database returning no data
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        // Mock API response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            rates: {
              JPY: 149.5,
            },
          }),
        });

        // Mock database upsert
        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({
            error: null,
          }),
        } as any);

        const result = await getExchangeRate('USD', 'JPY');

        expect(result).toEqual({
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'JPY',
          rateScaled: toScaled(149.5),
          fetchedAt: expect.any(String),
        });

        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.exchangerate-api.com/v4/latest/USD',
        );
      });
    });

    describe('API success stores in cache', () => {
      it('should store fetched rate in database cache', async () => {
        // Mock no cached data
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        // Mock API response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            rates: {
              CAD: 1.35,
            },
          }),
        });

        // Mock database upsert
        const mockUpsert = jest.fn().mockResolvedValue({ error: null });
        mockSupabase.from.mockReturnValueOnce({
          upsert: mockUpsert,
        } as any);

        await getExchangeRate('USD', 'CAD');

        // Verify upsert was called with correct data
        expect(mockUpsert).toHaveBeenCalledWith(
          {
            base_currency_code: 'USD',
            quote_currency_code: 'CAD',
            rate_scaled: Number(toScaled(1.35)),
            fetched_at: expect.any(String),
          },
          {
            onConflict: 'base_currency_code,quote_currency_code',
          },
        );
      });

      it('should continue even if database cache write fails', async () => {
        // Mock no cached data
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        // Mock API response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            rates: {
              EUR: 0.92,
            },
          }),
        });

        // Mock database upsert failure
        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({
            error: { message: 'Database error' },
          }),
        } as any);

        // Should still return the rate even if cache write fails
        const result = await getExchangeRate('USD', 'EUR');

        expect(result).toEqual({
          baseCurrencyCode: 'USD',
          quoteCurrencyCode: 'EUR',
          rateScaled: toScaled(0.92),
          fetchedAt: expect.any(String),
        });
      });
    });

    describe('database read errors', () => {
      it('should fetch from API when database query fails', async () => {
        // Mock database error
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest
            .fn()
            .mockRejectedValue(new Error('Database connection failed')),
        } as any);

        // Mock API response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            rates: {
              AUD: 1.52,
            },
          }),
        });

        // Mock database upsert
        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        const result = await getExchangeRate('USD', 'AUD');

        expect(result).not.toBeNull();
        expect(result!.rateScaled).toBe(toScaled(1.52));
        expect(global.fetch).toHaveBeenCalled();
      });

      it('should log warning when database query fails', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockRejectedValue(new Error('DB error')),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { EUR: 0.85 } }),
        });

        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        await getExchangeRate('USD', 'EUR');

        expect(console.warn).toHaveBeenCalledWith(
          'Failed to query cached exchange rate:',
          expect.any(Error),
        );
      });
    });

    describe('API failures', () => {
      it('should return null when API request fails', async () => {
        // Mock no cached data
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        // Mock API failure
        (global.fetch as jest.Mock).mockRejectedValue(
          new Error('Network error'),
        );

        const result = await getExchangeRate('USD', 'EUR');

        expect(result).toBeNull();
      });

      it('should return null when API returns non-OK status', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        // Mock API 404 response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: false,
          status: 404,
        });

        const result = await getExchangeRate('USD', 'INVALID');

        expect(result).toBeNull();
      });

      it('should return null when rate not found in API response', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        // Mock API response without the requested currency
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            rates: {
              EUR: 0.85,
              GBP: 0.73,
              // JPY is missing
            },
          }),
        });

        const result = await getExchangeRate('USD', 'JPY');

        expect(result).toBeNull();
        expect(console.warn).toHaveBeenCalledWith(
          'No rate found for USD to JPY',
        );
      });

      it('should return null when API response is malformed', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        // Mock malformed API response
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({
            // Missing 'rates' property
            base: 'USD',
          }),
        });

        const result = await getExchangeRate('USD', 'EUR');

        expect(result).toBeNull();
      });

      it('should log error when API fetch fails', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockRejectedValue(
          new Error('Network timeout'),
        );

        await getExchangeRate('USD', 'EUR');

        expect(console.error).toHaveBeenCalledWith(
          'Failed to fetch exchange rate:',
          expect.any(Error),
        );
      });
    });

    describe('database write errors', () => {
      it('should log error when cache upsert fails', async () => {
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { EUR: 0.88 } }),
        });

        // Mock upsert failure
        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({
            error: { message: 'Constraint violation' },
          }),
        } as any);

        await getExchangeRate('USD', 'EUR');

        expect(console.error).toHaveBeenCalledWith(
          'Failed to cache exchange rate:',
          expect.objectContaining({ message: 'Constraint violation' }),
        );
      });

      it('should log error when cache upsert throws', async () => {
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { EUR: 0.88 } }),
        });

        // Mock upsert throwing
        mockSupabase.from.mockReturnValueOnce({
          upsert: jest
            .fn()
            .mockRejectedValue(new Error('Database unavailable')),
        } as any);

        await getExchangeRate('USD', 'EUR');

        expect(console.error).toHaveBeenCalledWith(
          'Failed to cache exchange rate:',
          expect.any(Error),
        );
      });
    });

    describe('currency pair variations', () => {
      it('should handle EUR to USD conversion', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { USD: 1.08 } }),
        });

        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        const result = await getExchangeRate('EUR', 'USD');

        expect(result).not.toBeNull();
        expect(result!.baseCurrencyCode).toBe('EUR');
        expect(result!.quoteCurrencyCode).toBe('USD');
        expect(global.fetch).toHaveBeenCalledWith(
          'https://api.exchangerate-api.com/v4/latest/EUR',
        );
      });

      it('should handle GBP to JPY conversion', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { JPY: 185.75 } }),
        });

        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        const result = await getExchangeRate('GBP', 'JPY');

        expect(result).not.toBeNull();
        expect(result!.rateScaled).toBe(toScaled(185.75));
      });
    });

    describe('rate scaling', () => {
      it('should properly scale decimal rates to bigint', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { EUR: 0.8567 } }),
        });

        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        const result = await getExchangeRate('USD', 'EUR');

        expect(result).not.toBeNull();
        expect(result!.rateScaled).toBe(toScaled(0.8567));
        expect(typeof result!.rateScaled).toBe('bigint');
      });

      it('should handle integer rates', async () => {
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { JPY: 150 } }),
        });

        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        const result = await getExchangeRate('USD', 'JPY');

        expect(result).not.toBeNull();
        expect(result!.rateScaled).toBe(toScaled(150));
      });
    });

    describe('timestamp handling', () => {
      it('should return current timestamp for new fetches', async () => {
        const beforeFetch = Date.now();

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        } as any);

        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          json: async () => ({ rates: { EUR: 0.85 } }),
        });

        mockSupabase.from.mockReturnValueOnce({
          upsert: jest.fn().mockResolvedValue({ error: null }),
        } as any);

        const result = await getExchangeRate('USD', 'EUR');
        const afterFetch = Date.now();

        expect(result).not.toBeNull();
        const fetchedTime = new Date(result!.fetchedAt).getTime();
        expect(fetchedTime).toBeGreaterThanOrEqual(beforeFetch);
        expect(fetchedTime).toBeLessThanOrEqual(afterFetch);
      });

      it('should preserve timestamp from cached data', async () => {
        // Use a recent timestamp (1 hour ago) so it's not stale
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const cachedTimestamp = oneHourAgo.toISOString();

        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              base_currency_code: 'USD',
              quote_currency_code: 'EUR',
              rate_scaled: 85000,
              fetched_at: cachedTimestamp,
            },
            error: null,
          }),
        } as any);

        const result = await getExchangeRate('USD', 'EUR');

        expect(result).not.toBeNull();
        expect(result!.fetchedAt).toBe(cachedTimestamp);
      });
    });
  });
});
