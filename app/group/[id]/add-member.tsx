import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import {
  createGroupMember,
  getUserByEmail,
  sendInvitationEmail,
  getGroup,
} from '../../../services/groupRepository';
import { isValidEmail } from '../../../utils/validation';

export default function AddMemberScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddMember = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName && !trimmedEmail) {
      Alert.alert('Error', 'Please enter a name or email');
      return;
    }

    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Invalid group');
      return;
    }

    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      let memberName = trimmedName;
      let memberEmail = trimmedEmail || undefined;
      let connectedUserId: string | undefined;

      if (memberEmail) {
        const existingUser = await getUserByEmail(memberEmail);
        if (existingUser) {
          connectedUserId = existingUser.id;
          if (!memberName) {
            memberName = existingUser.name;
          }
        } else {
          if (!memberName) {
            memberName = memberEmail.split('@')[0];
          }
          const group = await getGroup(id);
          if (group) {
            const emailSent = await sendInvitationEmail(
              memberEmail,
              group.name,
            );
            if (!emailSent) {
              console.warn(
                'Failed to send invitation email, but continuing with member creation',
              );
            }
          }
        }
      }

      if (!memberName) {
        Alert.alert('Error', 'Could not determine member name');
        setLoading(false);
        return;
      }

      const member = await createGroupMember(
        id,
        memberName,
        memberEmail,
        connectedUserId,
      );

      if (member) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to add member');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Member</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.section}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              onBlur={() => setName((nm) => nm.trim())}
              placeholder="Member name"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.hint}>
              Required if email is not provided. If email matches an existing
              user, their name will be used if you leave this blank.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Email (optional)</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmail((em) => em.trim())}
              placeholder="member@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.hint}>
              If provided, the member will be connected to their account when
              they register. An invitation email will be sent if they don{"'"}t
              have an account yet.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.addButton, loading && styles.addButtonDisabled]}
            onPress={handleAddMember}
            disabled={loading}
          >
            <Text style={styles.addButtonText}>
              {loading ? 'Adding...' : 'Add Member'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  addButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
