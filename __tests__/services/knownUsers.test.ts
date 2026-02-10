import {
  createMockSupabaseClient,
  createMockSession,
  resetAllMocks,
  MockSupabaseClient,
} from '../utils/mockSupabase';

jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;

describe('Known Users functionality', () => {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;

  beforeAll(() => {
    console.error = jest.fn();
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
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
    jest.resetModules();
  });

  describe('getKnownUsers', () => {
    it('should return empty array if no authenticated user', async () => {
      const { getKnownUsers } = require('../../services/groupRepository');

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await getKnownUsers();

      expect(result).toEqual([]);
    });

    it('should fetch known users for authenticated user', async () => {
      const { getKnownUsers } = require('../../services/groupRepository');

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession({ id: 'user-123' }) },
        error: null,
      });

      const mockKnownUsers = [
        {
          known_user_id: 'user-456',
          users: {
            id: 'user-456',
            name: 'Alice',
            email: 'alice@example.com',
          },
        },
        {
          known_user_id: 'user-789',
          users: {
            id: 'user-789',
            name: 'Bob',
            email: 'bob@example.com',
          },
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: mockKnownUsers,
          error: null,
        }),
      } as any);

      const result = await getKnownUsers();

      expect(result).toEqual([
        {
          id: 'user-456',
          name: 'Alice',
          email: 'alice@example.com',
        },
        {
          id: 'user-789',
          name: 'Bob',
          email: 'bob@example.com',
        },
      ]);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_known_users');
    });

    it('should handle errors gracefully', async () => {
      const { getKnownUsers } = require('../../services/groupRepository');

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: createMockSession({ id: 'user-123' }) },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Database error'),
        }),
      } as any);

      const result = await getKnownUsers();

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('updateKnownUsersForMember', () => {
    it('should return false if no session token', async () => {
      const {
        updateKnownUsersForMember,
      } = require('../../services/groupRepository');

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await updateKnownUsersForMember('group-123', 'member-456');

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should invoke edge function with correct parameters', async () => {
      const {
        updateKnownUsersForMember,
      } = require('../../services/groupRepository');

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
          },
        },
        error: null,
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await updateKnownUsersForMember('group-123', 'member-456');

      expect(result).toBe(true);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'update-known-users',
        {
          body: { groupId: 'group-123', newMemberId: 'member-456' },
          headers: {
            Authorization: 'Bearer mock-token',
          },
        },
      );
    });

    it('should return false on edge function error', async () => {
      const {
        updateKnownUsersForMember,
      } = require('../../services/groupRepository');

      mockSupabase.auth.getSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
          },
        },
        error: null,
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: new Error('Edge function error'),
      });

      const result = await updateKnownUsersForMember('group-123', 'member-456');

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalled();
    });
  });
});
