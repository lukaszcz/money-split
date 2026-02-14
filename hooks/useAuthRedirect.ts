import { useCallback } from 'react';
import { type Href, useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

type AuthRedirectMode = 'entry' | 'guard';

export function useAuthRedirect(
  mode: AuthRedirectMode,
  currentSegment?: string,
) {
  const { user, loading, requiresRecoveryPasswordChange } = useAuth();
  const router = useRouter();

  const performRedirect = useCallback(() => {
    if (loading) {
      return false;
    }

    const inPublicAuthFlow =
      currentSegment === 'auth' || currentSegment === 'password-recovery';
    const inRecoveryPasswordChangeScreen =
      currentSegment === 'recovery-password-change';

    if (!user) {
      if (mode === 'entry' || !inPublicAuthFlow) {
        router.replace('/auth');
        return true;
      }

      return false;
    }

    if (requiresRecoveryPasswordChange) {
      if (mode === 'entry' || !inRecoveryPasswordChangeScreen) {
        router.replace('/recovery-password-change' as Href);
        return true;
      }

      return false;
    }

    if (mode === 'entry') {
      router.replace('/(tabs)/groups');
      return true;
    }

    if (inPublicAuthFlow || inRecoveryPasswordChangeScreen) {
      router.replace('/(tabs)/groups');
      return true;
    }

    return false;
  }, [
    currentSegment,
    loading,
    mode,
    requiresRecoveryPasswordChange,
    router,
    user,
  ]);

  return {
    loading,
    performRedirect,
  };
}
