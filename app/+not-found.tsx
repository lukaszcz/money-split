import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

export default function NotFoundScreen() {
  const { performRedirect } = useAuthRedirect('entry');

  useEffect(() => {
    performRedirect();
  }, [performRedirect]);

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <ActivityIndicator />
        <Text style={styles.text}>Redirecting...</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    marginTop: 12,
    fontSize: 16,
  },
});
