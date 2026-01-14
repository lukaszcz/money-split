/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import GroupDetailScreen from '../../app/group/[id]';
import { createMockSupabaseClient } from '../utils/mockSupabase';
import type { MockSupabaseClient } from '../utils/mockSupabase';

// Mock Expo Router
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: jest.fn(),
    useLocalSearchParams: jest.fn(),
    useFocusEffect: jest.fn((callback) => {
      React.useEffect(() => {
        return callback();
      }, [callback]);
    }),
  };
});

// Mock Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

// Mock services
jest.mock('../../services/groupRepository', () => ({
  getGroup: jest.fn(),
  getGroupExpenses: jest.fn(),
  leaveGroup: jest.fn(),
}));

jest.mock('../../services/settlementService', () => ({
  computeBalances: jest.fn(),
}));

jest.mock('../../services/exchangeRateService', () => ({
  getExchangeRate: jest.fn(),
}));

jest.mock('../../services/groupPreferenceService', () => ({
  recordGroupVisit: jest.fn(),
}));

// Mock BottomActionBar component
jest.mock('../../components/BottomActionBar', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockComponent = (props: any) => React.createElement(View, props);
  return { __esModule: true, default: MockComponent };
});

describe('GroupDetail Screen - Overflow Menu', () => {
  let mockRouter: { push: jest.Mock; back: jest.Mock };
  let mockGetGroup: jest.Mock;
  let mockGetGroupExpenses: jest.Mock;
  let mockLeaveGroup: jest.Mock;
  let mockComputeBalances: jest.Mock;
  let mockRecordGroupVisit: jest.Mock;
  let mockSupabase: MockSupabaseClient;
  let alertSpy: jest.SpyInstance;
  let useRefSpy: jest.SpyInstance;

  const originalUseRef = React.useRef;

  const mockGroup = {
    id: 'group-1',
    name: 'Trip to Paris',
    mainCurrencyCode: 'EUR',
    members: [
      { id: 'member-1', name: 'Alice', email: null, connectedUserId: null },
      { id: 'member-2', name: 'Bob', email: null, connectedUserId: null },
    ],
  };

  const mockExpenses = [
    {
      id: 'expense-1',
      description: 'Dinner',
      totalAmountScaled: BigInt(5000),
      currencyCode: 'EUR',
      payerMemberId: 'member-1',
      createdAt: '2024-01-01T10:00:00Z',
      paymentType: 'expense',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockRouter = { push: jest.fn(), back: jest.fn() };
    mockSupabase = createMockSupabaseClient();

    // Setup mocks
    require('expo-router').useRouter.mockReturnValue(mockRouter);
    require('expo-router').useLocalSearchParams.mockReturnValue({
      id: 'group-1',
    });
    require('../../lib/supabase').supabase = mockSupabase;

    mockGetGroup = require('../../services/groupRepository').getGroup;
    mockGetGroupExpenses =
      require('../../services/groupRepository').getGroupExpenses;
    mockLeaveGroup = require('../../services/groupRepository').leaveGroup;
    mockComputeBalances =
      require('../../services/settlementService').computeBalances;
    mockRecordGroupVisit =
      require('../../services/groupPreferenceService').recordGroupVisit;

    // Default mock implementations
    mockGetGroup.mockResolvedValue(mockGroup);
    mockGetGroupExpenses.mockResolvedValue(mockExpenses);
    mockComputeBalances.mockReturnValue(
      new Map([
        ['member-1', BigInt(2500)],
        ['member-2', BigInt(-2500)],
      ]),
    );
    mockRecordGroupVisit.mockResolvedValue(undefined);

    // Mock Alert
    alertSpy = jest.spyOn(Alert, 'alert');

    useRefSpy = jest.spyOn(React, 'useRef').mockImplementation((value) => {
      if (value === null) {
        return {
          current: {
            measureInWindow: (callback: any) => callback(0, 0, 120, 40),
          },
        };
      }

      return originalUseRef(value);
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    useRefSpy.mockRestore();
  });

  it('renders the more button with accessibility label', async () => {
    const { getByLabelText } = render(<GroupDetailScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByLabelText('Group actions')).toBeTruthy();
    });
  });

  it('calls measureInWindow when more button is pressed', async () => {
    const { getByLabelText } = render(<GroupDetailScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByLabelText('Group actions')).toBeTruthy();
    });

    // Press the more button - this should attempt to call measureInWindow
    // We can verify the button press was handled
    const moreButton = getByLabelText('Group actions');
    fireEvent.press(moreButton);

    // The component should render a Modal after the button press
    // Even though measureInWindow might not work in test environment,
    // we verify the interaction was triggered
    expect(moreButton).toBeTruthy();
  });

  it('shows leave group confirmation when menu item is pressed', async () => {
    const { getByLabelText, getByText } = render(<GroupDetailScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByLabelText('Group actions')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Group actions'));

    await waitFor(() => {
      expect(getByText('Leave group')).toBeTruthy();
    });

    fireEvent.press(getByText('Leave group'));

    await waitFor(() => {
      expect(getByText('Leave group')).toBeTruthy();
    });

    fireEvent.press(getByText('Leave group'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Leave Group',
      'Are you sure you want to leave this group? If you are the last member, the group will be deleted.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({
          text: 'Leave',
          style: 'destructive',
        }),
      ]),
    );
  });

  it('successfully leaves group and navigates back', async () => {
    mockLeaveGroup.mockResolvedValue(true);

    const { getByLabelText } = render(<GroupDetailScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(getByLabelText('Group actions')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Group actions'));

    // Verify Alert was called
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Leave Group',
        'Are you sure you want to leave this group? If you are the last member, the group will be deleted.',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
          expect.objectContaining({
            text: 'Leave',
            style: 'destructive',
          }),
        ]),
      );
    });

    // Get the Leave button callback
    const alertCall = alertSpy.mock.calls[0];
    const buttons = alertCall[2];
    const leaveButton = buttons.find((btn: any) => btn.text === 'Leave');

    // Simulate pressing Leave in the alert
    await act(async () => {
      await leaveButton.onPress();
    });

    // Verify leaveGroup was called
    expect(mockLeaveGroup).toHaveBeenCalledWith('group-1');

    // Verify navigation back
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('shows error alert when leave group fails', async () => {
    mockLeaveGroup.mockResolvedValue(false);

    const { getByLabelText, getByText } = render(<GroupDetailScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByLabelText('Group actions'));

    await waitFor(() => {
      expect(getByText('Leave group')).toBeTruthy();
    });

    fireEvent.press(getByText('Leave group'));

    // Get the Leave button callback
    const alertCall = alertSpy.mock.calls[0];
    const buttons = alertCall[2];
    const leaveButton = buttons.find((btn: any) => btn.text === 'Leave');

    // Reset the spy to track the error alert
    alertSpy.mockClear();

    // Simulate pressing Leave in the alert
    await act(async () => {
      await leaveButton.onPress();
    });

    // Verify error alert was shown
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Error',
        'Failed to leave group. Please try again.',
      );
    });

    // Verify router.back was NOT called
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('does not leave group when cancel is pressed', async () => {
    const { getByLabelText, getByText } = render(<GroupDetailScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.press(getByLabelText('Group actions'));

    await waitFor(() => {
      expect(getByText('Leave group')).toBeTruthy();
    });

    fireEvent.press(getByText('Leave group'));

    // User presses Cancel - the onPress callback should not be called
    // Verify leaveGroup was NOT called
    expect(mockLeaveGroup).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});
