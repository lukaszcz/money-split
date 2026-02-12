import { useEffect } from 'react';
import { Stack, type Href, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function RootLayoutNav() {
  const { user, loading, requiresRecoveryPasswordChange } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const currentSegment = segments[0] as string | undefined;
    const inPublicAuthFlow =
      currentSegment === 'auth' || currentSegment === 'password-recovery';
    const inRecoveryPasswordChangeScreen =
      currentSegment === 'recovery-password-change';

    if (!user && !inPublicAuthFlow) {
      router.replace('/auth');
      return;
    }

    if (
      user &&
      requiresRecoveryPasswordChange &&
      !inRecoveryPasswordChangeScreen
    ) {
      router.replace('/recovery-password-change' as Href);
      return;
    }

    if (
      user &&
      !requiresRecoveryPasswordChange &&
      (inPublicAuthFlow || inRecoveryPasswordChangeScreen)
    ) {
      router.replace('/(tabs)/groups');
    }
  }, [user, loading, segments, router, requiresRecoveryPasswordChange]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="password-recovery" />
      <Stack.Screen name="recovery-password-change" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
