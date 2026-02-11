/**
 * @jest-environment jsdom
 */
import React from 'react';
import { Alert, Text, View } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import EditMemberScreen from '../../app/group/[id]/edit-member';
import {
  createMockAuthContext,
  createMockUser,
} from '../utils/mockAuthContext';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/groupRepository', () => ({
  getGroupMember: jest.fn(),
  updateGroupMember: jest.fn(),
  getUserByEmail: jest.fn(),
  sendInvitationEmail: jest.fn(),
  getGroup: jest.fn(),
  canDeleteGroupMember: jest.fn(),
  deleteGroupMember: jest.fn(),
  getGroupMembers: jest.fn(),
  getCurrentUserMemberInGroup: jest.fn(),
  leaveGroup: jest.fn(),
}));

jest.mock('../../components/KnownUserSuggestionInput', () => ({
  KnownUserSuggestionInput: () =>
    React.createElement(
      View,
      null,
      React.createElement(Text, null, 'Known user input'),
    ),
}));

describe('EditMemberScreen', () => {
  let alertSpy: jest.SpyInstance;
  let mockRouter: { back: jest.Mock; replace: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    require('expo-router').useLocalSearchParams.mockReturnValue({
      id: 'group-1',
      memberId: 'member-1',
    });

    mockRouter = {
      back: jest.fn(),
      replace: jest.fn(),
    };
    require('expo-router').useRouter.mockReturnValue(mockRouter);

    const repository = require('../../services/groupRepository');
    repository.getGroupMember.mockResolvedValue({
      id: 'member-1',
      groupId: 'group-1',
      name: 'Me',
      createdAt: '2025-01-01T00:00:00Z',
    });
    repository.canDeleteGroupMember.mockResolvedValue(true);
    repository.getGroupMembers.mockResolvedValue([]);
    repository.getCurrentUserMemberInGroup.mockResolvedValue({
      id: 'member-1',
      groupId: 'group-1',
      name: 'Me',
      createdAt: '2025-01-01T00:00:00Z',
    });
    repository.leaveGroup.mockResolvedValue(true);
    repository.deleteGroupMember.mockResolvedValue(true);

    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('routes destructive action to leaveGroup after auth hydration', async () => {
    const useAuth = require('../../contexts/AuthContext').useAuth;
    const authState = createMockAuthContext({
      loading: true,
      user: null,
      session: null,
    });

    useAuth.mockImplementation(() => authState);

    const { getByLabelText, rerender } = render(<EditMemberScreen />);

    authState.loading = false;
    authState.user = createMockUser({
      id: 'user-1',
    });

    rerender(<EditMemberScreen />);

    await waitFor(() => {
      expect(
        require('../../services/groupRepository').getCurrentUserMemberInGroup,
      ).toHaveBeenCalledWith('group-1');
    });

    await waitFor(() => {
      expect(getByLabelText('Leave group')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Leave group'));
    });

    await waitFor(() => {
      expect(
        alertSpy.mock.calls.some((call) => call[0] === 'Leave Group'),
      ).toBe(true);
    });

    const confirmationCall = alertSpy.mock.calls.find(
      (call) => call[0] === 'Leave Group',
    );

    const buttons = confirmationCall?.[2] as
      | { text?: string; onPress?: () => void | Promise<void> }[]
      | undefined;
    const leaveButton = buttons?.find((button) => button.text === 'Leave');

    await act(async () => {
      await leaveButton?.onPress?.();
    });

    expect(
      require('../../services/groupRepository').leaveGroup,
    ).toHaveBeenCalledWith('group-1');
    expect(
      require('../../services/groupRepository').deleteGroupMember,
    ).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/groups');
  });

  it('falls back to previously resolved membership when refresh is inconclusive', async () => {
    const useAuth = require('../../contexts/AuthContext').useAuth;
    useAuth.mockReturnValue(
      createMockAuthContext({
        loading: false,
        user: createMockUser({ id: 'user-1' }),
      }),
    );

    const repository = require('../../services/groupRepository');
    repository.getCurrentUserMemberInGroup
      .mockResolvedValueOnce({
        id: 'member-1',
        groupId: 'group-1',
        name: 'Me',
        createdAt: '2025-01-01T00:00:00Z',
      })
      .mockResolvedValueOnce(null);

    const { getByLabelText } = render(<EditMemberScreen />);

    await waitFor(() => {
      expect(getByLabelText('Leave group')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Leave group'));
    });

    await waitFor(() => {
      expect(
        alertSpy.mock.calls.some((call) => call[0] === 'Leave Group'),
      ).toBe(true);
    });

    const confirmationCall = alertSpy.mock.calls.find(
      (call) => call[0] === 'Leave Group',
    );
    const buttons = confirmationCall?.[2] as
      | { text?: string; onPress?: () => void | Promise<void> }[]
      | undefined;
    const leaveButton = buttons?.find((button) => button.text === 'Leave');

    await act(async () => {
      await leaveButton?.onPress?.();
    });

    expect(repository.leaveGroup).toHaveBeenCalledWith('group-1');
    expect(repository.deleteGroupMember).not.toHaveBeenCalled();
  });

  it('aborts destructive action when membership cannot be resolved', async () => {
    const useAuth = require('../../contexts/AuthContext').useAuth;
    useAuth.mockReturnValue(
      createMockAuthContext({
        loading: false,
        user: createMockUser({ id: 'user-1' }),
      }),
    );

    const repository = require('../../services/groupRepository');
    repository.getCurrentUserMemberInGroup.mockResolvedValue(null);

    const { getByLabelText } = render(<EditMemberScreen />);

    await waitFor(() => {
      expect(getByLabelText('Delete member')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(getByLabelText('Delete member'));
    });

    await waitFor(() => {
      expect(
        alertSpy.mock.calls.some(
          (call) =>
            call[0] === 'Error' &&
            call[1] ===
              'Unable to verify whether this is your member record. Please try again.',
        ),
      ).toBe(true);
    });

    expect(repository.leaveGroup).not.toHaveBeenCalled();
    expect(repository.deleteGroupMember).not.toHaveBeenCalled();
  });
});
