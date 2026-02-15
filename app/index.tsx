import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';

export default function IndexScreen() {
  const { performRedirect } = useAuthRedirect('entry');

  useEffect(() => {
    performRedirect();
  }, [performRedirect]);

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
