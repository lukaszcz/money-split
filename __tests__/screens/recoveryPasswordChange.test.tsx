import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import RecoveryPasswordChangeScreen from '../../app/recovery-password-change';
import {
  createMockAuthContext,
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

describe('Recovery Password Change Screen', () => {
  let mockAuthContext: MockAuthContext;
  let mockRouter: { replace: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthContext = createMockAuthContext({
      user: {
        id: 'user-123',
        aud: 'authenticated',
      } as any,
      requiresRecoveryPasswordChange: true,
    });
    mockRouter = require('expo-router').router;
    require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  });

  it('shows validation error when passwords are missing', () => {
    const { getByText } = render(<RecoveryPasswordChangeScreen />);

    fireEvent.press(getByText('Save new password'));

    expect(
      getByText('Please enter and confirm your new password'),
    ).toBeTruthy();
    expect(
      mockAuthContext.completeRecoveryPasswordChange,
    ).not.toHaveBeenCalled();
  });

  it('shows validation error when passwords do not match', () => {
    const { getByPlaceholderText, getByText } = render(
      <RecoveryPasswordChangeScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('New password'), 'password123');
    fireEvent.changeText(
      getByPlaceholderText('Confirm new password'),
      'password124',
    );
    fireEvent.press(getByText('Save new password'));

    expect(getByText('Passwords do not match')).toBeTruthy();
    expect(
      mockAuthContext.completeRecoveryPasswordChange,
    ).not.toHaveBeenCalled();
  });

  it('updates password and navigates to groups', async () => {
    mockAuthContext.completeRecoveryPasswordChange.mockResolvedValue(undefined);

    const { getByPlaceholderText, getByText } = render(
      <RecoveryPasswordChangeScreen />,
    );

    fireEvent.changeText(
      getByPlaceholderText('New password'),
      'new-password-123',
    );
    fireEvent.changeText(
      getByPlaceholderText('Confirm new password'),
      'new-password-123',
    );
    fireEvent.press(getByText('Save new password'));

    await waitFor(() => {
      expect(
        mockAuthContext.completeRecoveryPasswordChange,
      ).toHaveBeenCalledWith('new-password-123');
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/groups');
  });

  it('shows error when password update fails', async () => {
    mockAuthContext.completeRecoveryPasswordChange.mockRejectedValue(
      new Error('Unable to update password'),
    );

    const { getByPlaceholderText, getByText } = render(
      <RecoveryPasswordChangeScreen />,
    );

    fireEvent.changeText(
      getByPlaceholderText('New password'),
      'new-password-123',
    );
    fireEvent.changeText(
      getByPlaceholderText('Confirm new password'),
      'new-password-123',
    );
    fireEvent.press(getByText('Save new password'));

    await waitFor(() => {
      expect(getByText('Unable to update password')).toBeTruthy();
    });
  });
});
