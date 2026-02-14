/**
 * @jest-environment jsdom
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  createMockSupabaseClient,
  createMockUser,
  createMockSession,
  MockSupabaseClient,
} from '../utils/mockSupabase';

jest.mock('../../lib/supabase', () => ({
  supabase: null,
}));

jest.mock('../../services/groupRepository', () => ({
  ensureUserProfile: jest.fn().mockResolvedValue({
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    createdAt: '2024-01-01T00:00:00Z',
  }),
}));

jest.mock('../../services/userPreferenceSync', () => ({
  syncUserPreferences: jest.fn(),
}));

let mockSupabase: MockSupabaseClient;
let supabaseModule: any;
let ensureUserProfile: jest.Mock;
let syncUserPreferences: jest.Mock;
let warnSpy: jest.SpyInstance;

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockSupabase = createMockSupabaseClient();
    supabaseModule = require('../../lib/supabase');
    supabaseModule.supabase = mockSupabase;
    const groupRepository = require('../../services/groupRepository');
    ensureUserProfile = groupRepository.ensureUserProfile;
    syncUserPreferences =
      require('../../services/userPreferenceSync').syncUserPreferences;
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  const createWrapper = () => {
    const { AuthProvider } = require('../../contexts/AuthContext');
    return ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
  };

  describe('initialization', () => {
    it('should initialize with loading state', () => {
      mockSupabase.auth.getSession.mockReturnValue(
        new Promise(() => {}), // Never resolves to keep loading state
      );

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.requiresRecoveryPasswordChange).toBe(false);
    });

    it('should load existing session on mount', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        aud: mockUser.aud,
      });
      expect(result.current.session).toMatchObject({
        access_token: mockSession.access_token,
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        }),
      });
      expect(result.current.requiresRecoveryPasswordChange).toBe(false);
      await waitFor(() => {
        expect(ensureUserProfile).toHaveBeenCalled();
        expect(syncUserPreferences).toHaveBeenCalledWith(mockUser.id);
      });
    });

    it('should restore forced password change requirement from session metadata on init', async () => {
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { recoveryPasswordMustChange: true },
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.requiresRecoveryPasswordChange).toBe(true);
    });

    it('should set loading false with no session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should keep restored session even when post-login sync fails', async () => {
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      syncUserPreferences.mockRejectedValueOnce(new Error('sync failed'));

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.session?.user?.id).toBe('user-123');

      await waitFor(() => {
        expect(syncUserPreferences).toHaveBeenCalledWith('user-123');
      });

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to sync user data after initial session restore:',
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });

  describe('signIn', () => {
    it('should sign in user with email and password', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder as any);

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ last_login: expect.any(String) }),
      );
      expect(syncUserPreferences).not.toHaveBeenCalled();
      expect(result.current.requiresRecoveryPasswordChange).toBe(false);
    });

    it('should throw error on failed sign in', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const signInError = new Error('Invalid credentials');
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: signInError,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'wrongpassword');
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should handle recovery password sign in via edge function', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // First sign-in attempt fails (not the real password)
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      // Edge function verifies recovery password and sets a temporary password
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: {
          isRecoveryPassword: true,
          temporaryPassword: 'server-generated-temporary-password',
        },
        error: null,
      });

      // Second sign-in attempt succeeds with temporary password
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(updateBuilder as any);

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test@example.com', 'recovery-password');
      });

      // Should have called verify-recovery-password edge function
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
        'verify-recovery-password',
        {
          body: { email: 'test@example.com', password: 'recovery-password' },
        },
      );

      expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        data: { recoveryPasswordMustChange: true },
      });

      // Should have signed in twice (first fail, second success with temp password)
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledTimes(2);

      expect(result.current.requiresRecoveryPasswordChange).toBe(true);
    });

    it('should throw when recovery sign-in edge function fails', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // First sign-in attempt fails
      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      // Combined edge function fails
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: new Error('Failed to set password'),
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'recovery-password');
        }),
      ).rejects.toThrow(
        'Unable to complete recovery sign-in. Please request a new recovery password.',
      );
    });

    it('should throw when recovery metadata persistence fails', async () => {
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: {
          isRecoveryPassword: true,
          temporaryPassword: 'server-generated-temporary-password',
        },
        error: null,
      });

      mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({
        data: {
          user: createMockUser({ id: 'user-123', email: 'test@example.com' }),
          session: createMockSession({
            id: 'user-123',
            email: 'test@example.com',
          }),
        },
        error: null,
      });

      mockSupabase.auth.updateUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Unable to update metadata'),
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'recovery-password');
        }),
      ).rejects.toThrow(
        'Unable to complete recovery sign-in. Please request a new recovery password.',
      );

      errorSpy.mockRestore();
    });

    it('should throw expired error when recovery password is expired', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      // First sign-in attempt fails
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      // Edge function reports recovery password is expired
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: {
          isRecoveryPassword: false,
          expired: true,
        },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signIn('test@example.com', 'recovery-password');
        }),
      ).rejects.toThrow('Recovery password expired. Request a new one.');
    });
  });

  describe('completeRecoveryPasswordChange', () => {
    it('should save the new permanent password', async () => {
      const refreshedUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: refreshedUser },
        error: null,
      });

      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: refreshedUser },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // In a real scenario, requiresRecoveryPasswordChange would be set to true after
      // successful recovery password sign-in. For this test, we just verify the
      // completeRecoveryPasswordChange function works correctly.
      await act(async () => {
        await result.current.completeRecoveryPasswordChange('new-password-123');
      });

      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'new-password-123',
        data: { recoveryPasswordMustChange: false },
      });
      expect(result.current.requiresRecoveryPasswordChange).toBe(false);
    });

    it('should throw when updating permanent password fails', async () => {
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
        user_metadata: { recoveryPasswordMustChange: true },
      });
      const updateError = new Error('Unable to update password');

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: updateError,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      expect(result.current.requiresRecoveryPasswordChange).toBe(true);

      await expect(
        act(async () => {
          await result.current.completeRecoveryPasswordChange(
            'new-password-123',
          );
        }),
      ).rejects.toThrow('Unable to update password');
      expect(result.current.requiresRecoveryPasswordChange).toBe(true);
    });
  });

  describe('changePassword', () => {
    it('should verify current password and save the new password', async () => {
      const session = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });
      const refreshedUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: session.user, session },
        error: null,
      });
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: refreshedUser },
        error: null,
      });
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: refreshedUser },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.changePassword(
          'current-password-123',
          'new-password-123',
        );
      });

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'current-password-123',
      });
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'new-password-123',
      });
    });

    it('should throw when current password is incorrect', async () => {
      const session = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.changePassword(
            'wrong-password',
            'new-password-123',
          );
        }),
      ).rejects.toThrow('Current password is incorrect');

      expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    it('should throw when password update fails', async () => {
      const session = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session },
        error: null,
      });
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: session.user, session },
        error: null,
      });
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Unable to update password'),
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.changePassword(
            'current-password-123',
            'new-password-123',
          );
        }),
      ).rejects.toThrow('Unable to update password');
    });
  });

  describe('signUp', () => {
    it('should sign up user with email, password, and name', async () => {
      const mockUser = createMockUser({
        id: 'user-new',
        email: 'new@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUp(
          'new@example.com',
          'password123',
          'New User',
        );
      });

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {
            name: 'New User',
          },
        },
      });
    });

    it('should throw error on failed sign up', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const signUpError = new Error('Email already exists');
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: signUpError,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signUp(
            'test@example.com',
            'password123',
            'Test User',
          );
        }),
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('signOut', () => {
    it('should sign out user', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        aud: mockUser.aud,
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should throw error on failed sign out', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const signOutError = new Error('Sign out failed');
      mockSupabase.auth.signOut.mockResolvedValue({ error: signOutError });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signOut();
        }),
      ).rejects.toThrow('Sign out failed');
    });
  });

  describe('auth state change listener', () => {
    it('should update state on SIGNED_IN event', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      let authCallback: any;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: jest.fn() } },
        };
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();

      await act(async () => {
        await authCallback('SIGNED_IN', mockSession);
      });

      await waitFor(() => {
        expect(result.current.user).toMatchObject({
          id: mockUser.id,
          email: mockUser.email,
          aud: mockUser.aud,
        });
        expect(result.current.session).toEqual(mockSession);
      });

      await waitFor(() => {
        expect(ensureUserProfile).toHaveBeenCalled();
      });
    });

    it('should update state on SIGNED_OUT event', async () => {
      const mockUser = createMockUser({
        id: 'user-123',
        email: 'test@example.com',
      });
      const mockSession = createMockSession({
        id: 'user-123',
        email: 'test@example.com',
      });

      let authCallback: any;
      mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return {
          data: { subscription: { unsubscribe: jest.fn() } },
        };
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        aud: mockUser.aud,
      });

      await act(async () => {
        await authCallback('SIGNED_OUT', null);
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.session).toBeNull();
      });
    });

    it('should cleanup subscription on unmount', async () => {
      const unsubscribeMock = jest.fn();
      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: unsubscribeMock } },
      });

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      const { useAuth } = require('../../contexts/AuthContext');
      const { result, unmount } = renderHook(() => useAuth(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });

  describe('useAuth hook', () => {
    it('should throw error when used outside AuthProvider', () => {
      const { useAuth } = require('../../contexts/AuthContext');

      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });
  });
});
