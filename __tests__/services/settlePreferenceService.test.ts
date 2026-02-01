import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createMockSupabaseClient,
  createMockUser,
  resetAllMocks,
  MockSupabaseClient,
} from '@/__tests__/utils/mockSupabase';
import {
  getSettleSimplifyPreference,
  setSettleSimplifyPreference,
} from '@/services/settlePreferenceService';

jest.mock('@/lib/supabase', () => ({
  supabase: null,
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;

describe('settlePreferenceService', () => {
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
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue();
  });

  afterEach(() => {
    resetAllMocks(mockSupabase);
    jest.restoreAllMocks();
  });

  it('returns default when no user is signed in', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await getSettleSimplifyPreference();

    expect(result).toBe(true);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns cached preference when present', async () => {
    const mockUser = createMockUser({ id: 'user-1' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    storage.getItem.mockResolvedValueOnce('false');

    const result = await getSettleSimplifyPreference();

    expect(result).toBe(false);
  });

  it('reads preference from db when cache is empty', async () => {
    const mockUser = createMockUser({ id: 'user-2' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { simplify_debts: false },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(preferenceBuilder as any);

    const result = await getSettleSimplifyPreference();

    expect(result).toBe(false);
    expect(storage.setItem).toHaveBeenCalled();
  });

  it('creates default preference when none exists', async () => {
    const mockUser = createMockUser({ id: 'user-3' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };

    const upsertBuilder = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      return upsertBuilder as any;
    });

    const result = await getSettleSimplifyPreference();

    expect(result).toBe(true);
    expect(upsertBuilder.upsert).toHaveBeenCalled();
  });

  it('stores preference in db and cache', async () => {
    const mockUser = createMockUser({ id: 'user-4' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const upsertBuilder = {
      upsert: jest.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase.from.mockReturnValue(upsertBuilder as any);

    await setSettleSimplifyPreference(false);

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: mockUser.id,
        simplify_debts: false,
      }),
      { onConflict: 'user_id' },
    );
    expect(storage.setItem).toHaveBeenCalled();
  });
});
