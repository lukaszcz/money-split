import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { X, Plus, Check } from 'lucide-react-native';
import { createGroup, createUser, getAllUsers, User, ensureUserProfile } from '../services/groupRepository';
import { CURRENCIES } from '../utils/currencies';
import { useAuth } from '@/contexts/AuthContext';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [groupName, setGroupName] = useState('');
  const [mainCurrency, setMainCurrency] = useState('USD');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const userProfile = await ensureUserProfile();
    if (userProfile) {
      setCurrentUser(userProfile);
      setSelectedMembers([userProfile.id]);
    }

    const users = await getAllUsers();
    setAllUsers(users);
  };

  const handleAddNewMember = async () => {
    if (!newMemberName.trim()) {
      Alert.alert('Error', 'Please enter a name');
      return;
    }

    const newUser = await createUser(newMemberName.trim());
    if (newUser) {
      setAllUsers([...allUsers, newUser]);
      setSelectedMembers([...selectedMembers, newUser.id]);
      setNewMemberName('');
    } else {
      Alert.alert('Error', 'Failed to create user');
    }
  };

  const toggleMember = (userId: string) => {
    if (userId === currentUser?.id) {
      Alert.alert('Notice', 'You are always included in your groups');
      return;
    }

    if (selectedMembers.includes(userId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== userId));
    } else {
      setSelectedMembers([...selectedMembers, userId]);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedMembers.length < 2) {
      Alert.alert('Error', 'Please add at least 1 other member');
      return;
    }

    console.log('Auth user:', authUser ? 'authenticated' : 'not authenticated');
    console.log('Creating group with members:', selectedMembers);

    const group = await createGroup(groupName.trim(), mainCurrency, selectedMembers);

    if (group) {
      router.back();
    } else {
      Alert.alert('Error', 'Failed to create group. Check console for details.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <X color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Create Group</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Group Name *</Text>
          <TextInput
            style={styles.input}
            value={groupName}
            onChangeText={setGroupName}
            placeholder="e.g., Trip to Paris"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Main Currency *</Text>
          <TouchableOpacity
            style={styles.currencyButton}
            onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}>
            <Text style={styles.currencyButtonText}>{mainCurrency}</Text>
          </TouchableOpacity>

          {showCurrencyPicker && (
            <ScrollView style={styles.currencyList} nestedScrollEnabled>
              {CURRENCIES.map(currency => (
                <TouchableOpacity
                  key={currency.code}
                  style={styles.currencyItem}
                  onPress={() => {
                    setMainCurrency(currency.code);
                    setShowCurrencyPicker(false);
                  }}>
                  <Text style={styles.currencyCode}>{currency.code}</Text>
                  <Text style={styles.currencyName}>{currency.name}</Text>
                  {mainCurrency === currency.code && <Check color="#2563eb" size={20} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Add New Member</Text>
          <View style={styles.addMemberRow}>
            <TextInput
              style={[styles.input, styles.addMemberInput]}
              value={newMemberName}
              onChangeText={setNewMemberName}
              placeholder="Member name"
              placeholderTextColor="#9ca3af"
            />
            <TouchableOpacity style={styles.addMemberButton} onPress={handleAddNewMember}>
              <Plus color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Select Members * (min. 2)</Text>
          {allUsers.map(user => {
            const isCurrentUser = user.id === currentUser?.id;
            const isSelected = selectedMembers.includes(user.id);
            return (
              <TouchableOpacity
                key={user.id}
                style={[
                  styles.memberItem,
                  isSelected && styles.memberItemSelected,
                ]}
                onPress={() => toggleMember(user.id)}>
                <View style={styles.memberInfo}>
                  <Text
                    style={[
                      styles.memberName,
                      isSelected && styles.memberNameSelected,
                    ]}>
                    {user.name}
                  </Text>
                  {isCurrentUser && <Text style={styles.youLabel}>(You)</Text>}
                </View>
                {isSelected && <Check color="#2563eb" size={20} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.createButton} onPress={handleCreate}>
          <Text style={styles.createButtonText}>Create Group</Text>
        </TouchableOpacity>
      </View>
    </View>
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
    paddingTop: 60,
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
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
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
  addMemberRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addMemberInput: {
    flex: 1,
  },
  addMemberButton: {
    backgroundColor: '#2563eb',
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 8,
  },
  memberItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberName: {
    fontSize: 16,
    color: '#111827',
  },
  memberNameSelected: {
    fontWeight: '600',
    color: '#2563eb',
  },
  youLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
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
