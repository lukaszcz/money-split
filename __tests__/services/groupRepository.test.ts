import { createMockSupabaseClient, createMockUser, resetAllMocks, MockSupabaseClient } from '../utils/mockSupabase';
import { mockUsers, mockGroups, mockMembers, createMockDatabaseRow } from '../fixtures/testData';

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
  });

  afterEach(() => {
    resetAllMocks(mockSupabase);
    jest.resetModules();
  });

  describe('ensureUserProfile', () => {
    it('should return existing user if already exists', async () => {
      const { ensureUserProfile } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-123', email: 'test@example.com' });

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
      const mockUser = createMockUser({ id: 'user-new', email: 'new@example.com' });

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
      const mockUser = createMockUser({ id: 'user-new', email: 'new@example.com' });

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
        maybeSingle: jest.fn().mockResolvedValue({ data: mockDbUser, error: null }),
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
        maybeSingle: jest.fn().mockImplementation((args: any) => {
          if (args) return Promise.resolve({ data: mockDbUser, error: null });
          return Promise.resolve({ data: mockDbBob, error: null });
        }),
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
        maybeSingle: jest.fn().mockResolvedValue({ data: mockDbGroup, error: null }),
      };

      const membersBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockDbMembers, error: null }),
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
        single: jest.fn().mockResolvedValue({ data: mockDbExpense, error: null }),
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
        { memberId: 'member-alice-trip', shareAmountScaled: BigInt(40000), shareInMainScaled: BigInt(40000) },
        { memberId: 'member-bob-trip', shareAmountScaled: BigInt(40000), shareInMainScaled: BigInt(40000) },
        { memberId: 'member-charlie-trip', shareAmountScaled: BigInt(40000), shareInMainScaled: BigInt(40000) },
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
        shares
      );

      expect(result).toBeTruthy();
      expect(result?.id).toBe('expense-1');
      expect(expenseBuilder.insert).toHaveBeenCalled();
      expect(sharesBuilder.insert).toHaveBeenCalledWith([
        { expense_id: 'expense-1', member_id: 'member-alice-trip', share_amount_scaled: 40000, share_in_main_scaled: 40000 },
        { expense_id: 'expense-1', member_id: 'member-bob-trip', share_amount_scaled: 40000, share_in_main_scaled: 40000 },
        { expense_id: 'expense-1', member_id: 'member-charlie-trip', share_amount_scaled: 40000, share_in_main_scaled: 40000 },
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
        single: jest.fn().mockResolvedValue({ data: mockDbExpense, error: null }),
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
        [{ memberId: 'member-alice-trip', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) }],
        'transfer',
        'exact'
      );

      expect(result?.paymentType).toBe('transfer');
      expect(result?.splitType).toBe('exact');
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
        single: jest.fn().mockResolvedValue({ data: mockDbExpense, error: null }),
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
        [{ memberId: 'member-alice-trip', shareAmountScaled: BigInt(50000), shareInMainScaled: BigInt(50000) }]
      );

      expect(result?.description).toBe('Updated Dinner');
      expect(deleteSharesBuilder.delete).toHaveBeenCalled();
      expect(insertSharesBuilder.insert).toHaveBeenCalled();
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
      expect(updateBuilder.update).toHaveBeenCalledWith({ connected_user_id: null });
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('cleanup-orphaned-groups');
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
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('delete-user', {
        headers: { Authorization: 'Bearer test-token' },
      });
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
  });

  describe('reconnectGroupMembers', () => {
    it('should reconnect unconnected members by email', async () => {
      const { reconnectGroupMembers } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice', email: 'alice@example.com' });

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
      expect(updateBuilder.update).toHaveBeenCalledWith({ connected_user_id: 'user-alice' });
      expect(updateBuilder.eq).toHaveBeenCalledWith('email', 'alice@example.com');
    });

    it('should return 0 when no user email', async () => {
      const { reconnectGroupMembers } = require('../../services/groupRepository');
      const mockUser = createMockUser({ id: 'user-alice', email: undefined });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await reconnectGroupMembers();

      expect(result).toBe(0);
    });
  });

  describe('sendInvitationEmail', () => {
    it('should call send-invitation edge function', async () => {
      const { sendInvitationEmail } = require('../../services/groupRepository');

      mockSupabase.functions.invoke.mockResolvedValue({ error: null });

      const result = await sendInvitationEmail('test@example.com', 'Weekend Trip');

      expect(result).toBe(true);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-invitation', {
        body: { email: 'test@example.com', groupName: 'Weekend Trip' },
      });
    });

    it('should return false on error', async () => {
      const { sendInvitationEmail } = require('../../services/groupRepository');

      mockSupabase.functions.invoke.mockResolvedValue({
        error: new Error('Invitation failed'),
      });

      const result = await sendInvitationEmail('test@example.com', 'Weekend Trip');

      expect(result).toBe(false);
    });
  });
});
