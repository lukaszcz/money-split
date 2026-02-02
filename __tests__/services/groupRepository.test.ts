import {
  createMockSupabaseClient,
  createMockUser,
  createMockSession,
  resetAllMocks,
  MockSupabaseClient,
} from '../utils/mockSupabase';
import {
  mockUsers,
  mockGroups,
  mockMembers,
  createMockDatabaseRow,
} from '../fixtures/testData';

jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;

describe('groupRepository', () => {
  // Suppress expected console output during tests
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  beforeAll(() => {
    console.error = jest.fn();
    console.log = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    supabaseModule = require('../../lib/supabase');
    supabaseModule.supabase = mockSupabase;
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: createMockSession() },
      error: null,
    });
  });

  afterEach(() => {
    resetAllMocks(mockSupabase);
    jest.resetModules();
  });

  describe('ensureUserProfile', () => {
    it('should return existing user if already exists', async () => {
      const { ensureUserProfile } = require('../../services/groupRepository');
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDbUser = createMockDatabaseRow(mockUsers.alice);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockDbUser,
          error: null,
        }),
      } as any);

      const result = await ensureUserProfile();

      expect(result).toEqual(mockUsers.alice);
      expect(mockSupabase.auth.getUser).toHaveBeenCalled();
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });

    it('should create new user if not exists', async () => {
      const { ensureUserProfile } = require('../../services/groupRepository');
      const mockUser = createMockUser({
        id: 'user-new',
        email: 'new@example.com',
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-new',
            name: 'new',
            email: 'new@example.com',
            created_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      };

      const reconnectBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getUserBuilder as any;
        if (callCount === 2) return insertBuilder as any;
        return reconnectBuilder as any;
      });

      const result = await ensureUserProfile();

      expect(result).toEqual({
        id: 'user-new',
        name: 'new',
        email: 'new@example.com',
        createdAt: '2024-01-01T00:00:00Z',
      });
      expect(insertBuilder.insert).toHaveBeenCalledWith({
        id: 'user-new',
        name: 'new',
        email: 'new@example.com',
      });
    });

    it('should return null when no authenticated user', async () => {
      const { ensureUserProfile } = require('../../services/groupRepository');

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await ensureUserProfile();

      expect(result).toBeNull();
    });

    it('should use custom name when provided', async () => {
      const { ensureUserProfile } = require('../../services/groupRepository');
      const mockUser = createMockUser({
        id: 'user-new',
        email: 'new@example.com',
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-new',
            name: 'Custom Name',
            email: 'new@example.com',
            created_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      };

      const reconnectBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getUserBuilder as any;
        if (callCount === 2) return insertBuilder as any;
        return reconnectBuilder as any;
      });

      await ensureUserProfile('Custom Name');

      expect(insertBuilder.insert).toHaveBeenCalledWith({
        id: 'user-new',
        name: 'Custom Name',
        email: 'new@example.com',
      });
    });

    it('should fall back to default name and null email when missing', async () => {
      const { ensureUserProfile } = require('../../services/groupRepository');
      const mockUser = createMockUser({
        id: 'user-no-email',
        email: undefined,
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      const insertBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'user-no-email',
            name: 'User',
            email: null,
            created_at: '2024-01-01T00:00:00Z',
          },
          error: null,
        }),
      };

      const reconnectBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return getUserBuilder as any;
        if (callCount === 2) return insertBuilder as any;
        return reconnectBuilder as any;
      });

      const result = await ensureUserProfile();

      expect(insertBuilder.insert).toHaveBeenCalledWith({
        id: 'user-no-email',
        name: 'User',
        email: null,
      });
      expect(result).toEqual({
        id: 'user-no-email',
        name: 'User',
        email: undefined,
        createdAt: '2024-01-01T00:00:00Z',
      });
    });
  });

  describe('getUser', () => {
    it('should return user when found', async () => {
      const { getUser } = require('../../services/groupRepository');

      const mockDbUser = createMockDatabaseRow(mockUsers.alice);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockDbUser,
          error: null,
        }),
      } as any);

      const result = await getUser('user-alice');

      expect(result).toEqual(mockUsers.alice);
    });

    it('should return null when user not found', async () => {
      const { getUser } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      const result = await getUser('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on lookup error', async () => {
      const { getUser } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lookup failed'),
        }),
      } as any);

      const result = await getUser('user-alice');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should return user when found', async () => {
      const { getUserByEmail } = require('../../services/groupRepository');

      const mockDbUser = createMockDatabaseRow(mockUsers.bob);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockDbUser,
          error: null,
        }),
      } as any);

      const result = await getUserByEmail('bob@example.com');

      expect(result).toEqual(mockUsers.bob);
    });

    it('should return null on error', async () => {
      const { getUserByEmail } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lookup failed'),
        }),
      } as any);

      const result = await getUserByEmail('bob@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateUserName', () => {
    it('should update user name', async () => {
      const { updateUserName } = require('../../services/groupRepository');

      const mockDbUser = createMockDatabaseRow({
        ...mockUsers.alice,
        name: 'Updated Name',
      });

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockDbUser,
          error: null,
        }),
      } as any);

      const result = await updateUserName('user-alice', 'Updated Name');

      expect(result).toEqual({
        ...mockUsers.alice,
        name: 'Updated Name',
      });
    });

    it('should return null on update error', async () => {
      const { updateUserName } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Update failed'),
        }),
      } as any);

      const result = await updateUserName('user-alice', 'Updated Name');

      expect(result).toBeNull();
    });
  });

  describe('createGroupMember', () => {
    it('should create a group member', async () => {
      const { createGroupMember } = require('../../services/groupRepository');

      const mockDbMember = createMockDatabaseRow(mockMembers.aliceInTrip);
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: mockDbMember,
          error: null,
        }),
      } as any);

      const result = await createGroupMember(
        'group-trip',
        'Alice',
        'alice@example.com',
        'user-alice',
      );

      expect(result).toEqual(mockMembers.aliceInTrip);
    });

    it('should return null when creation fails', async () => {
      const { createGroupMember } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Insert failed'),
        }),
      } as any);

      const result = await createGroupMember('group-trip', 'Alice');

      expect(result).toBeNull();
    });
  });

  describe('getGroupMembers', () => {
    it('should map group members', async () => {
      const { getGroupMembers } = require('../../services/groupRepository');

      const mockDbMembers = [
        createMockDatabaseRow(mockMembers.aliceInTrip),
        createMockDatabaseRow(mockMembers.unconnectedInTrip),
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest
          .fn()
          .mockResolvedValue({ data: mockDbMembers, error: null }),
      } as any);

      const result = await getGroupMembers('group-trip');

      expect(result).toEqual([
        mockMembers.aliceInTrip,
        mockMembers.unconnectedInTrip,
      ]);
    });

    it('should return empty array when no members are found', async () => {
      const { getGroupMembers } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const result = await getGroupMembers('group-trip');

      expect(result).toEqual([]);
    });

    it('should map members with missing contact info', async () => {
      const { getGroupMembers } = require('../../services/groupRepository');

      const memberRow = {
        ...createMockDatabaseRow(mockMembers.unconnectedInTrip),
        email: null,
        connected_user_id: null,
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [memberRow],
          error: null,
        }),
      } as any);

      const result = await getGroupMembers('group-trip');

      expect(result).toEqual([
        {
          ...mockMembers.unconnectedInTrip,
          email: undefined,
          connectedUserId: undefined,
        },
      ]);
    });

    it('should return null on error', async () => {
      const { getGroupMembers } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Fetch failed'),
        }),
      } as any);

      const result = await getGroupMembers('group-trip');

      expect(result).toBeNull();
    });
  });

  describe('getGroupMember', () => {
    it('should return group member when found', async () => {
      const { getGroupMember } = require('../../services/groupRepository');

      const mockDbMember = createMockDatabaseRow(mockMembers.bobInTrip);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockDbMember,
          error: null,
        }),
      } as any);

      const result = await getGroupMember('member-bob-trip');

      expect(result).toEqual(mockMembers.bobInTrip);
    });

    it('should return null when member not found', async () => {
      const { getGroupMember } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const result = await getGroupMember('missing-member');

      expect(result).toBeNull();
    });

    it('should return null on lookup error', async () => {
      const { getGroupMember } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lookup failed'),
        }),
      } as any);

      const result = await getGroupMember('member-error');

      expect(result).toBeNull();
    });
  });

  describe('getCurrentUserMemberInGroup', () => {
    it('should return null when no authenticated user', async () => {
      const {
        getCurrentUserMemberInGroup,
      } = require('../../services/groupRepository');

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await getCurrentUserMemberInGroup('group-trip');

      expect(result).toBeNull();
    });

    it('should return member connected to current user', async () => {
      const {
        getCurrentUserMemberInGroup,
      } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDbMember = createMockDatabaseRow(mockMembers.aliceInTrip);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockDbMember,
          error: null,
        }),
      } as any);

      const result = await getCurrentUserMemberInGroup('group-trip');

      expect(result).toEqual(mockMembers.aliceInTrip);
    });

    it('should return null on lookup error', async () => {
      const {
        getCurrentUserMemberInGroup,
      } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lookup failed'),
        }),
      } as any);

      const result = await getCurrentUserMemberInGroup('group-trip');

      expect(result).toBeNull();
    });
  });

  describe('connectUserToGroupMembers', () => {
    it('should return number of connected members', async () => {
      const {
        connectUserToGroupMembers,
      } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [createMockDatabaseRow(mockMembers.unconnectedInTrip)],
          error: null,
        }),
      } as any);

      const result = await connectUserToGroupMembers(
        'user-alice',
        'dave@example.com',
      );

      expect(result).toBe(1);
    });

    it('should return 0 when no members are updated', async () => {
      const {
        connectUserToGroupMembers,
      } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      const result = await connectUserToGroupMembers(
        'user-alice',
        'dave@example.com',
      );

      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      const {
        connectUserToGroupMembers,
      } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Update failed'),
        }),
      } as any);

      const result = await connectUserToGroupMembers(
        'user-alice',
        'dave@example.com',
      );

      expect(result).toBe(0);
    });
  });

  describe('createGroup', () => {
    it('should create group with creator as first member', async () => {
      const { createGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser(mockUsers.alice);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDbUser = createMockDatabaseRow(mockUsers.alice);
      const mockDbGroup = createMockDatabaseRow(mockGroups.trip);

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: mockDbUser, error: null }),
      };

      const insertGroupBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockDbGroup, error: null }),
      };

      const insertMemberBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createMockDatabaseRow(mockMembers.aliceInTrip),
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'users') return getUserBuilder as any;
        if (table === 'groups') return insertGroupBuilder as any;
        if (table === 'group_members') return insertMemberBuilder as any;
        return {} as any;
      });

      const result = await createGroup('Weekend Trip', 'USD', []);

      expect(result).toEqual(mockGroups.trip);
      expect(insertGroupBuilder.insert).toHaveBeenCalledWith({
        name: 'Weekend Trip',
        main_currency_code: 'USD',
      });
      expect(insertMemberBuilder.insert).toHaveBeenCalled();
    });

    it('should add initial members to the group', async () => {
      const { createGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser(mockUsers.alice);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDbUser = createMockDatabaseRow(mockUsers.alice);
      const mockDbGroup = createMockDatabaseRow(mockGroups.trip);
      const mockDbBob = createMockDatabaseRow(mockUsers.bob);

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValueOnce({ data: mockDbUser, error: null })
          .mockResolvedValueOnce({ data: mockDbBob, error: null }),
      };

      const insertGroupBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockDbGroup, error: null }),
      };

      const insertMemberBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createMockDatabaseRow(mockMembers.bobInTrip),
          error: null,
        }),
      };

      let memberInsertCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return getUserBuilder as any;
        if (table === 'groups') return insertGroupBuilder as any;
        if (table === 'group_members') {
          memberInsertCount++;
          return insertMemberBuilder as any;
        }
        return {} as any;
      });

      await createGroup('Weekend Trip', 'USD', [
        { name: 'Bob', email: 'bob@example.com' },
      ]);

      expect(memberInsertCount).toBe(2);
    });

    it('should return null when no authenticated user', async () => {
      const { createGroup } = require('../../services/groupRepository');

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await createGroup('Test Group', 'USD', []);

      expect(result).toBeNull();
    });

    it('uses email prefix or Unknown when member names are missing', async () => {
      const { createGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser(mockUsers.alice);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDbUser = createMockDatabaseRow(mockUsers.alice);
      const mockDbGroup = createMockDatabaseRow(mockGroups.trip);

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValueOnce({ data: mockDbUser, error: null })
          .mockResolvedValueOnce({ data: null, error: null }),
      };

      const insertGroupBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockDbGroup, error: null }),
      };

      const insertMemberBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createMockDatabaseRow(mockMembers.aliceInTrip),
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return getUserBuilder as any;
        if (table === 'groups') return insertGroupBuilder as any;
        if (table === 'group_members') return insertMemberBuilder as any;
        return {} as any;
      });

      const result = await createGroup('Weekend Trip', 'USD', [
        { name: '', email: 'bob@example.com' },
        { name: '' },
      ]);

      expect(result).toEqual(mockGroups.trip);

      const insertedMembers = insertMemberBuilder.insert.mock.calls.map(
        (call) => call[0],
      );

      expect(insertedMembers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'bob',
            email: 'bob@example.com',
            connected_user_id: null,
          }),
          expect.objectContaining({
            name: 'Unknown',
            email: null,
            connected_user_id: null,
          }),
        ]),
      );
    });

    it('returns the group even if creator member creation fails', async () => {
      const { createGroup } = require('../../services/groupRepository');
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const mockUser = createMockUser(mockUsers.alice);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDbUser = createMockDatabaseRow(mockUsers.alice);
      const mockDbGroup = createMockDatabaseRow(mockGroups.trip);

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: mockDbUser, error: null }),
      };

      const insertGroupBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockDbGroup, error: null }),
      };

      const insertMemberBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Insert failed'),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return getUserBuilder as any;
        if (table === 'groups') return insertGroupBuilder as any;
        if (table === 'group_members') return insertMemberBuilder as any;
        return {} as any;
      });

      const result = await createGroup('Weekend Trip', 'USD', []);

      expect(result).toEqual(mockGroups.trip);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should return null when ensuring user profile fails', async () => {
      const { createGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser(mockUsers.alice);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lookup failed'),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return getUserBuilder as any;
        return {} as any;
      });

      const result = await createGroup('Test Group', 'USD', []);

      expect(result).toBeNull();
    });

    it('should return null when group creation fails', async () => {
      const { createGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser(mockUsers.alice);

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const mockDbUser = createMockDatabaseRow(mockUsers.alice);

      const getUserBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: mockDbUser, error: null }),
      };

      const insertGroupBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Insert failed'),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return getUserBuilder as any;
        if (table === 'groups') return insertGroupBuilder as any;
        return {} as any;
      });

      const result = await createGroup('Weekend Trip', 'USD', []);

      expect(result).toBeNull();
    });
  });

  describe('getGroup', () => {
    it('should return group with members', async () => {
      const { getGroup } = require('../../services/groupRepository');

      const mockDbGroup = createMockDatabaseRow(mockGroups.trip);
      const mockDbMembers = [
        createMockDatabaseRow(mockMembers.aliceInTrip),
        createMockDatabaseRow(mockMembers.bobInTrip),
      ];

      const groupBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest
          .fn()
          .mockResolvedValue({ data: mockDbGroup, error: null }),
      };

      const membersBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest
          .fn()
          .mockResolvedValue({ data: mockDbMembers, error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'groups') return groupBuilder as any;
        if (table === 'group_members') return membersBuilder as any;
        return {} as any;
      });

      const result = await getGroup('group-trip');

      expect(result).toEqual({
        ...mockGroups.trip,
        members: [mockMembers.aliceInTrip, mockMembers.bobInTrip],
      });
    });

    it('should return null when group not found', async () => {
      const { getGroup } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const result = await getGroup('nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on lookup error', async () => {
      const { getGroup } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lookup failed'),
        }),
      } as any);

      const result = await getGroup('group-error');

      expect(result).toBeNull();
    });
  });

  describe('getAllGroups', () => {
    it('should map groups and sort members by creation time', async () => {
      const { getAllGroups } = require('../../services/groupRepository');

      const olderMember = {
        ...mockMembers.aliceInTrip,
        createdAt: '2024-01-01T00:00:00Z',
      };
      const newerMember = {
        ...mockMembers.bobInTrip,
        createdAt: '2024-02-01T00:00:00Z',
      };

      const mockDbGroup = {
        ...createMockDatabaseRow(mockGroups.trip),
        group_members: [
          createMockDatabaseRow(newerMember),
          createMockDatabaseRow(olderMember),
        ],
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockDbGroup],
          error: null,
        }),
      } as any);

      const result = await getAllGroups();

      expect(result).toEqual([
        {
          ...mockGroups.trip,
          members: [olderMember, newerMember],
        },
      ]);
    });

    it('should handle groups with no members', async () => {
      const { getAllGroups } = require('../../services/groupRepository');

      const mockDbGroup = {
        ...createMockDatabaseRow(mockGroups.trip),
        group_members: null,
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockDbGroup],
          error: null,
        }),
      } as any);

      const result = await getAllGroups();

      expect(result).toEqual([
        {
          ...mockGroups.trip,
          members: [],
        },
      ]);
    });

    it('should map members without contact info', async () => {
      const { getAllGroups } = require('../../services/groupRepository');

      const memberRow = {
        id: 'member-guest',
        group_id: 'group-trip',
        name: 'Guest',
        email: null,
        connected_user_id: null,
        created_at: '2024-01-03T00:00:00Z',
      };

      const mockDbGroup = {
        ...createMockDatabaseRow(mockGroups.trip),
        group_members: [memberRow],
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockDbGroup],
          error: null,
        }),
      } as any);

      const result = await getAllGroups();

      expect(result).toEqual([
        {
          ...mockGroups.trip,
          members: [
            {
              id: 'member-guest',
              groupId: 'group-trip',
              name: 'Guest',
              email: undefined,
              connectedUserId: undefined,
              createdAt: '2024-01-03T00:00:00Z',
            },
          ],
        },
      ]);
    });

    it('should return empty array when no groups exist', async () => {
      const { getAllGroups } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      const result = await getAllGroups();

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const { getAllGroups } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Fetch failed'),
        }),
      } as any);

      const result = await getAllGroups();

      expect(result).toEqual([]);
    });
  });

  describe('createExpense', () => {
    it('should create expense with shares', async () => {
      const { createExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-1',
        group_id: 'group-trip',
        description: 'Dinner',
        date_time: '2024-01-15T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 120000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 120000,
        created_at: '2024-01-15T20:00:00Z',
        payment_type: 'expense',
        split_type: 'equal',
      };

      const expenseBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const sharesBuilder = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return expenseBuilder as any;
        if (table === 'expense_shares') return sharesBuilder as any;
        return {} as any;
      });

      const shares = [
        {
          memberId: 'member-alice-trip',
          shareAmountScaled: BigInt(40000),
          shareInMainScaled: BigInt(40000),
        },
        {
          memberId: 'member-bob-trip',
          shareAmountScaled: BigInt(40000),
          shareInMainScaled: BigInt(40000),
        },
        {
          memberId: 'member-charlie-trip',
          shareAmountScaled: BigInt(40000),
          shareInMainScaled: BigInt(40000),
        },
      ];

      const result = await createExpense(
        'group-trip',
        'Dinner',
        '2024-01-15T19:00:00Z',
        'USD',
        BigInt(120000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(120000),
        shares,
      );

      expect(result).toBeTruthy();
      expect(result?.id).toBe('expense-1');
      expect(expenseBuilder.insert).toHaveBeenCalled();
      expect(sharesBuilder.insert).toHaveBeenCalledWith([
        {
          expense_id: 'expense-1',
          member_id: 'member-alice-trip',
          share_amount_scaled: 40000,
          share_in_main_scaled: 40000,
        },
        {
          expense_id: 'expense-1',
          member_id: 'member-bob-trip',
          share_amount_scaled: 40000,
          share_in_main_scaled: 40000,
        },
        {
          expense_id: 'expense-1',
          member_id: 'member-charlie-trip',
          share_amount_scaled: 40000,
          share_in_main_scaled: 40000,
        },
      ]);
    });

    it('should handle transfer payment type', async () => {
      const { createExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-transfer',
        group_id: 'group-trip',
        description: 'Payment',
        date_time: '2024-01-16T10:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 50000,
        payer_member_id: 'member-bob-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 50000,
        created_at: '2024-01-16T10:00:00Z',
        payment_type: 'transfer',
        split_type: 'exact',
      };

      const expenseBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const sharesBuilder = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return expenseBuilder as any;
        if (table === 'expense_shares') return sharesBuilder as any;
        return {} as any;
      });

      const result = await createExpense(
        'group-trip',
        'Payment',
        '2024-01-16T10:00:00Z',
        'USD',
        BigInt(50000),
        'member-bob-trip',
        BigInt(10000),
        BigInt(50000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(50000),
            shareInMainScaled: BigInt(50000),
          },
        ],
        'transfer',
        'exact',
      );

      expect(result?.paymentType).toBe('transfer');
      expect(result?.splitType).toBe('exact');
    });

    it('should default optional fields when missing', async () => {
      const { createExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-nulls',
        group_id: 'group-trip',
        description: null,
        date_time: '2024-01-20T12:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 25000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 25000,
        created_at: '2024-01-20T12:05:00Z',
        payment_type: null,
        split_type: null,
      };

      const expenseBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const sharesBuilder = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return expenseBuilder as any;
        if (table === 'expense_shares') return sharesBuilder as any;
        return {} as any;
      });

      const result = await createExpense(
        'group-trip',
        undefined,
        '2024-01-20T12:00:00Z',
        'USD',
        BigInt(25000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(25000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(25000),
            shareInMainScaled: BigInt(25000),
          },
        ],
      );

      expect(expenseBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ description: null }),
      );
      expect(result?.description).toBeUndefined();
      expect(result?.paymentType).toBe('expense');
      expect(result?.splitType).toBe('equal');
    });

    it('should return null when share insertion fails', async () => {
      const { createExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-2',
        group_id: 'group-trip',
        description: 'Lunch',
        date_time: '2024-01-18T12:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 30000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 30000,
        created_at: '2024-01-18T12:30:00Z',
        payment_type: 'expense',
        split_type: 'equal',
      };

      const expenseBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const sharesBuilder = {
        insert: jest.fn().mockResolvedValue({
          error: new Error('Share insert failed'),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return expenseBuilder as any;
        if (table === 'expense_shares') return sharesBuilder as any;
        return {} as any;
      });

      const result = await createExpense(
        'group-trip',
        'Lunch',
        '2024-01-18T12:00:00Z',
        'USD',
        BigInt(30000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(30000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(30000),
            shareInMainScaled: BigInt(30000),
          },
        ],
      );

      expect(result).toBeNull();
    });

    it('should return null when expense creation fails', async () => {
      const { createExpense } = require('../../services/groupRepository');

      const expenseBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: null, error: new Error('Insert failed') }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return expenseBuilder as any;
        return {} as any;
      });

      const result = await createExpense(
        'group-trip',
        'Dinner',
        '2024-01-15T19:00:00Z',
        'USD',
        BigInt(120000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(120000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(120000),
            shareInMainScaled: BigInt(120000),
          },
        ],
      );

      expect(result).toBeNull();
    });
  });

  describe('getGroupExpenses', () => {
    it('should map expenses with shares', async () => {
      const { getGroupExpenses } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-1',
        group_id: 'group-trip',
        description: null,
        date_time: '2024-01-15T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 120000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 120000,
        created_at: '2024-01-15T20:00:00Z',
        payment_type: null,
        split_type: null,
        expense_shares: [
          {
            id: 'share-1',
            member_id: 'member-alice-trip',
            share_amount_scaled: 60000,
            share_in_main_scaled: 60000,
          },
        ],
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: [mockDbExpense],
          error: null,
        }),
      } as any);

      const result = await getGroupExpenses('group-trip');

      expect(result).toEqual([
        {
          id: 'expense-1',
          groupId: 'group-trip',
          description: undefined,
          dateTime: '2024-01-15T19:00:00Z',
          currencyCode: 'USD',
          totalAmountScaled: BigInt(120000),
          payerMemberId: 'member-alice-trip',
          exchangeRateToMainScaled: BigInt(10000),
          totalInMainScaled: BigInt(120000),
          createdAt: '2024-01-15T20:00:00Z',
          paymentType: 'expense',
          splitType: 'equal',
          shares: [
            {
              id: 'share-1',
              memberId: 'member-alice-trip',
              shareAmountScaled: BigInt(60000),
              shareInMainScaled: BigInt(60000),
            },
          ],
        },
      ]);
    });

    it('should return empty array when no expenses exist', async () => {
      const { getGroupExpenses } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      } as any);

      const result = await getGroupExpenses('group-trip');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      const { getGroupExpenses } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Fetch failed'),
        }),
      } as any);

      const result = await getGroupExpenses('group-trip');

      expect(result).toEqual([]);
    });
  });

  describe('getExpense', () => {
    it('should return expense with shares', async () => {
      const { getExpense } = require('../../services/groupRepository');

      const mockExpense = {
        id: 'expense-1',
        group_id: 'group-trip',
        description: 'Dinner',
        date_time: '2024-01-15T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 120000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 120000,
        created_at: '2024-01-15T20:00:00Z',
        payment_type: 'expense',
        split_type: 'equal',
      };

      const expenseBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockExpense,
          error: null,
        }),
      };

      const sharesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'share-1',
              member_id: 'member-alice-trip',
              share_amount_scaled: 120000,
              share_in_main_scaled: 120000,
            },
          ],
          error: null,
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'expenses') return expenseBuilder as any;
        if (table === 'expense_shares') return sharesBuilder as any;
        return {} as any;
      });

      const result = await getExpense('expense-1');

      expect(result).toEqual({
        id: 'expense-1',
        groupId: 'group-trip',
        description: 'Dinner',
        dateTime: '2024-01-15T19:00:00Z',
        currencyCode: 'USD',
        totalAmountScaled: BigInt(120000),
        payerMemberId: 'member-alice-trip',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(120000),
        createdAt: '2024-01-15T20:00:00Z',
        paymentType: 'expense',
        splitType: 'equal',
        shares: [
          {
            id: 'share-1',
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(120000),
            shareInMainScaled: BigInt(120000),
          },
        ],
      });
    });

    it('should default optional fields when missing', async () => {
      const { getExpense } = require('../../services/groupRepository');

      const mockExpense = {
        id: 'expense-optional',
        group_id: 'group-trip',
        description: null,
        date_time: '2024-01-17T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 5000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 5000,
        created_at: '2024-01-17T20:00:00Z',
        payment_type: null,
        split_type: null,
      };

      const expenseBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: mockExpense,
          error: null,
        }),
      };

      const sharesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return expenseBuilder as any;
        if (table === 'expense_shares') return sharesBuilder as any;
        return {} as any;
      });

      const result = await getExpense('expense-optional');

      expect(result).toEqual({
        id: 'expense-optional',
        groupId: 'group-trip',
        description: undefined,
        dateTime: '2024-01-17T19:00:00Z',
        currencyCode: 'USD',
        totalAmountScaled: BigInt(5000),
        payerMemberId: 'member-alice-trip',
        exchangeRateToMainScaled: BigInt(10000),
        totalInMainScaled: BigInt(5000),
        createdAt: '2024-01-17T20:00:00Z',
        paymentType: 'expense',
        splitType: 'equal',
        shares: [],
      });
    });

    it('should return null when expense not found', async () => {
      const { getExpense } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const result = await getExpense('missing-expense');

      expect(result).toBeNull();
    });

    it('should return null on lookup error', async () => {
      const { getExpense } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Lookup failed'),
        }),
      } as any);

      const result = await getExpense('expense-error');

      expect(result).toBeNull();
    });
  });

  describe('updateExpense', () => {
    it('should update expense and replace shares', async () => {
      const { updateExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-1',
        group_id: 'group-trip',
        description: 'Updated Dinner',
        date_time: '2024-01-15T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 150000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 150000,
        created_at: '2024-01-15T20:00:00Z',
        payment_type: 'expense',
        split_type: 'equal',
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const deleteSharesBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      const insertSharesBuilder = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return updateBuilder as any;
        if (table === 'expense_shares') {
          callCount++;
          if (callCount === 1) return deleteSharesBuilder as any;
          return insertSharesBuilder as any;
        }
        return {} as any;
      });

      const result = await updateExpense(
        'expense-1',
        'Updated Dinner',
        '2024-01-15T19:00:00Z',
        'USD',
        BigInt(150000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(150000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(50000),
            shareInMainScaled: BigInt(50000),
          },
        ],
      );

      expect(result?.description).toBe('Updated Dinner');
      expect(deleteSharesBuilder.delete).toHaveBeenCalled();
      expect(insertSharesBuilder.insert).toHaveBeenCalled();
    });

    it('should default optional fields when missing', async () => {
      const { updateExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-optional',
        group_id: 'group-trip',
        description: null,
        date_time: '2024-01-15T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 150000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 150000,
        created_at: '2024-01-15T20:00:00Z',
        payment_type: null,
        split_type: null,
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const deleteSharesBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      const insertSharesBuilder = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return updateBuilder as any;
        if (table === 'expense_shares') {
          callCount++;
          if (callCount === 1) return deleteSharesBuilder as any;
          return insertSharesBuilder as any;
        }
        return {} as any;
      });

      const result = await updateExpense(
        'expense-optional',
        undefined,
        '2024-01-15T19:00:00Z',
        'USD',
        BigInt(150000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(150000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(150000),
            shareInMainScaled: BigInt(150000),
          },
        ],
      );

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ description: null, split_type: 'equal' }),
      );
      expect(result?.description).toBeUndefined();
      expect(result?.paymentType).toBe('expense');
      expect(result?.splitType).toBe('equal');
    });

    it('should return null when deleting shares fails', async () => {
      const { updateExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-1',
        group_id: 'group-trip',
        description: 'Updated Dinner',
        date_time: '2024-01-15T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 150000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 150000,
        created_at: '2024-01-15T20:00:00Z',
        payment_type: 'expense',
        split_type: 'equal',
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const deleteSharesBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: new Error('Delete failed'),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return updateBuilder as any;
        if (table === 'expense_shares') return deleteSharesBuilder as any;
        return {} as any;
      });

      const result = await updateExpense(
        'expense-1',
        'Updated Dinner',
        '2024-01-15T19:00:00Z',
        'USD',
        BigInt(150000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(150000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(50000),
            shareInMainScaled: BigInt(50000),
          },
        ],
      );

      expect(result).toBeNull();
    });

    it('should return null when inserting shares fails', async () => {
      const { updateExpense } = require('../../services/groupRepository');

      const mockDbExpense = {
        id: 'expense-1',
        group_id: 'group-trip',
        description: 'Updated Dinner',
        date_time: '2024-01-15T19:00:00Z',
        currency_code: 'USD',
        total_amount_scaled: 150000,
        payer_member_id: 'member-alice-trip',
        exchange_rate_to_main_scaled: 10000,
        total_in_main_scaled: 150000,
        created_at: '2024-01-15T20:00:00Z',
        payment_type: 'expense',
        split_type: 'equal',
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest
          .fn()
          .mockResolvedValue({ data: mockDbExpense, error: null }),
      };

      const deleteSharesBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      const insertSharesBuilder = {
        insert: jest.fn().mockResolvedValue({
          error: new Error('Insert failed'),
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expenses') return updateBuilder as any;
        if (table === 'expense_shares') {
          callCount++;
          if (callCount === 1) return deleteSharesBuilder as any;
          return insertSharesBuilder as any;
        }
        return {} as any;
      });

      const result = await updateExpense(
        'expense-1',
        'Updated Dinner',
        '2024-01-15T19:00:00Z',
        'USD',
        BigInt(150000),
        'member-alice-trip',
        BigInt(10000),
        BigInt(150000),
        [
          {
            memberId: 'member-alice-trip',
            shareAmountScaled: BigInt(50000),
            shareInMainScaled: BigInt(50000),
          },
        ],
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteExpense', () => {
    it('should delete expense and its shares', async () => {
      const { deleteExpense } = require('../../services/groupRepository');

      const deleteSharesBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      const deleteExpenseBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'expense_shares') return deleteSharesBuilder as any;
        if (table === 'expenses') return deleteExpenseBuilder as any;
        return {} as any;
      });

      const result = await deleteExpense('expense-1');

      expect(result).toBe(true);
      expect(deleteSharesBuilder.delete).toHaveBeenCalled();
      expect(deleteExpenseBuilder.delete).toHaveBeenCalled();
    });

    it('should return false on error', async () => {
      const { deleteExpense } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: new Error('Delete failed') }),
      } as any);

      const result = await deleteExpense('expense-1');

      expect(result).toBe(false);
    });

    it('should return false when deleting shares fails', async () => {
      const { deleteExpense } = require('../../services/groupRepository');

      const deleteSharesBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: new Error('Delete shares failed'),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'expense_shares') return deleteSharesBuilder as any;
        return {} as any;
      });

      const result = await deleteExpense('expense-1');

      expect(result).toBe(false);
    });

    it('should return false when deleting expense fails', async () => {
      const { deleteExpense } = require('../../services/groupRepository');

      const deleteSharesBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      const deleteExpenseBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: new Error('Delete expense failed'),
        }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'expense_shares') return deleteSharesBuilder as any;
        if (table === 'expenses') return deleteExpenseBuilder as any;
        return {} as any;
      });

      const result = await deleteExpense('expense-1');

      expect(result).toBe(false);
    });
  });

  describe('updateGroupMember', () => {
    it('should update a group member', async () => {
      const { updateGroupMember } = require('../../services/groupRepository');

      const updatedMember = {
        ...mockMembers.unconnectedInTrip,
        name: 'Updated Name',
        connectedUserId: 'user-alice',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: createMockDatabaseRow(updatedMember),
          error: null,
        }),
      } as any);

      const result = await updateGroupMember(
        'member-unconnected-trip',
        'Updated Name',
        'dave@example.com',
        'user-alice',
      );

      expect(result).toEqual(updatedMember);
    });

    it('should clear optional fields when omitted', async () => {
      const { updateGroupMember } = require('../../services/groupRepository');

      const updatedMember = {
        ...mockMembers.unconnectedInTrip,
        email: undefined,
        connectedUserId: undefined,
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...createMockDatabaseRow(updatedMember),
            email: null,
            connected_user_id: null,
          },
          error: null,
        }),
      } as any);

      const result = await updateGroupMember(
        'member-unconnected-trip',
        'Updated Name',
      );

      expect(result).toEqual(updatedMember);
    });

    it('should return null on update error', async () => {
      const { updateGroupMember } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Update failed'),
        }),
      } as any);

      const result = await updateGroupMember('member-1', 'Name');

      expect(result).toBeNull();
    });
  });

  describe('canDeleteGroupMember', () => {
    it('should return true when member has no non-zero shares', async () => {
      const {
        canDeleteGroupMember,
      } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any);

      const result = await canDeleteGroupMember('member-with-no-shares');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('expense_shares');
    });

    it('should return false when member has non-zero shares', async () => {
      const {
        canDeleteGroupMember,
      } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ id: 'share-1' }],
          error: null,
        }),
      } as any);

      const result = await canDeleteGroupMember('member-with-shares');

      expect(result).toBe(false);
    });

    it('should return false on query error', async () => {
      const {
        canDeleteGroupMember,
      } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Query failed'),
        }),
      } as any);

      const result = await canDeleteGroupMember('member-error');

      expect(result).toBe(false);
    });
  });

  describe('deleteGroupMember', () => {
    it('should delete a group member successfully', async () => {
      const { deleteGroupMember } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: null,
        }),
      } as any);

      const result = await deleteGroupMember('member-to-delete');

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('group_members');
    });

    it('should return false on delete error', async () => {
      const { deleteGroupMember } = require('../../services/groupRepository');

      mockSupabase.from.mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          error: new Error('Delete failed'),
        }),
      } as any);

      const result = await deleteGroupMember('member-to-delete');

      expect(result).toBe(false);
    });
  });

  describe('leaveGroup', () => {
    it('should disconnect user from group and trigger cleanup', async () => {
      const { leaveGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const getMemberBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: createMockDatabaseRow(mockMembers.aliceInTrip),
          error: null,
        }),
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((_table: string) => {
        callCount++;
        if (callCount === 1) return getMemberBuilder as any;
        if (callCount === 2) return updateBuilder as any;
        return {} as any;
      });

      const result = await leaveGroup('group-trip');

      expect(result).toBe(true);
      expect(updateBuilder.update).toHaveBeenCalledWith({
        connected_user_id: null,
      });
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'cleanup-orphaned-groups',
      );
    });

    it('should return false when user is not a member', async () => {
      const { leaveGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      } as any);

      const result = await leaveGroup('group-trip');

      expect(result).toBe(false);
    });

    it('should return false when no authenticated user', async () => {
      const { leaveGroup } = require('../../services/groupRepository');

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await leaveGroup('group-trip');

      expect(result).toBe(false);
    });

    it('should return false when leaving the group fails', async () => {
      const { leaveGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const getMemberBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: createMockDatabaseRow(mockMembers.aliceInTrip),
          error: null,
        }),
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: new Error('Update failed') }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((_table: string) => {
        callCount++;
        if (callCount === 1) return getMemberBuilder as any;
        if (callCount === 2) return updateBuilder as any;
        return {} as any;
      });

      const result = await leaveGroup('group-trip');

      expect(result).toBe(false);
    });

    it('should return true even if cleanup function fails with context', async () => {
      const { leaveGroup } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const getMemberBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: createMockDatabaseRow(mockMembers.aliceInTrip),
          error: null,
        }),
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      let callCount = 0;
      mockSupabase.from.mockImplementation((_table: string) => {
        callCount++;
        if (callCount === 1) return getMemberBuilder as any;
        if (callCount === 2) return updateBuilder as any;
        return {} as any;
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        error: { message: 'Cleanup failed', context: 'details' },
      });

      const result = await leaveGroup('group-trip');

      expect(result).toBe(true);
    });
  });

  describe('deleteUserAccount', () => {
    it('should call delete-user edge function and sign out', async () => {
      const { deleteUserAccount } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      mockSupabase.functions.invoke.mockResolvedValue({ error: null });
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const result = await deleteUserAccount();

      expect(result).toBe(true);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'delete-user',
        {
          headers: { Authorization: 'Bearer test-token' },
        },
      );
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should return false when no authenticated user', async () => {
      const { deleteUserAccount } = require('../../services/groupRepository');

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await deleteUserAccount();

      expect(result).toBe(false);
    });

    it('should return false when no session token is available', async () => {
      const { deleteUserAccount } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const result = await deleteUserAccount();

      expect(result).toBe(false);
    });

    it('should return false when delete-user function fails', async () => {
      const { deleteUserAccount } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        error: new Error('Delete failed'),
      });

      const result = await deleteUserAccount();

      expect(result).toBe(false);
    });

    it('should return false when delete-user error has no message', async () => {
      const { deleteUserAccount } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice' });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
        error: null,
      });

      mockSupabase.functions.invoke.mockResolvedValue({
        error: {},
      });

      const result = await deleteUserAccount();

      expect(result).toBe(false);
    });
  });

  describe('reconnectGroupMembers', () => {
    it('should reconnect unconnected members by email', async () => {
      const {
        reconnectGroupMembers,
      } = require('../../services/groupRepository');
      const mockUser = createMockUser({
        id: 'user-alice',
        email: 'alice@example.com',
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: [createMockDatabaseRow(mockMembers.aliceInTrip)],
          error: null,
        }),
      };

      mockSupabase.from.mockReturnValue(updateBuilder as any);

      const result = await reconnectGroupMembers();

      expect(result).toBe(1);
      expect(updateBuilder.update).toHaveBeenCalledWith({
        connected_user_id: 'user-alice',
      });
      expect(updateBuilder.eq).toHaveBeenCalledWith(
        'email',
        'alice@example.com',
      );
    });

    it('should return 0 when no user email', async () => {
      const {
        reconnectGroupMembers,
      } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice', email: undefined });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await reconnectGroupMembers();

      expect(result).toBe(0);
    });

    it('should return 0 when update fails', async () => {
      const {
        reconnectGroupMembers,
      } = require('../../services/groupRepository');
      const mockUser = createMockUser({
        id: 'user-alice',
        email: 'alice@example.com',
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({
          data: null,
          error: new Error('Update failed'),
        }),
      };

      mockSupabase.from.mockReturnValue(updateBuilder as any);

      const result = await reconnectGroupMembers();

      expect(result).toBe(0);
    });
  });

  describe('sendInvitationEmail', () => {
    it('should call send-invitation edge function', async () => {
      const { sendInvitationEmail } = require('../../services/groupRepository');

      mockSupabase.functions.invoke.mockResolvedValue({ error: null });

      const result = await sendInvitationEmail(
        'test@example.com',
        'Weekend Trip',
      );

      expect(result).toBe(true);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'send-invitation',
        {
          body: { email: 'test@example.com', groupName: 'Weekend Trip' },
        },
      );
    });

    it('should return false on error', async () => {
      const { sendInvitationEmail } = require('../../services/groupRepository');

      mockSupabase.functions.invoke.mockResolvedValue({
        error: new Error('Invitation failed'),
      });

      const result = await sendInvitationEmail(
        'test@example.com',
        'Weekend Trip',
      );

      expect(result).toBe(false);
    });
  });
});
