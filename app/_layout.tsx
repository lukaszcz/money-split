import { useEffect } from 'react';
import { Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

function RootLayoutNav() {
  const segments = useSegments();
  const currentSegment = segments[0] as string | undefined;
  const { performRedirect } = useAuthRedirect('guard', currentSegment);

  useEffect(() => {
    performRedirect();
  }, [performRedirect]);

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
