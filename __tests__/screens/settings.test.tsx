import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import SettingsScreen from '../../app/(tabs)/settings';
import { createAuthenticatedContext } from '../utils/mockAuthContext';
import type { MockAuthContext } from '../utils/mockAuthContext';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../../services/groupRepository', () => ({
  getUser: jest.fn(),
  updateUserName: jest.fn(),
  deleteUserAccount: jest.fn(),
}));

describe('Settings Screen', () => {
  let mockAuthContext: MockAuthContext;
  let mockRouter: { replace: jest.Mock };
  let mockGetUser: jest.Mock;
  let mockUpdateUserName: jest.Mock;
  let mockDeleteUserAccount: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthContext = createAuthenticatedContext({
      id: 'user-123',
      email: 'test@example.com',
    });
    mockRouter = require('expo-router').router;

    mockGetUser = require('../../services/groupRepository').getUser;
    mockUpdateUserName = require('../../services/groupRepository').updateUserName;
    mockDeleteUserAccount =
      require('../../services/groupRepository').deleteUserAccount;

    require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and displays the user profile', async () => {
    mockGetUser.mockResolvedValue({
      id: 'user-123',
      name: 'Jane Doe',
      email: 'test@example.com',
    });

    const { getByText } = render(<SettingsScreen />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledWith('user-123');
    });

    expect(getByText('test@example.com')).toBeTruthy();
    expect(getByText('Jane Doe')).toBeTruthy();
  });

  it('updates the display name when saved', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockGetUser.mockResolvedValue({
      id: 'user-123',
      name: 'Old Name',
      email: 'test@example.com',
    });
    mockUpdateUserName.mockResolvedValue({
      id: 'user-123',
      name: 'New Name',
      email: 'test@example.com',
    });

    const { getByText, getByLabelText, getByPlaceholderText } = render(
      <SettingsScreen />,
    );

    await waitFor(() => {
      expect(getByText('Old Name')).toBeTruthy();
    });

    fireEvent.press(getByLabelText('Edit display name'));

    fireEvent.changeText(getByPlaceholderText('Enter your name'), ' New Name ');
    fireEvent.press(getByLabelText('Save display name'));

    await waitFor(() => {
      expect(mockUpdateUserName).toHaveBeenCalledWith('user-123', 'New Name');
    });

    expect(alertSpy).toHaveBeenCalledWith('Success', 'Name updated successfully');
    expect(getByText('New Name')).toBeTruthy();
  });

  it('logs out after confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockGetUser.mockResolvedValue({
      id: 'user-123',
      name: 'Jane Doe',
      email: 'test@example.com',
    });

    const { getByLabelText } = render(<SettingsScreen />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledWith('user-123');
    });

    fireEvent.press(getByLabelText('Logout'));

    const alertButtons = alertSpy.mock.calls[0][2];
    const logoutAction = alertButtons?.find(
      (button) => button?.text === 'Logout',
    );

    await logoutAction?.onPress?.();

    await waitFor(() => {
      expect(mockAuthContext.signOut).toHaveBeenCalled();
    });

    expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
  });

  it('deletes the account after double confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    mockGetUser.mockResolvedValue({
      id: 'user-123',
      name: 'Jane Doe',
      email: 'test@example.com',
    });
    mockDeleteUserAccount.mockResolvedValue(true);

    const { getByLabelText } = render(<SettingsScreen />);

    await waitFor(() => {
      expect(mockGetUser).toHaveBeenCalledWith('user-123');
    });

    fireEvent.press(getByLabelText('Delete account'));

    const firstAlertButtons = alertSpy.mock.calls[0][2];
    const deleteAction = firstAlertButtons?.find(
      (button) => button?.text === 'Delete My Account',
    );

    deleteAction?.onPress?.();

    const secondAlertButtons = alertSpy.mock.calls[1][2];
    const confirmDeleteAction = secondAlertButtons?.find(
      (button) => button?.text === 'Yes, Delete Forever',
    );

    await act(async () => {
      await confirmDeleteAction?.onPress?.();
    });

    await waitFor(() => {
      expect(mockDeleteUserAccount).toHaveBeenCalled();
    });

    expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
  });
});
