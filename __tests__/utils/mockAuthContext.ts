/**
 * Mock Utilities for Auth Context
 *
 * Provides reusable mock factories for testing screens that use the useAuth hook.
 * This centralizes Auth Context mocking to ensure consistency across screen tests.
 */

import type { Session, User } from '@supabase/supabase-js';

export interface MockAuthContext {
  user: User | null;
  session: Session | null;
  loading: boolean;
  requiresRecoveryPasswordChange: boolean;
  signIn: jest.Mock<Promise<void>, [string, string]>;
  signUp: jest.Mock<Promise<void>, [string, string, string]>;
  completeRecoveryPasswordChange: jest.Mock<Promise<void>, [string]>;
  changePassword: jest.Mock<Promise<void>, [string, string]>;
  signOut: jest.Mock<Promise<void>, []>;
}

/**
 * Creates a mock user object for testing.
 *
 * @param overrides - Optional properties to override default user
 * @returns Mock User object
 *
 * @example
 * const user = createMockUser({ email: 'alice@example.com' });
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: 'user-test-123',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@example.com',
    email_confirmed_at: new Date().toISOString(),
    phone: '',
    confirmed_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock session object for testing.
 *
 * @param user - User to include in session
 * @param overrides - Optional properties to override default session
 * @returns Mock Session object
 *
 * @example
 * const session = createMockSession(createMockUser());
 */
export function createMockSession(
  user?: User,
  overrides?: Partial<Session>,
): Session {
  const mockUser = user || createMockUser();

  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: mockUser,
    ...overrides,
  };
}

/**
 * Creates a mock AuthContext with default values.
 * All sign-in/sign-up/sign-out methods are mocked as jest functions.
 *
 * @param overrides - Optional properties to override defaults
 * @returns Mock AuthContext object
 *
 * @example
 * // Not authenticated
 * const authContext = createMockAuthContext();
 * expect(authContext.user).toBeNull();
 *
 * @example
 * // Authenticated user
 * const authContext = createMockAuthContext({
 *   user: createMockUser({ email: 'alice@example.com' }),
 *   session: createMockSession(),
 * });
 * expect(authContext.user.email).toBe('alice@example.com');
 *
 * @example
 * // Loading state
 * const authContext = createMockAuthContext({ loading: true });
 * expect(authContext.loading).toBe(true);
 */
export function createMockAuthContext(
  overrides?: Partial<MockAuthContext>,
): MockAuthContext {
  return {
    user: null,
    session: null,
    loading: false,
    requiresRecoveryPasswordChange: false,
    signIn: jest.fn().mockResolvedValue(undefined),
    signUp: jest.fn().mockResolvedValue(undefined),
    completeRecoveryPasswordChange: jest.fn().mockResolvedValue(undefined),
    changePassword: jest.fn().mockResolvedValue(undefined),
    signOut: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Creates a mock authenticated AuthContext.
 * Convenience function for common test scenario.
 *
 * @param userOverrides - Optional user properties to override
 * @returns Mock AuthContext with authenticated user
 *
 * @example
 * const authContext = createAuthenticatedContext({
 *   email: 'alice@example.com',
 *   id: 'user-alice',
 * });
 * expect(authContext.user).not.toBeNull();
 * expect(authContext.session).not.toBeNull();
 */
export function createAuthenticatedContext(
  userOverrides?: Partial<User>,
): MockAuthContext {
  const user = createMockUser(userOverrides);
  const session = createMockSession(user);

  return createMockAuthContext({
    user,
    session,
    loading: false,
  });
}

/**
 * Creates a mock loading AuthContext.
 * Convenience function for testing loading states.
 *
 * @returns Mock AuthContext in loading state
 *
 * @example
 * const authContext = createLoadingAuthContext();
 * expect(authContext.loading).toBe(true);
 * expect(authContext.user).toBeNull();
 */
export function createLoadingAuthContext(): MockAuthContext {
  return createMockAuthContext({
    loading: true,
  });
}

/**
 * Resets all mock functions on an AuthContext.
 * Call this in beforeEach() to ensure clean state between tests.
 *
 * @param authContext - The mock auth context to reset
 *
 * @example
 * let mockAuthContext: MockAuthContext;
 *
 * beforeEach(() => {
 *   mockAuthContext = createMockAuthContext();
 *   resetMockAuthContext(mockAuthContext);
 * });
 */
export function resetMockAuthContext(authContext: MockAuthContext): void {
  authContext.signIn.mockClear();
  authContext.signUp.mockClear();
  authContext.completeRecoveryPasswordChange.mockClear();
  authContext.changePassword.mockClear();
  authContext.signOut.mockClear();
}

/**
 * Configures signIn mock to succeed and update auth state.
 * Simulates successful authentication flow.
 *
 * @param authContext - The mock auth context to configure
 * @param user - User to set after successful sign-in
 *
 * @example
 * const authContext = createMockAuthContext();
 * const user = createMockUser();
 * mockSignInSuccess(authContext, user);
 *
 * await authContext.signIn('test@example.com', 'password');
 * expect(authContext.signIn).toHaveBeenCalled();
 */
export function mockSignInSuccess(
  authContext: MockAuthContext,
  user?: User,
): void {
  const mockUser = user || createMockUser();
  const mockSession = createMockSession(mockUser);

  authContext.signIn.mockResolvedValue(undefined);
  authContext.signIn.mockImplementation(async () => {
    authContext.user = mockUser;
    authContext.session = mockSession;
    authContext.loading = false;
  });
}

/**
 * Configures signIn mock to fail with an error.
 * Simulates authentication failure.
 *
 * @param authContext - The mock auth context to configure
 * @param error - Error to throw (defaults to "Invalid credentials")
 *
 * @example
 * const authContext = createMockAuthContext();
 * mockSignInFailure(authContext, new Error('Invalid email or password'));
 *
 * await expect(authContext.signIn('bad@example.com', 'wrong')).rejects.toThrow();
 */
export function mockSignInFailure(
  authContext: MockAuthContext,
  error?: Error,
): void {
  const mockError = error || new Error('Invalid credentials');
  authContext.signIn.mockRejectedValue(mockError);
}

/**
 * Configures signUp mock to succeed and create a new user.
 * Simulates successful registration flow.
 *
 * @param authContext - The mock auth context to configure
 * @param user - User to set after successful sign-up
 *
 * @example
 * const authContext = createMockAuthContext();
 * mockSignUpSuccess(authContext);
 *
 * await authContext.signUp('new@example.com', 'password123', 'New User');
 * expect(authContext.signUp).toHaveBeenCalled();
 */
export function mockSignUpSuccess(
  authContext: MockAuthContext,
  user?: User,
): void {
  const mockUser = user || createMockUser();
  const mockSession = createMockSession(mockUser);

  authContext.signUp.mockResolvedValue(undefined);
  authContext.signUp.mockImplementation(async () => {
    authContext.user = mockUser;
    authContext.session = mockSession;
    authContext.loading = false;
  });
}

/**
 * Configures signUp mock to fail with an error.
 * Simulates registration failure.
 *
 * @param authContext - The mock auth context to configure
 * @param error - Error to throw (defaults to "Email already registered")
 *
 * @example
 * const authContext = createMockAuthContext();
 * mockSignUpFailure(authContext);
 *
 * await expect(
 *   authContext.signUp('existing@example.com', 'pass', 'Existing User'),
 * ).rejects.toThrow();
 */
export function mockSignUpFailure(
  authContext: MockAuthContext,
  error?: Error,
): void {
  const mockError = error || new Error('Email already registered');
  authContext.signUp.mockRejectedValue(mockError);
}

/**
 * Configures signOut mock to succeed and clear auth state.
 * Simulates successful logout flow.
 *
 * @param authContext - The mock auth context to configure
 *
 * @example
 * const authContext = createAuthenticatedContext();
 * mockSignOutSuccess(authContext);
 *
 * await authContext.signOut();
 * expect(authContext.user).toBeNull();
 */
export function mockSignOutSuccess(authContext: MockAuthContext): void {
  authContext.signOut.mockResolvedValue(undefined);
  authContext.signOut.mockImplementation(async () => {
    authContext.user = null;
    authContext.session = null;
  });
}
