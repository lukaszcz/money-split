import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import GroupsScreen from '../../app/(tabs)/groups';
import { createMockSupabaseClient } from '../utils/mockSupabase';
import type { MockSupabaseClient } from '../utils/mockSupabase';

jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: jest.fn(),
    useFocusEffect: jest.fn((callback) => {
      React.useEffect(() => {
        return callback();
      }, [callback]);
    }),
  };
});

jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

jest.mock('../../services/groupRepository', () => ({
  getAllGroups: jest.fn(),
}));

jest.mock('../../services/groupPreferenceService', () => ({
  getOrderedGroups: jest.fn(),
}));

jest.mock('../../services/settlementService', () => ({
  computeBalances: jest.fn(),
}));

describe('Groups Screen', () => {
  let mockRouter: { push: jest.Mock };
  let mockGetAllGroups: jest.Mock;
  let mockGetOrderedGroups: jest.Mock;
  let mockComputeBalances: jest.Mock;
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRouter = { push: jest.fn() };
    mockSupabase = createMockSupabaseClient();

    require('expo-router').useRouter.mockReturnValue(mockRouter);
    require('../../lib/supabase').supabase = mockSupabase;

    mockGetAllGroups = require('../../services/groupRepository').getAllGroups;
    mockGetOrderedGroups =
      require('../../services/groupPreferenceService').getOrderedGroups;
    mockComputeBalances =
      require('../../services/settlementService').computeBalances;
  });

  it('loads and displays groups', async () => {
    const groups = [
      {
        id: 'group-1',
        name: 'Trip to Paris',
        mainCurrencyCode: 'EUR',
        members: [{ id: 'member-1', name: 'Alice' }],
      },
    ];

    mockGetAllGroups.mockResolvedValue(groups);
    mockGetOrderedGroups.mockResolvedValue(groups);

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({ data: [], error: null }),
    } as any);

    const { getByText } = render(<GroupsScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByText('Trip to Paris')).toBeTruthy();
    });

    expect(getByText('1 member')).toBeTruthy();
  });

  it('shows the empty state when no groups exist', async () => {
    mockGetAllGroups.mockResolvedValue([]);
    mockGetOrderedGroups.mockResolvedValue([]);

    const { getByText } = render(<GroupsScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByText('No groups yet')).toBeTruthy();
    });

    expect(getByText('Create your first group to get started')).toBeTruthy();
  });

  it('marks a group as settled and navigates to details', async () => {
    const groups = [
      {
        id: 'group-1',
        name: 'Weekend Trip',
        mainCurrencyCode: 'USD',
        members: [{ id: 'member-1', name: 'Alice' }],
      },
    ];

    mockGetAllGroups.mockResolvedValue(groups);
    mockGetOrderedGroups.mockResolvedValue(groups);
    mockComputeBalances.mockReturnValue(
      new Map([
        ['member-1', 0n],
        ['member-2', 0n],
      ]),
    );

    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'expense-1',
            group_id: 'group-1',
            description: 'Dinner',
            date_time: '2024-01-01T10:00:00Z',
            currency_code: 'USD',
            total_amount_scaled: '10000',
            payer_member_id: 'member-1',
            exchange_rate_to_main_scaled: '10000',
            total_in_main_scaled: '10000',
            created_at: '2024-01-01T10:00:00Z',
            payment_type: 'expense',
            expense_shares: [
              {
                id: 'share-1',
                member_id: 'member-1',
                share_amount_scaled: '10000',
                share_in_main_scaled: '10000',
              },
            ],
          },
        ],
        error: null,
      }),
    } as any);

    const { getByText, getByLabelText } = render(<GroupsScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByText('1 member • Settled')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Open group Weekend Trip'));

    expect(mockRouter.push).toHaveBeenCalledWith('/group/group-1');
  });

  it('navigates to create group from the add button', async () => {
    mockGetAllGroups.mockResolvedValue([]);
    mockGetOrderedGroups.mockResolvedValue([]);

    const { getByLabelText } = render(<GroupsScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByLabelText('Add group'));

    expect(mockRouter.push).toHaveBeenCalledWith('/create-group');
  });
});
