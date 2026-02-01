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
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import {
  getGroupMember,
  updateGroupMember,
  getUserByEmail,
  sendInvitationEmail,
  getGroup,
  canDeleteGroupMember,
  deleteGroupMember,
  getGroupMembers,
  getCurrentUserMemberInGroup,
  leaveGroup,
  KnownUser,
} from '../../../services/groupRepository';
import { isValidEmail, isDuplicateMemberName } from '../../../utils/validation';
import { KnownUserSuggestionInput } from '../../../components/KnownUserSuggestionInput';

export default function EditMemberScreen() {
  const { id, memberId } = useLocalSearchParams();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(true);
  const [otherMemberNames, setOtherMemberNames] = useState<string[]>([]);
  const [hasDuplicateName, setHasDuplicateName] = useState(false);
  const [otherMembersLoading, setOtherMembersLoading] = useState(false);
  const [otherMembersLoaded, setOtherMembersLoaded] = useState(false);
  const [otherMembersLoadError, setOtherMembersLoadError] = useState(false);
  const [isCurrentUserMember, setIsCurrentUserMember] = useState(false);

  const loadOtherMembers = useCallback(async () => {
    if (
      !id ||
      typeof id !== 'string' ||
      !memberId ||
      typeof memberId !== 'string'
    ) {
      return null;
    }
    setOtherMembersLoading(true);
    setOtherMembersLoadError(false);
    try {
      const members = await getGroupMembers(id);
      if (!members) {
        setOtherMembersLoadError(true);
        return null;
      }
      const otherNames = members
        .filter((m) => m.id !== memberId)
        .map((m) => m.name);
      setOtherMemberNames(otherNames);
      setOtherMembersLoaded(true);
      return otherNames;
    } finally {
      setOtherMembersLoading(false);
    }
  }, [id, memberId]);

  const loadMember = useCallback(async () => {
    if (!memberId || typeof memberId !== 'string') {
      Alert.alert('Error', 'Invalid member');
      router.back();
      return;
    }

    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Invalid group');
      router.back();
      return;
    }

    const member = await getGroupMember(memberId);
    if (member) {
      setName(member.name);
      setEmail(member.email || '');
      setOriginalEmail(member.email || '');

      // Check if member can be deleted
      const deletable = await canDeleteGroupMember(memberId);
      setCanDelete(deletable);
      setCheckingDelete(false);

      const currentMember = await getCurrentUserMemberInGroup(id);
      setIsCurrentUserMember(currentMember?.id === member.id);

      await loadOtherMembers();
    } else {
      Alert.alert('Error', 'Member not found');
      router.back();
    }
    setInitialLoading(false);
  }, [memberId, id, router, loadOtherMembers]);

  const checkForDuplicateName = useCallback(
    (nameToCheck: string) => {
      const isDuplicate = isDuplicateMemberName(nameToCheck, otherMemberNames);
      setHasDuplicateName(isDuplicate);
      return isDuplicate;
    },
    [otherMemberNames],
  );

  useEffect(() => {
    loadMember();
  }, [loadMember]);

  useEffect(() => {
    if (name.trim()) {
      checkForDuplicateName(name);
    }
  }, [checkForDuplicateName, name]);

  const handleUpdateMember = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName && !trimmedEmail) {
      Alert.alert('Error', 'Please enter a name or email');
      return;
    }

    if (
      !id ||
      typeof id !== 'string' ||
      !memberId ||
      typeof memberId !== 'string'
    ) {
      Alert.alert('Error', 'Invalid group or member');
      return;
    }

    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (otherMembersLoading) {
      Alert.alert('Please wait', 'Loading existing members...');
      return;
    }

    setLoading(true);

    try {
      let currentOtherMemberNames = otherMemberNames;
      if (!otherMembersLoaded || otherMembersLoadError) {
        const refreshedNames = await loadOtherMembers();
        if (!refreshedNames) {
          Alert.alert(
            'Error',
            'Unable to load existing members. Please try again.',
          );
          return;
        }
        currentOtherMemberNames = refreshedNames;
      }

      let memberName = trimmedName;
      const memberEmail = trimmedEmail || undefined;
      const nameWasDerived = !memberName && !!memberEmail;
      let connectedUserId: string | undefined;
      const emailChanged = memberEmail !== originalEmail;

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
          if (emailChanged) {
            const group = await getGroup(id);
            if (group) {
              sendInvitationEmail(memberEmail, group.name);
            }
          }
        }
      }

      if (!memberName) {
        Alert.alert('Error', 'Could not determine member name');
        setLoading(false);
        return;
      }

      // Check for duplicate names
      if (isDuplicateMemberName(memberName, currentOtherMemberNames)) {
        setHasDuplicateName(true);
        // If name was derived from email, populate the input so user can see and edit it
        if (nameWasDerived) {
          setName(memberName);
        }
        Alert.alert(
          'Duplicate Name',
          'A member with this name already exists in the group. Please use a unique name.',
        );
        setLoading(false);
        return;
      }

      const updatedMember = await updateGroupMember(
        memberId,
        memberName,
        memberEmail,
        connectedUserId,
      );

      if (updatedMember) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to update member');
      }
    } catch (error) {
      console.error('Error updating member:', error);
      Alert.alert('Error', 'Failed to update member');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectKnownUser = (user: KnownUser) => {
    setName(user.name);
    setEmail(user.email || '');
  };

  const handleDeleteMember = async () => {
    if (!memberId || typeof memberId !== 'string') {
      Alert.alert('Error', 'Invalid member');
      return;
    }

    if (!id || typeof id !== 'string') {
      Alert.alert('Error', 'Invalid group');
      return;
    }

    Alert.alert(
      isCurrentUserMember ? 'Leave Group' : 'Delete Member',
      isCurrentUserMember
        ? 'Are you sure you want to leave this group? If you are the last member, the group will be deleted.'
        : 'Are you sure you want to remove this member from the group? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: isCurrentUserMember ? 'Leave' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const success = isCurrentUserMember
                ? await leaveGroup(id)
                : await deleteGroupMember(memberId);
              if (success) {
                if (isCurrentUserMember) {
                  router.replace('/(tabs)/groups' as any);
                } else {
                  router.back();
                }
              } else {
                Alert.alert(
                  'Error',
                  isCurrentUserMember
                    ? 'Failed to leave group. Please try again.'
                    : 'Failed to delete member. Please try again.',
                );
              }
            } catch (error) {
              console.error('Error deleting member:', error);
              Alert.alert(
                'Error',
                isCurrentUserMember
                  ? 'Failed to leave group'
                  : 'Failed to delete member',
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft color="#111827" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Loading...</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Member</Text>
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
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.updateButton,
              (loading || otherMembersLoading) && styles.updateButtonDisabled,
            ]}
            onPress={handleUpdateMember}
            disabled={loading || otherMembersLoading}
          >
            <Text style={styles.updateButtonText}>
              {otherMembersLoading
                ? 'Loading members...'
                : loading
                  ? 'Updating...'
                  : 'Update Member'}
            </Text>
          </TouchableOpacity>

          {(isCurrentUserMember || (canDelete && !checkingDelete)) && (
            <TouchableOpacity
              style={[
                styles.deleteButton,
                loading && styles.deleteButtonDisabled,
              ]}
              onPress={handleDeleteMember}
              disabled={loading}
            >
              <Trash2 color="#dc2626" size={20} />
              <Text style={styles.deleteButtonText}>
                {isCurrentUserMember ? 'Leave Group' : 'Remove from Group'}
              </Text>
            </TouchableOpacity>
          )}

          {!isCurrentUserMember && !canDelete && !checkingDelete && (
            <Text style={styles.deleteHint}>
              This member cannot be removed. Members involved in any expenses
              cannot be deleted.
            </Text>
          )}
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
  updateButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
    marginTop: 12,
    gap: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.5,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
