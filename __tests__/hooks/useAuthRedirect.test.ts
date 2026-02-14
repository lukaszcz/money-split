/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react-native';
import { useAuthRedirect } from '../../hooks/useAuthRedirect';
import {
  createMockAuthContext,
  createMockUser,
} from '../utils/mockAuthContext';

jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

describe('useAuthRedirect', () => {
  let mockReplace: jest.Mock;

  const setAuthState = (
    overrides: Parameters<typeof createMockAuthContext>[0] = {},
  ) => {
    const authState = createMockAuthContext(overrides);
    require('@/contexts/AuthContext').useAuth.mockReturnValue(authState);
    return authState;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockReplace = jest.fn();
    require('expo-router').useRouter.mockReturnValue({
      replace: mockReplace,
    });
  });

  it('returns loading state and does not redirect while loading', () => {
    setAuthState({ loading: true });

    const { result } = renderHook(() => useAuthRedirect('entry'));

    expect(result.current.loading).toBe(true);
    expect(result.current.performRedirect()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated user from entry mode to auth', () => {
    setAuthState({ user: null });

    const { result } = renderHook(() => useAuthRedirect('entry', 'auth'));

    expect(result.current.performRedirect()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/auth');
  });

  it('redirects unauthenticated user from guard mode when not in public auth flow', () => {
    setAuthState({ user: null });

    const { result } = renderHook(() => useAuthRedirect('guard', 'groups'));

    expect(result.current.performRedirect()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/auth');
  });

  it('does not redirect unauthenticated user already in auth screen during guard mode', () => {
    setAuthState({ user: null });

    const { result } = renderHook(() => useAuthRedirect('guard', 'auth'));

    expect(result.current.performRedirect()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('does not redirect unauthenticated user already in password recovery screen during guard mode', () => {
    setAuthState({ user: null });

    const { result } = renderHook(() =>
      useAuthRedirect('guard', 'password-recovery'),
    );

    expect(result.current.performRedirect()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects user requiring recovery password change in entry mode', () => {
    setAuthState({
      user: createMockUser(),
      requiresRecoveryPasswordChange: true,
    });

    const { result } = renderHook(() => useAuthRedirect('entry'));

    expect(result.current.performRedirect()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/recovery-password-change');
  });

  it('redirects user requiring recovery password change in guard mode outside recovery screen', () => {
    setAuthState({
      user: createMockUser(),
      requiresRecoveryPasswordChange: true,
    });

    const { result } = renderHook(() => useAuthRedirect('guard', 'groups'));

    expect(result.current.performRedirect()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/recovery-password-change');
  });

  it('does not redirect user requiring recovery password change already in recovery screen during guard mode', () => {
    setAuthState({
      user: createMockUser(),
      requiresRecoveryPasswordChange: true,
    });

    const { result } = renderHook(() =>
      useAuthRedirect('guard', 'recovery-password-change'),
    );

    expect(result.current.performRedirect()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('redirects authenticated user to groups in entry mode', () => {
    setAuthState({ user: createMockUser() });

    const { result } = renderHook(() => useAuthRedirect('entry'));

    expect(result.current.performRedirect()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/groups');
  });

  it('redirects authenticated user away from auth flow in guard mode', () => {
    setAuthState({ user: createMockUser() });

    const { result } = renderHook(() =>
      useAuthRedirect('guard', 'password-recovery'),
    );

    expect(result.current.performRedirect()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/groups');
  });

  it('redirects authenticated user away from recovery-password-change screen in guard mode', () => {
    setAuthState({ user: createMockUser() });

    const { result } = renderHook(() =>
      useAuthRedirect('guard', 'recovery-password-change'),
    );

    expect(result.current.performRedirect()).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/groups');
  });

  it('does not redirect authenticated user in non-public guarded screens', () => {
    setAuthState({ user: createMockUser() });

    const { result } = renderHook(() => useAuthRedirect('guard', 'groups'));

    expect(result.current.performRedirect()).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
