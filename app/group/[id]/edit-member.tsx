import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import {
  getGroupMember,
  updateGroupMember,
  getUserByEmail,
  sendInvitationEmail,
  getGroup,
} from '../../../services/groupRepository';

export default function EditMemberScreen() {
  const { id, memberId } = useLocalSearchParams();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [originalEmail, setOriginalEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadMember();
  }, [memberId]);

  const loadMember = async () => {
    if (!memberId || typeof memberId !== 'string') {
      Alert.alert('Error', 'Invalid member');
      router.back();
      return;
    }

    const member = await getGroupMember(memberId);
    if (member) {
      setName(member.name);
      setEmail(member.email || '');
      setOriginalEmail(member.email || '');
    } else {
      Alert.alert('Error', 'Member not found');
      router.back();
    }
    setInitialLoading(false);
  };

  const handleUpdateMember = async () => {
    if (!name.trim() && !email.trim()) {
      Alert.alert('Error', 'Please enter a name or email');
      return;
    }

    if (!id || typeof id !== 'string' || !memberId || typeof memberId !== 'string') {
      Alert.alert('Error', 'Invalid group or member');
      return;
    }

    setLoading(true);

    try {
      let memberName = name.trim();
      let memberEmail = email.trim() || undefined;
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

      const updatedMember = await updateGroupMember(memberId, memberName, memberEmail, connectedUserId);

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

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Member</Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled">
          <View style={styles.section}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Member name"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="member@example.com"
              placeholderTextColor="#9ca3af"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.hint}>
              Changing the email will disconnect this member and reconnect them with the new email. If
              the new email matches an existing user, they will be connected automatically. Otherwise,
              an invitation will be sent.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.updateButton, loading && styles.updateButtonDisabled]}
            onPress={handleUpdateMember}
            disabled={loading}>
            <Text style={styles.updateButtonText}>{loading ? 'Updating...' : 'Update Member'}</Text>
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
});
