import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function IndexScreen() {
  const { user, loading, requiresRecoveryPasswordChange } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      router.replace('/auth');
      return;
    }

    if (requiresRecoveryPasswordChange) {
      router.replace('/recovery-password-change');
      return;
    }

    router.replace('/(tabs)/groups');
  }, [user, loading, requiresRecoveryPasswordChange]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
