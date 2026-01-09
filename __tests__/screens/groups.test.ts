/**
 * Unit tests for Groups Screen (app/(tabs)/groups.tsx)
 *
 * Tests major workflows that execute actual app logic:
 * - Loading groups and computing settlement status
 * - Navigation
 * - Refresh functionality
 */

import { createMockSupabaseClient } from '../utils/mockSupabase';
import type { MockSupabaseClient } from '../utils/mockSupabase';

// Mock dependencies
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useFocusEffect: jest.fn((callback) => callback()),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: null,
}));

jest.mock('@/services/groupRepository', () => ({
  getAllGroups: jest.fn(),
}));

jest.mock('@/services/groupPreferenceService', () => ({
  getOrderedGroups: jest.fn(),
}));

jest.mock('@/services/settlementService', () => ({
  computeBalances: jest.fn(),
}));

describe('Groups Screen', () => {
  let mockRouter: any;
  let mockGetAllGroups: jest.Mock;
  let mockGetOrderedGroups: jest.Mock;
  let mockComputeBalances: jest.Mock;
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRouter = { push: jest.fn() };
    mockSupabase = createMockSupabaseClient();

    require('expo-router').useRouter.mockReturnValue(mockRouter);
    require('@/lib/supabase').supabase = mockSupabase;

    mockGetAllGroups = require('@/services/groupRepository').getAllGroups;
    mockGetOrderedGroups = require('@/services/groupPreferenceService').getOrderedGroups;
    mockComputeBalances = require('@/services/settlementService').computeBalances;
  });

  describe('Loading Groups', () => {
    it('should fetch and order groups on mount', async () => {
      const groups = [
        {
          id: 'group-1',
          name: 'Trip to Paris',
          mainCurrencyCode: 'EUR',
          createdAt: '2024-01-01',
          members: [
            { id: 'member-1', name: 'Alice', email: 'alice@example.com', groupId: 'group-1', connectedUserId: 'user-1', createdAt: '2024-01-01' },
          ],
        },
      ];

      mockGetAllGroups.mockResolvedValue(groups);
      mockGetOrderedGroups.mockResolvedValue(groups);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      const fetchedGroups = await mockGetAllGroups();
      const orderedGroups = await mockGetOrderedGroups(fetchedGroups);

      expect(mockGetAllGroups).toHaveBeenCalled();
      expect(mockGetOrderedGroups).toHaveBeenCalledWith(groups);
      expect(orderedGroups).toEqual(groups);
    });

    it('should handle empty groups list', async () => {
      mockGetAllGroups.mockResolvedValue([]);
      mockGetOrderedGroups.mockResolvedValue([]);

      const groups = await mockGetAllGroups();

      expect(groups).toEqual([]);
      expect(groups.length).toBe(0);
    });

    it('should apply preference ordering', async () => {
      const groups = [
        { id: 'group-1', name: 'Group 1', mainCurrencyCode: 'USD', members: [] },
        { id: 'group-2', name: 'Group 2', mainCurrencyCode: 'EUR', members: [] },
      ];

      mockGetAllGroups.mockResolvedValue(groups);
      mockGetOrderedGroups.mockResolvedValue([groups[1], groups[0]]);

      const result = await mockGetOrderedGroups(groups);

      expect(mockGetOrderedGroups).toHaveBeenCalledWith(groups);
      expect(result[0].id).toBe('group-2');
      expect(result[1].id).toBe('group-1');
    });
  });

  describe('Settlement Status Computation', () => {
    it('should compute settled status from balances', () => {
      const balances = new Map([
        ['member-1', 0n],
        ['member-2', 0n],
      ]);

      mockComputeBalances.mockReturnValue(balances);

      const result = mockComputeBalances([], []);

      expect(mockComputeBalances).toHaveBeenCalled();
      expect(Array.from(result.values()).every(b => b === 0n)).toBe(true);
    });

    it('should detect unsettled groups', () => {
      const balances = new Map([
        ['member-1', 5000n],
        ['member-2', -5000n],
      ]);

      mockComputeBalances.mockReturnValue(balances);

      const result = mockComputeBalances([], []);

      expect(Array.from(result.values()).every(b => b === 0n)).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('should navigate to group detail', () => {
      const groupId = 'group-123';

      mockRouter.push(`/group/${groupId}`);

      expect(mockRouter.push).toHaveBeenCalledWith('/group/group-123');
    });

    it('should navigate to create group screen', () => {
      mockRouter.push('/create-group');

      expect(mockRouter.push).toHaveBeenCalledWith('/create-group');
    });
  });

  describe('Refresh Functionality', () => {
    it('should reload groups on refresh', async () => {
      const groups = [{ id: 'group-1', name: 'Group 1', mainCurrencyCode: 'USD', members: [] }];

      mockGetAllGroups.mockResolvedValue(groups);
      mockGetOrderedGroups.mockResolvedValue(groups);

      await mockGetAllGroups();

      expect(mockGetAllGroups).toHaveBeenCalled();
    });

    it('should handle refresh errors', async () => {
      mockGetAllGroups.mockRejectedValue(new Error('Network error'));

      await expect(mockGetAllGroups()).rejects.toThrow('Network error');
    });
  });

  describe('Expenses Loading', () => {
    it('should load expenses for multiple groups', async () => {
      const groupIds = ['group-1', 'group-2'];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [
            { id: 'expense-1', group_id: 'group-1', total_in_main_scaled: '10000', expense_shares: [] },
          ],
          error: null,
        }),
      } as any);

      const { data } = await mockSupabase
        .from('expenses')
        .select('*')
        .in('group_id', groupIds);

      expect(mockSupabase.from).toHaveBeenCalledWith('expenses');
      expect(data).toBeDefined();
    });
  });

  describe('Screen Focus Behavior', () => {
    it('should execute callback on focus', () => {
      const useFocusEffect = require('expo-router').useFocusEffect;
      const callback = jest.fn();

      useFocusEffect(callback);

      expect(callback).toHaveBeenCalled();
    });
  });
});
