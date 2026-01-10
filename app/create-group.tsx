import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { X, Plus, Check, Trash2, User, Mail } from 'lucide-react-native';
import {
  createGroup,
  getUserByEmail,
  sendInvitationEmail,
  ensureUserProfile,
} from '../services/groupRepository';
import { useCurrencyOrder } from '../hooks/useCurrencyOrder';
import { isValidEmail, isDuplicateMemberName } from '../utils/validation';

interface PendingMember {
  id: string;
  name: string;
  email?: string;
}

export default function CreateGroupScreen() {
  const router = useRouter();
  const [groupName, setGroupName] = useState('');
  const [mainCurrency, setMainCurrency] = useState('');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [hasDuplicateName, setHasDuplicateName] = useState(false);

  const {
    currencies: orderedCurrencies,
    selectCurrency,
    loading: currenciesLoading,
  } = useCurrencyOrder();

  useEffect(() => {
    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currenciesLoading && orderedCurrencies.length > 0 && !mainCurrency) {
      setMainCurrency(orderedCurrencies[0].code);
    }
  }, [orderedCurrencies, currenciesLoading, mainCurrency]);

  const loadCurrentUser = async () => {
    const userProfile = await ensureUserProfile();
    if (userProfile) {
      setCurrentUserName(userProfile.name);
    }
  };

  const checkForDuplicateName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setHasDuplicateName(false);
      return false;
    }

    const allMemberNames = [
      currentUserName,
      ...pendingMembers.map((m) => m.name),
    ].filter((name) => name && name.trim());

    const isDuplicate = isDuplicateMemberName(trimmedName, allMemberNames);
    setHasDuplicateName(isDuplicate);
    return isDuplicate;
  };

  const handleAddMember = async () => {
    if (!newMemberName.trim() && !newMemberEmail.trim()) {
      Alert.alert('Error', 'Please enter a name or email');
      return;
    }

    let memberName = newMemberName.trim();
    let memberEmail = newMemberEmail.trim() || undefined;

    if (memberEmail && !isValidEmail(memberEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (memberEmail) {
      const existingUser = await getUserByEmail(memberEmail);
      if (existingUser) {
        if (!memberName) {
          memberName = existingUser.name;
        }
      } else {
        if (!memberName) {
          memberName = memberEmail.split('@')[0];
        }
      }
    }

    if (!memberName) {
      Alert.alert('Error', 'Could not determine member name');
      return;
    }

    // Check for duplicate names
    if (checkForDuplicateName(memberName)) {
      Alert.alert(
        'Duplicate Name',
        'A member with this name already exists in the group. Please use a unique name.',
      );
      return;
    }

    const newMember: PendingMember = {
      id: Date.now().toString(),
      name: memberName,
      email: memberEmail,
    };

    setPendingMembers([...pendingMembers, newMember]);
    setNewMemberName('');
    setNewMemberEmail('');
    setHasDuplicateName(false);
    setShowAddMember(false);
  };

  const removeMember = (memberId: string) => {
    setPendingMembers(pendingMembers.filter((m) => m.id !== memberId));
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    const initialMembers = pendingMembers.map((m) => ({
      name: m.name,
      email: m.email,
    }));

    const group = await createGroup(
      groupName.trim(),
      mainCurrency,
      initialMembers,
    );

    if (group) {
      for (const member of pendingMembers) {
        if (member.email) {
          const existingUser = await getUserByEmail(member.email);
          if (!existingUser) {
            sendInvitationEmail(member.email, groupName.trim());
          }
        }
      }
      router.back();
    } else {
      Alert.alert(
        'Error',
        'Failed to create group. Check console for details.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <X color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Group</Text>
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
            <Text style={styles.label}>Group Name *</Text>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              onBlur={() => setGroupName((name) => name.trim())}
              placeholder="e.g., Trip to Paris"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Main Currency *</Text>
            <TouchableOpacity
              style={styles.currencyButton}
              onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
            >
              <Text style={styles.currencyButtonText}>
                {mainCurrency || 'Loading...'}
              </Text>
            </TouchableOpacity>

            {showCurrencyPicker && (
              <ScrollView style={styles.currencyList} nestedScrollEnabled>
                {orderedCurrencies.map((currency) => (
                  <TouchableOpacity
                    key={currency.code}
                    style={styles.currencyItem}
                    onPress={() => {
                      setMainCurrency(currency.code);
                      selectCurrency(currency.code);
                      setShowCurrencyPicker(false);
                    }}
                  >
                    <Text style={styles.currencyCode}>{currency.code}</Text>
                    <Text style={styles.currencyName}>{currency.name}</Text>
                    {mainCurrency === currency.code && (
                      <Check color="#2563eb" size={20} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Members</Text>
              <TouchableOpacity
                style={styles.addMemberToggle}
                onPress={() => setShowAddMember(!showAddMember)}
              >
                <Plus color="#2563eb" size={20} />
                <Text style={styles.addMemberToggleText}>Add</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.memberCard}>
              <View style={styles.memberIcon}>
                <User color="#2563eb" size={16} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {currentUserName || 'You'}
                </Text>
                <Text style={styles.memberLabel}>You (creator)</Text>
              </View>
            </View>

            {pendingMembers.map((member) => (
              <View key={member.id} style={styles.memberCard}>
                <View style={styles.memberIcon}>
                  <User color="#6b7280" size={16} />
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.name}</Text>
                  {member.email && (
                    <View style={styles.emailRow}>
                      <Mail color="#9ca3af" size={12} />
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => removeMember(member.id)}
                  style={styles.removeButton}
                >
                  <Trash2 color="#ef4444" size={18} />
                </TouchableOpacity>
              </View>
            ))}

            {showAddMember && (
              <View style={styles.addMemberForm}>
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    hasDuplicateName && styles.inputError,
                  ]}
                  value={newMemberName}
                  onChangeText={(text) => {
                    setNewMemberName(text);
                    checkForDuplicateName(text);
                  }}
                  onBlur={() => setNewMemberName((name) => name.trim())}
                  placeholder="Member name"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={[styles.formLabel, styles.formLabelSpaced]}>
                  Email (optional)
                </Text>
                <TextInput
                  style={styles.input}
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  onBlur={() => setNewMemberEmail((email) => email.trim())}
                  placeholder="member@example.com"
                  placeholderTextColor="#9ca3af"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.formHint}>
                  If only email is provided, the name will be taken from the
                  user&#39;s account or derived from the email.
                </Text>

                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={styles.formCancelButton}
                    onPress={() => {
                      setShowAddMember(false);
                      setNewMemberName('');
                      setNewMemberEmail('');
                    }}
                  >
                    <Text style={styles.formCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.formAddButton}
                    onPress={handleAddMember}
                  >
                    <Text style={styles.formAddButtonText}>Add Member</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {pendingMembers.length === 0 && !showAddMember && (
              <Text style={styles.noMembersText}>
                Add members to split expenses with. You can also add members
                later.
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
            <Text style={styles.createButtonText}>Create Group</Text>
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
  closeButton: {
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
    paddingBottom: 100,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  currencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  currencyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  currencyList: {
    maxHeight: 200,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 8,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    width: 60,
  },
  currencyName: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  addMemberToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  addMemberToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  memberIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  memberLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  memberEmail: {
    fontSize: 13,
    color: '#9ca3af',
  },
  removeButton: {
    padding: 8,
  },
  addMemberForm: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  formLabelSpaced: {
    marginTop: 12,
  },
  formHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 16,
  },
  formButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  formCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  formCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  formAddButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  formAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  noMembersText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 16,
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  createButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
