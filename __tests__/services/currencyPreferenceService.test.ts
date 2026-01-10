import {
  createMockSupabaseClient,
  createMockUser,
  resetAllMocks,
  MockSupabaseClient,
} from '../utils/mockSupabase';
import { CURRENCIES } from '../../utils/currencies';
import * as Localization from 'expo-localization';
import * as currencyPreferenceService from '../../services/currencyPreferenceService';

jest.mock('@/lib/supabase', () => ({
  supabase: null,
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(),
}));

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;

const getCurrencyCodes = () => CURRENCIES.map((currency) => currency.code);

describe('currencyPreferenceService', () => {
  const originalConsoleError = console.error;

  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    supabaseModule = require('@/lib/supabase');
    supabaseModule.supabase = mockSupabase;
  });

  afterEach(() => {
    resetAllMocks(mockSupabase);
    jest.restoreAllMocks();
  });

  it('returns default currency order when no user is signed in', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await currencyPreferenceService.getUserCurrencyOrder();

    expect(result).toEqual(getCurrencyCodes());
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns default order when preference lookup fails', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'fail' },
      }),
    };

    mockSupabase.from.mockReturnValue(preferenceBuilder as any);

    const result = await currencyPreferenceService.getUserCurrencyOrder();

    expect(result).toEqual(getCurrencyCodes());
  });

  it('creates an initial order based on locale when none is stored', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    (Localization.getLocales as jest.Mock).mockReturnValue([
      { languageTag: 'en-GB', languageCode: 'en', regionCode: 'GB' },
    ]);

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const existingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const insertBuilder = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      if (callCount === 2) {
        return existingBuilder as any;
      }
      return insertBuilder as any;
    });

    const result = await currencyPreferenceService.getUserCurrencyOrder();

    const expectedOrder = [
      'GBP',
      ...CURRENCIES.filter((currency) => currency.code !== 'GBP').map(
        (currency) => currency.code,
      ),
    ];

    expect(result).toEqual(expectedOrder);
    expect(insertBuilder.insert).toHaveBeenCalledWith({
      user_id: mockUser.id,
      currency_order: expectedOrder,
    });
  });

  it('falls back to language code when locale tag is not mapped', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    (Localization.getLocales as jest.Mock).mockReturnValue([
      { languageTag: 'xx-YY', languageCode: 'pl', regionCode: 'PL' },
    ]);

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const existingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const insertBuilder = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      if (callCount === 2) {
        return existingBuilder as any;
      }
      return insertBuilder as any;
    });

    const result = await currencyPreferenceService.getUserCurrencyOrder();

    const expectedOrder = [
      'PLN',
      ...CURRENCIES.filter((currency) => currency.code !== 'PLN').map(
        (currency) => currency.code,
      ),
    ];

    expect(result).toEqual(expectedOrder);
  });

  it('falls back to USD when locale is not mapped and order is empty', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    (Localization.getLocales as jest.Mock).mockReturnValue([
      { languageTag: 'xx-YY', languageCode: 'xx', regionCode: 'YY' },
    ]);

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { currency_order: [] },
        error: null,
      }),
    };

    const existingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    const insertBuilder = {
      insert: jest.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      if (callCount === 2) {
        return existingBuilder as any;
      }
      return insertBuilder as any;
    });

    const result = await currencyPreferenceService.getUserCurrencyOrder();

    expect(result[0]).toBe('USD');
  });

  it('appends missing currency codes to saved order', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { currency_order: ['EUR', 'USD'] },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(preferenceBuilder as any);

    const result = await currencyPreferenceService.getUserCurrencyOrder();

    const remaining = getCurrencyCodes().filter(
      (code) => !['EUR', 'USD'].includes(code),
    );

    expect(result).toEqual(['EUR', 'USD', ...remaining]);
  });

  it('updates currency order with the selected currency first', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { currency_order: ['EUR', 'USD', 'GBP'] },
        error: null,
      }),
    };

    const existingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pref-1' }, error: null }),
    };

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      if (callCount === 2) {
        return existingBuilder as any;
      }
      return updateBuilder as any;
    });

    await currencyPreferenceService.updateCurrencyOrder('GBP');

    const allCodes = getCurrencyCodes();
    const currentOrder = ['EUR', 'USD', 'GBP', ...allCodes.filter((code) => !['EUR', 'USD', 'GBP'].includes(code))];
    const expectedOrder = ['GBP', ...currentOrder.filter((code) => code !== 'GBP')];

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        currency_order: expectedOrder,
        updated_at: expect.any(String),
      }),
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
  });

  it('does nothing when updating order without a user', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await currencyPreferenceService.updateCurrencyOrder('USD');

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('logs an error when updating currency preferences fails', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { currency_order: ['USD', 'EUR'] },
        error: null,
      }),
    };

    const existingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { id: 'pref-1' },
        error: null,
      }),
    };

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: new Error('Update failed') }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      if (callCount === 2) {
        return existingBuilder as any;
      }
      return updateBuilder as any;
    });

    await currencyPreferenceService.updateCurrencyOrder('EUR');

    expect(console.error).toHaveBeenCalled();
  });

  it('updates group currency when it is not already first', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { currency_order: ['USD', 'EUR'] },
        error: null,
      }),
    };

    const existingBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'pref-1' }, error: null }),
    };

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      if (callCount === 2) {
        return preferenceBuilder as any;
      }
      if (callCount === 3) {
        return existingBuilder as any;
      }
      return updateBuilder as any;
    });

    await currencyPreferenceService.ensureGroupCurrencyInOrder('EUR');

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        currency_order: expect.arrayContaining(['EUR']),
        updated_at: expect.any(String),
      }),
    );
  });

  it('skips updating when group currency is already first', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { currency_order: ['USD', 'EUR'] },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(preferenceBuilder as any);

    await currencyPreferenceService.ensureGroupCurrencyInOrder('USD');

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });
});
