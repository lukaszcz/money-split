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

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    supabaseModule = require('../../lib/supabase');
    supabaseModule.supabase = mockSupabase;
    const groupRepository = require('../../services/groupRepository');
    ensureUserProfile = groupRepository.ensureUserProfile;
    syncUserPreferences = require('../../services/userPreferenceSync')
      .syncUserPreferences;
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
      expect(ensureUserProfile).toHaveBeenCalled();
      expect(syncUserPreferences).toHaveBeenCalledWith(mockUser.id);
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
      expect(syncUserPreferences).toHaveBeenCalledWith(mockUser.id);
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
  });

  describe('signUp', () => {
    it('should sign up user with email and password', async () => {
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
        await result.current.signUp('new@example.com', 'password123');
      });

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
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
          await result.current.signUp('test@example.com', 'password123');
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
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.session).toEqual(mockSession);
      });

      expect(ensureUserProfile).toHaveBeenCalled();
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

      expect(result.current.user).toEqual(mockUser);

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
