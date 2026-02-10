import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
import {
  LogOut,
  User,
  Edit2,
  Check,
  X,
  Trash2,
  KeyRound,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router, type Href } from 'expo-router';
import {
  getUser,
  updateUserName,
  deleteUserAccount,
} from '../../services/groupRepository';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [userName, setUserName] = useState<string>('');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState<string>('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const controlsDisabled = deletingAccount || savingName || signingOut;

  const loadUserProfile = useCallback(async () => {
    if (!user?.id) return;
    const userData = await getUser(user.id);
    if (userData) {
      setUserName(userData.name);
      setTempName(userData.name);
    }
  }, [user]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleSaveName = async () => {
    if (controlsDisabled || !user?.id || !tempName.trim()) return;

    setSavingName(true);
    try {
      const result = await updateUserName(user.id, tempName.trim());
      if (result) {
        setUserName(result.name);
        setEditingName(false);
      } else {
        Alert.alert('Error', 'Failed to update name');
      }
    } catch (error) {
      console.error('Failed to update name', error);
      Alert.alert('Error', 'Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    if (controlsDisabled) {
      return;
    }

    setTempName(userName);
    setEditingName(false);
  };

  const handleLogout = async () => {
    if (controlsDisabled) {
      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          let shouldResetSigningOut = true;
          try {
            await signOut();
            shouldResetSigningOut = false;
            router.replace('/auth');
          } catch (error) {
            console.error('Failed to logout', error);
            Alert.alert('Error', 'Failed to logout');
          } finally {
            if (shouldResetSigningOut) {
              setSigningOut(false);
            }
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    if (controlsDisabled) {
      return;
    }

    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This will:\n\n• Disconnect you from groups you are a member of\n• Permanently erase all your data\n\nThis action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'This is your last chance. Are you sure you want to permanently delete your account and all associated data?',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Yes, Delete Forever',
                  style: 'destructive',
                  onPress: async () => {
                    setDeletingAccount(true);
                    try {
                      const success = await deleteUserAccount(user?.id);
                      if (success) {
                        router.replace('/auth');
                        return;
                      }

                      setDeletingAccount(false);
                      Alert.alert(
                        'Error',
                        'Failed to delete account. Please try again later.',
                      );
                    } catch (error) {
                      console.error('Failed to delete account', error);
                      setDeletingAccount(false);
                      Alert.alert(
                        'Error',
                        'Failed to delete account. Please try again later.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView scrollEnabled={!controlsDisabled}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>

          <View style={styles.card}>
            <View style={styles.profileHeader}>
              <View style={styles.profileIcon}>
                <User color="#2563eb" size={24} />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileEmail}>{user?.email}</Text>
                <Text style={styles.profileLabel}>Signed in</Text>
              </View>
            </View>

            <View style={styles.nameSection}>
              <Text style={styles.nameLabel}>Display Name</Text>
              {editingName ? (
                <View style={styles.nameEditContainer}>
                  <TextInput
                    style={styles.nameInput}
                    value={tempName}
                    onChangeText={setTempName}
                    onBlur={() => setTempName((name) => name.trim())}
                    placeholder="Enter your name"
                    autoFocus
                    editable={!controlsDisabled}
                  />
                  <View style={styles.nameEditButtons}>
                    <TouchableOpacity
                      style={[
                        styles.nameEditButton,
                        controlsDisabled && styles.buttonDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Save display name"
                      onPress={handleSaveName}
                      disabled={controlsDisabled}
                    >
                      <Check color="#059669" size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.nameEditButton,
                        controlsDisabled && styles.buttonDisabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel display name edit"
                      onPress={handleCancelEdit}
                      disabled={controlsDisabled}
                    >
                      <X color="#6b7280" size={20} />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.nameDisplayContainer}>
                  <Text style={styles.nameText}>
                    {userName || 'No name set'}
                  </Text>
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Edit display name"
                    onPress={() => setEditingName(true)}
                    disabled={controlsDisabled}
                  >
                    <Edit2 color="#2563eb" size={18} />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.changePasswordButton,
                controlsDisabled && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Change password"
              onPress={() => router.push('/change-password' as Href)}
              disabled={controlsDisabled}
            >
              <KeyRound color="#2563eb" size={20} />
              <Text style={styles.changePasswordButtonText}>
                Change password
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.logoutButton,
                controlsDisabled && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Logout"
              onPress={handleLogout}
              disabled={controlsDisabled}
            >
              <LogOut color="#ef4444" size={20} />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>

          <View style={styles.card}>
            <Text style={styles.dangerWarning}>
              Deleting your account is permanent and cannot be undone.
            </Text>

            <TouchableOpacity
              style={[
                styles.deleteAccountButton,
                controlsDisabled && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              onPress={handleDeleteAccount}
              disabled={controlsDisabled}
            >
              <Trash2 color="#ffffff" size={20} />
              <Text style={styles.deleteAccountButtonText}>
                Delete My Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.card}>
            <Text style={styles.appName}>MoneySplit</Text>
            <Text style={styles.appVersion}>Version 1.0.0 beta</Text>
            <Text style={styles.appDescription}>
              Track shared expenses and debts with friends.
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={deletingAccount || signingOut}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ActivityIndicator size="large" color="#2563eb" />
            <Text style={styles.modalText}>
              {deletingAccount ? 'Deleting your account...' : 'Signing out...'}
            </Text>
            <Text style={styles.modalSubtext}>This may take a few moments</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  refreshButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  refreshButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  helpText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 12,
    lineHeight: 18,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  appDescription: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  techDetail: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 8,
    lineHeight: 18,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  profileLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  changePasswordButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    marginBottom: 12,
  },
  changePasswordButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  nameSection: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  nameLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameDisplayContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  nameEditContainer: {
    gap: 8,
  },
  nameInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  nameEditButtons: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  nameEditButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  dangerWarning: {
    fontSize: 14,
    color: '#dc2626',
    lineHeight: 20,
    marginBottom: 16,
  },
  deleteAccountButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  deleteAccountButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 280,
  },
  modalText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    textAlign: 'center',
  },
  modalSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
