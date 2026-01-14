import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';

type BottomActionBarProps = {
  label: string;
  onPress: () => void;
  safeAreaBottom?: boolean;
};

const BASE_PADDING_VERTICAL = 8;

export default function BottomActionBar({
  label,
  onPress,
  safeAreaBottom = true,
}: BottomActionBarProps) {
  const insets = useSafeAreaInsets();
  const bottomInset = safeAreaBottom ? insets.bottom : 0;
  const containerStyle = [
    styles.container,
    bottomInset ? { paddingBottom: BASE_PADDING_VERTICAL + bottomInset } : null,
  ];

  return (
    <View style={styles.safeArea}>
      <View style={containerStyle}>
        <TouchableOpacity
          style={styles.button}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
        >
          <Plus color="#ffffff" size={20} />
          <Text style={styles.buttonText}>{label}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#ffffff',
  },
  container: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: BASE_PADDING_VERTICAL,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
