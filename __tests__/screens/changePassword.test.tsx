import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ChangePasswordScreen from '../../app/change-password';
import {
  createAuthenticatedContext,
  type MockAuthContext,
} from '../utils/mockAuthContext';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('Change Password Screen', () => {
  let mockAuthContext: MockAuthContext;
  let mockRouter: { replace: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthContext = createAuthenticatedContext({
      id: 'user-123',
      email: 'test@example.com',
    });
    mockRouter = require('expo-router').router;
    require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  });

  it('shows validation error when current password is missing', () => {
    const { getByText, getByLabelText } = render(<ChangePasswordScreen />);

    fireEvent.press(getByLabelText('Change password'));

    expect(getByText('Please enter your current password')).toBeTruthy();
    expect(mockAuthContext.changePassword).not.toHaveBeenCalled();
  });

  it('shows validation error when passwords do not match', () => {
    const { getByPlaceholderText, getByText, getByLabelText } = render(
      <ChangePasswordScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('Current password'), 'old-pass');
    fireEvent.changeText(getByPlaceholderText('New password'), 'new-pass-123');
    fireEvent.changeText(
      getByPlaceholderText('Confirm new password'),
      'new-pass-124',
    );
    fireEvent.press(getByLabelText('Change password'));

    expect(getByText('Passwords do not match')).toBeTruthy();
    expect(mockAuthContext.changePassword).not.toHaveBeenCalled();
  });

  it('updates password and navigates to settings', async () => {
    mockAuthContext.changePassword.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByLabelText } = render(
      <ChangePasswordScreen />,
    );

    fireEvent.changeText(
      getByPlaceholderText('Current password'),
      'current-password-123',
    );
    fireEvent.changeText(
      getByPlaceholderText('New password'),
      'new-password-123',
    );
    fireEvent.changeText(
      getByPlaceholderText('Confirm new password'),
      'new-password-123',
    );
    fireEvent.press(getByLabelText('Change password'));

    await waitFor(() => {
      expect(mockAuthContext.changePassword).toHaveBeenCalledWith(
        'current-password-123',
        'new-password-123',
      );
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('shows error when password change fails', async () => {
    mockAuthContext.changePassword.mockRejectedValue(
      new Error('Current password is incorrect'),
    );

    const { getByPlaceholderText, getByText, getByLabelText } = render(
      <ChangePasswordScreen />,
    );

    fireEvent.changeText(
      getByPlaceholderText('Current password'),
      'wrong-password',
    );
    fireEvent.changeText(
      getByPlaceholderText('New password'),
      'new-password-123',
    );
    fireEvent.changeText(
      getByPlaceholderText('Confirm new password'),
      'new-password-123',
    );
    fireEvent.press(getByLabelText('Change password'));

    await waitFor(() => {
      expect(getByText('Current password is incorrect')).toBeTruthy();
    });
  });
});
