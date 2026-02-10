import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AuthScreen from '../../app/auth';
import {
  createMockAuthContext,
  mockSignInSuccess,
  mockSignUpSuccess,
} from '../utils/mockAuthContext';
import type { MockAuthContext } from '../utils/mockAuthContext';

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('Auth Screen', () => {
  let mockAuthContext: MockAuthContext;
  let mockRouter: { push: jest.Mock; replace: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthContext = createMockAuthContext();
    mockRouter = require('expo-router').router;

    require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  });

  it('shows an error when email or password is missing', () => {
    const { getByText } = render(<AuthScreen />);

    fireEvent.press(getByText('Sign In'));

    expect(getByText('Please enter both email and password')).toBeTruthy();
    expect(mockAuthContext.signIn).not.toHaveBeenCalled();
  });

  it('shows an error for invalid email', () => {
    const { getByPlaceholderText, getByText } = render(<AuthScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), 'not-an-email');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    expect(getByText('Please enter a valid email address')).toBeTruthy();
    expect(mockAuthContext.signIn).not.toHaveBeenCalled();
  });

  it('signs in and navigates on success', async () => {
    mockSignInSuccess(mockAuthContext);

    const { getByPlaceholderText, getByText } = render(<AuthScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), '  test@example.com  ');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    await waitFor(() => {
      expect(mockAuthContext.signIn).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
    });

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/groups');
    });
  });

  it('disables auth controls immediately after sign in submit', () => {
    mockAuthContext.signIn.mockImplementation(() => new Promise(() => {}));

    const { getByPlaceholderText, getByText, getByLabelText, queryByText } =
      render(<AuthScreen />);

    fireEvent.changeText(getByPlaceholderText('Email'), 'test@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign In'));

    expect(getByPlaceholderText('Email').props.editable).toBe(false);
    expect(getByPlaceholderText('Password').props.editable).toBe(false);
    expect(getByLabelText('Forgot password').props.disabled).toBe(true);
    expect(getByLabelText('Switch to sign up').props.disabled).toBe(true);
    expect(queryByText('Sign In')).toBeNull();
  });

  it('shows an error when name is missing on sign up', () => {
    const { getByPlaceholderText, getByText, getByLabelText } = render(
      <AuthScreen />,
    );

    fireEvent.press(getByLabelText('Switch to sign up'));

    fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign Up'));

    expect(getByText('Please enter your name')).toBeTruthy();
    expect(mockAuthContext.signUp).not.toHaveBeenCalled();
  });

  it('switches to sign up and asks user to confirm email after account creation', async () => {
    mockSignUpSuccess(mockAuthContext);

    const { getByPlaceholderText, getByText, getByLabelText } = render(
      <AuthScreen />,
    );

    fireEvent.press(getByLabelText('Switch to sign up'));

    fireEvent.changeText(getByPlaceholderText('Name'), 'New User');
    fireEvent.changeText(getByPlaceholderText('Email'), 'new@example.com');
    fireEvent.changeText(getByPlaceholderText('Password'), 'password123');
    fireEvent.press(getByText('Sign Up'));

    await waitFor(() => {
      expect(mockAuthContext.signUp).toHaveBeenCalledWith(
        'new@example.com',
        'password123',
        'New User',
      );
    });

    await waitFor(() => {
      expect(
        getByText(
          'Check your email and confirm your address before signing in.',
        ),
      ).toBeTruthy();
    });

    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('navigates to password recovery', () => {
    const { getByText } = render(<AuthScreen />);

    fireEvent.press(getByText('Forgot password?'));

    expect(mockRouter.push).toHaveBeenCalledWith('/password-recovery');
  });
});
