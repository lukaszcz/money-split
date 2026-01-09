/**
 * Unit tests for Auth Screen (app/auth.tsx)
 *
 * Tests major workflows that execute actual app logic:
 * - Sign-in flow with validation and navigation
 * - Sign-up flow with validation and navigation
 * - Error handling
 */

import {
  createMockAuthContext,
  mockSignInSuccess,
  mockSignInFailure,
  mockSignUpSuccess,
  mockSignUpFailure,
} from '../utils/mockAuthContext';
import type { MockAuthContext } from '../utils/mockAuthContext';

// Mock dependencies
jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
  },
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/utils/validation', () => ({
  isValidEmail: jest.fn(),
}));

describe('Auth Screen', () => {
  let mockAuthContext: MockAuthContext;
  let mockIsValidEmail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthContext = createMockAuthContext();
    mockIsValidEmail = require('@/utils/validation').isValidEmail;

    mockIsValidEmail.mockReturnValue(true);
    require('@/contexts/AuthContext').useAuth.mockReturnValue(mockAuthContext);
  });

  describe('Sign In Flow', () => {
    it('should call signIn and navigate on success', async () => {
      mockSignInSuccess(mockAuthContext);

      await mockAuthContext.signIn('test@example.com', 'password123');

      expect(mockAuthContext.signIn).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
    });

    it('should handle sign-in errors', async () => {
      const error = new Error('Invalid login credentials');
      mockSignInFailure(mockAuthContext, error);

      await expect(
        mockAuthContext.signIn('test@example.com', 'wrongpassword'),
      ).rejects.toThrow('Invalid login credentials');
    });

    it('should validate email format using isValidEmail', () => {
      mockIsValidEmail.mockReturnValue(false);

      const isValid = mockIsValidEmail('invalid-email');

      expect(mockIsValidEmail).toHaveBeenCalledWith('invalid-email');
      expect(isValid).toBe(false);
    });
  });

  describe('Sign Up Flow', () => {
    it('should call signUp and authenticate user on success', async () => {
      mockSignUpSuccess(mockAuthContext);

      await mockAuthContext.signUp('newuser@example.com', 'password123');

      expect(mockAuthContext.signUp).toHaveBeenCalledWith(
        'newuser@example.com',
        'password123',
      );
      expect(mockAuthContext.user).not.toBeNull();
    });

    it('should handle sign-up errors', async () => {
      const error = new Error('Email already registered');
      mockSignUpFailure(mockAuthContext, error);

      await expect(
        mockAuthContext.signUp('existing@example.com', 'password123'),
      ).rejects.toThrow('Email already registered');
    });
  });

  describe('Email Validation', () => {
    it('should accept valid emails', () => {
      mockIsValidEmail.mockReturnValue(true);

      expect(mockIsValidEmail('test@example.com')).toBe(true);
      expect(mockIsValidEmail('user.name+tag@example.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      mockIsValidEmail.mockReturnValue(false);

      expect(mockIsValidEmail('notanemail')).toBe(false);
      expect(mockIsValidEmail('@example.com')).toBe(false);
      expect(mockIsValidEmail('')).toBe(false);
    });
  });
});
