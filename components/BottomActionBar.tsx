import { Text, TouchableOpacity, StyleSheet, View } from 'react-native';
import { Plus } from 'lucide-react-native';

type BottomActionBarProps = {
  label: string;
  onPress: () => void;
};

export default function BottomActionBar({
  label,
  onPress,
}: BottomActionBarProps) {
  return (
    <View style={styles.container}>
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
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
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
