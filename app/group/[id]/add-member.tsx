import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import {
  createGroupMember,
  getUserByEmail,
  sendInvitationEmail,
  getGroup,
  getGroupMembers,
  KnownUser,
} from '../../../services/groupRepository';
import { isValidEmail, isDuplicateMemberName } from '../../../utils/validation';
import { KnownUserSuggestionInput } from '../../../components/KnownUserSuggestionInput';

export default function AddMemberScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [existingMemberNames, setExistingMemberNames] = useState<string[]>([]);
  const [hasDuplicateName, setHasDuplicateName] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [membersLoadError, setMembersLoadError] = useState(false);
  const controlsDisabled = loading || membersLoading;

  const loadExistingMembers = useCallback(async () => {
    if (!id || typeof id !== 'string') return [];
    setMembersLoading(true);
    setMembersLoadError(false);
    try {
      const members = await getGroupMembers(id);
      if (members === null) {
        setMembersLoadError(true);
        return null;
      }
      const names = members.map((m) => m.name);
      setExistingMemberNames(names);
      setMembersLoaded(true);
      return names;
    } catch (error) {
      console.error('Error loading group members:', error);
      setMembersLoadError(true);
      return null;
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadExistingMembers();
  }, [loadExistingMembers]);

  const checkForDuplicateName = useCallback(
    (nameToCheck: string) => {
      const isDuplicate = isDuplicateMemberName(
        nameToCheck,
        existingMemberNames,
      );
      setHasDuplicateName(isDuplicate);
      return isDuplicate;
    },
    [existingMemberNames],
  );

  useEffect(() => {
    if (name.trim()) {
      checkForDuplicateName(name);
    }
  }, [checkForDuplicateName, name]);

  const handleAddMember = async () => {
    if (controlsDisabled) {
      return;
    }

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

    if (membersLoading) {
      Alert.alert('Please wait', 'Loading existing members...');
      return;
    }

    setLoading(true);
    let shouldResetLoading = true;

    try {
      let currentMemberNames = existingMemberNames;
      if (!membersLoaded || membersLoadError) {
        const refreshedNames = await loadExistingMembers();
        if (!refreshedNames) {
          Alert.alert(
            'Error',
            'Unable to load existing members. Please try again.',
          );
          return;
        }
        currentMemberNames = refreshedNames;
      }

      let memberName = trimmedName;
      const memberEmail = trimmedEmail || undefined;
      const nameWasDerived = !memberName && !!memberEmail;
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
        return;
      }

      // Check for duplicate names
      if (isDuplicateMemberName(memberName, currentMemberNames)) {
        setHasDuplicateName(true);
        // If name was derived from email, populate the input so user can see and edit it
        if (nameWasDerived) {
          setName(memberName);
        }
        Alert.alert(
          'Duplicate Name',
          'A member with this name already exists in the group. Please use a unique name.',
        );
        return;
      }

      const member = await createGroupMember(
        id,
        memberName,
        memberEmail,
        connectedUserId,
      );

      if (member) {
        shouldResetLoading = false;
        router.back();
      } else {
        Alert.alert('Error', 'Failed to add member');
      }
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to add member');
    } finally {
      if (shouldResetLoading) {
        setLoading(false);
      }
    }
  };

  const handleSelectKnownUser = (user: KnownUser) => {
    setName(user.name);
    setEmail(user.email || '');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          disabled={controlsDisabled}
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
          <KnownUserSuggestionInput
            nameValue={name}
            onNameChange={(text) => {
              setName(text);
              checkForDuplicateName(text);
            }}
            emailValue={email}
            onEmailChange={setEmail}
            onSelectUser={handleSelectKnownUser}
            hasDuplicateName={hasDuplicateName}
            onNameBlur={(value) => setName(value.trim())}
            onEmailBlur={(value) => setEmail(value.trim())}
            disabled={controlsDisabled}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.addButton,
              (loading || membersLoading) && styles.addButtonDisabled,
            ]}
            onPress={handleAddMember}
            disabled={loading || membersLoading}
          >
            <Text style={styles.addButtonText}>
              {membersLoading
                ? 'Loading members...'
                : loading
                  ? 'Adding...'
                  : 'Add Member'}
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
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
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
