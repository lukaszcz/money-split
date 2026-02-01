import {
  createMockSupabaseClient,
  createMockUser,
  resetAllMocks,
  MockSupabaseClient,
} from '@/__tests__/utils/mockSupabase';
import * as groupPreferenceService from '@/services/groupPreferenceService';
import type { GroupWithMembers } from '@/services/groupRepository';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@/lib/supabase', () => ({
  supabase: null,
}));

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('groupPreferenceService', () => {
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

  it('returns empty preferences when no user is signed in', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await groupPreferenceService.getGroupPreferences();

    expect(result).toEqual([]);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns cached preferences without fetching from the database', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });
    storage.getItem.mockResolvedValueOnce('["group-1","group-2"]');

    const result = await groupPreferenceService.getGroupPreferences();

    expect(result).toEqual(['group-1', 'group-2']);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns empty preferences on error', async () => {
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

    const result = await groupPreferenceService.getGroupPreferences();

    expect(result).toEqual([]);
  });

  it('records a group visit by placing the group first', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-2', 'group-1'] },
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

    await groupPreferenceService.recordGroupVisit('group-1');

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      {
        user_id: mockUser.id,
        group_order: ['group-1', 'group-2'],
        updated_at: expect.any(String),
      },
      { onConflict: 'user_id' },
    );
  });

  it('skips recording a visit when no user is signed in', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await groupPreferenceService.recordGroupVisit('group-1');

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('logs an error when recording a visit fails', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-2'] },
        error: null,
      }),
    };

    const upsertBuilder = {
      upsert: jest
        .fn()
        .mockResolvedValue({ error: new Error('Upsert failed') }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      return upsertBuilder as any;
    });

    await groupPreferenceService.recordGroupVisit('group-1');

    expect(console.error).toHaveBeenCalled();
  });

  it('cleans up preferences when groups are removed', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-1', 'group-2', 'group-3'] },
        error: null,
      }),
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
      return updateBuilder as any;
    });

    await groupPreferenceService.cleanupGroupPreferences([
      'group-1',
      'group-3',
    ]);

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        group_order: ['group-1', 'group-3'],
        updated_at: expect.any(String),
      }),
    );
    expect(updateBuilder.eq).toHaveBeenCalledWith('user_id', mockUser.id);
  });

  it('skips cleanup when no user is signed in', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await groupPreferenceService.cleanupGroupPreferences(['group-1']);

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('does not update preferences when no cleanup is needed', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-1', 'group-2'] },
        error: null,
      }),
    };

    mockSupabase.from.mockReturnValue(preferenceBuilder as any);

    await groupPreferenceService.cleanupGroupPreferences([
      'group-1',
      'group-2',
    ]);

    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });

  it('logs and skips cache update when cleanup update fails', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-1', 'group-2', 'group-3'] },
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
      return updateBuilder as any;
    });

    await groupPreferenceService.cleanupGroupPreferences(['group-1']);

    expect(console.error).toHaveBeenCalled();
  });

  it('orders new groups ahead of saved preferences', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-3'] },
        error: null,
      }),
    };

    const cleanupPreferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-3'] },
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
      if (callCount === 2) {
        return cleanupPreferenceBuilder as any;
      }
      return upsertBuilder as any;
    });

    const groups: GroupWithMembers[] = [
      {
        id: 'group-1',
        name: 'Alpha',
        mainCurrencyCode: 'USD',
        createdAt: '2024-01-01T00:00:00Z',
        members: [],
      },
      {
        id: 'group-2',
        name: 'Beta',
        mainCurrencyCode: 'USD',
        createdAt: '2024-03-01T00:00:00Z',
        members: [],
      },
      {
        id: 'group-3',
        name: 'Gamma',
        mainCurrencyCode: 'USD',
        createdAt: '2023-12-01T00:00:00Z',
        members: [],
      },
    ];

    const result = await groupPreferenceService.getOrderedGroups(groups);

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      {
        user_id: mockUser.id,
        group_order: ['group-2', 'group-1', 'group-3'],
        updated_at: expect.any(String),
      },
      { onConflict: 'user_id' },
    );

    expect(result.map((group) => group.id)).toEqual([
      'group-2',
      'group-1',
      'group-3',
    ]);
  });

  it('keeps stored order when there are no new groups', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-2', 'group-1'] },
        error: null,
      }),
    };

    const cleanupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-2', 'group-1'] },
        error: null,
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      return cleanupBuilder as any;
    });

    const groups: GroupWithMembers[] = [
      {
        id: 'group-1',
        name: 'Alpha',
        mainCurrencyCode: 'USD',
        createdAt: '2024-01-01T00:00:00Z',
        members: [],
      },
      {
        id: 'group-2',
        name: 'Beta',
        mainCurrencyCode: 'USD',
        createdAt: '2024-02-01T00:00:00Z',
        members: [],
      },
    ];

    const result = await groupPreferenceService.getOrderedGroups(groups);

    expect(result.map((group) => group.id)).toEqual(['group-2', 'group-1']);
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
  });

  it('skips upsert when new groups exist but user is not available', async () => {
    const mockUser = createMockUser({ id: 'user-123' });
    mockSupabase.auth.getUser
      .mockResolvedValueOnce({ data: { user: mockUser }, error: null })
      .mockResolvedValueOnce({ data: { user: mockUser }, error: null })
      .mockResolvedValueOnce({ data: { user: mockUser }, error: null })
      .mockResolvedValueOnce({ data: { user: null }, error: null });

    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-3'] },
        error: null,
      }),
    };

    const cleanupBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({
        data: { group_order: ['group-3'] },
        error: null,
      }),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return preferenceBuilder as any;
      }
      return cleanupBuilder as any;
    });

    const groups: GroupWithMembers[] = [
      {
        id: 'group-1',
        name: 'Alpha',
        mainCurrencyCode: 'USD',
        createdAt: '2024-01-01T00:00:00Z',
        members: [],
      },
      {
        id: 'group-3',
        name: 'Gamma',
        mainCurrencyCode: 'USD',
        createdAt: '2023-12-01T00:00:00Z',
        members: [],
      },
    ];

    const result = await groupPreferenceService.getOrderedGroups(groups);

    expect(result.map((group) => group.id)).toEqual(['group-1', 'group-3']);
    expect(mockSupabase.from).toHaveBeenCalledTimes(2);
  });

  it('returns an empty array when no groups are provided', async () => {
    const result = await groupPreferenceService.getOrderedGroups([]);

    expect(result).toEqual([]);
  });

  it('returns null when refreshGroupPreferencesForUser fails', async () => {
    const preferenceBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest
        .fn()
        .mockResolvedValue({ data: null, error: new Error('Fail') }),
    };

    mockSupabase.from.mockReturnValue(preferenceBuilder as any);

    const result =
      await groupPreferenceService.refreshGroupPreferencesForUser('user-123');

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
