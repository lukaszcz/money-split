import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import PasswordRecoveryScreen from '../../app/password-recovery';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/services/authService', () => ({
  requestPasswordRecovery: jest.fn(),
}));

describe('Password Recovery Screen', () => {
  const mockRouter = require('expo-router').router;
  const { requestPasswordRecovery } = require('@/services/authService');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows validation errors for missing or invalid email', () => {
    const { getByText, getByPlaceholderText } = render(
      <PasswordRecoveryScreen />,
    );

    fireEvent.press(getByText('Send recovery email'));
    expect(getByText('Please enter your email address')).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('Email'), 'not-an-email');
    fireEvent.press(getByText('Send recovery email'));
    expect(getByText('Please enter a valid email address')).toBeTruthy();
  });

  it('submits a password recovery request', async () => {
    requestPasswordRecovery.mockResolvedValue(undefined);

    const { getByText, getByPlaceholderText } = render(
      <PasswordRecoveryScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.press(getByText('Send recovery email'));

    await waitFor(() => {
      expect(requestPasswordRecovery).toHaveBeenCalledWith('test@example.com');
    });

    expect(
      getByText(
        'Recovery email sent. Check your inbox for a one-time password valid for 5 minutes. You will set a new password after sign-in.',
      ),
    ).toBeTruthy();
  });

  it('shows an error when recovery request fails', async () => {
    requestPasswordRecovery.mockRejectedValue(new Error('Server error'));

    const { getByText, getByPlaceholderText } = render(
      <PasswordRecoveryScreen />,
    );

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.press(getByText('Send recovery email'));

    await waitFor(() => {
      expect(getByText('Server error')).toBeTruthy();
    });
  });

  it('returns to sign in', () => {
    const { getByText } = render(<PasswordRecoveryScreen />);

    fireEvent.press(getByText('Back to sign in'));

    expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
  });
});
