import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { useState, useEffect } from 'react';
import { RefreshCw, LogOut, User, Edit2, Check, X, Trash2 } from 'lucide-react-native';
import { getLastRefreshTime, refreshAllRates, getCachedRates } from '../../services/exchangeRateService';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { getUser, updateUserName, deleteUserAccount } from '../../services/groupRepository';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [rateCount, setRateCount] = useState(0);
  const [userName, setUserName] = useState<string>('');
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState<string>('');

  useEffect(() => {
    loadRefreshInfo();
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user?.id) return;
    const userData = await getUser(user.id);
    if (userData) {
      setUserName(userData.name);
      setTempName(userData.name);
    }
  };

  const loadRefreshInfo = async () => {
    const lastTime = await getLastRefreshTime();
    setLastRefresh(lastTime);

    const rates = await getCachedRates();
    setRateCount(rates.length);
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);

    try {
      const rates = await getCachedRates();
      const currencies = new Set<string>();

      rates.forEach(rate => {
        currencies.add(rate.baseCurrencyCode);
        currencies.add(rate.quoteCurrencyCode);
      });

      if (currencies.size === 0) {
        currencies.add('USD');
        currencies.add('EUR');
        currencies.add('GBP');
      }

      await refreshAllRates(Array.from(currencies));

      await loadRefreshInfo();

      Alert.alert('Success', 'Exchange rates refreshed successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to refresh exchange rates');
    } finally {
      setRefreshing(false);
    }
  };

  const formatLastRefresh = () => {
    if (!lastRefresh) return 'Never';

    const now = Date.now();
    const diff = now - lastRefresh.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  };

  const handleSaveName = async () => {
    if (!user?.id || !tempName.trim()) return;

    try {
      const result = await updateUserName(user.id, tempName.trim());
      if (result) {
        setUserName(result.name);
        setEditingName(false);
        Alert.alert('Success', 'Name updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update name');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update name');
    }
  };

  const handleCancelEdit = () => {
    setTempName(userName);
    setEditingName(false);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/auth');
          } catch (error) {
            Alert.alert('Error', 'Failed to logout');
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you absolutely sure you want to delete your account? This will:\n\n• Delete all groups you own\n• Remove all expenses in your groups\n• Disconnect you from groups you are a member of\n• Permanently erase all your data\n\nThis action cannot be undone.',
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
                    const success = await deleteUserAccount();
                    if (success) {
                      router.replace('/auth');
                    } else {
                      Alert.alert('Error', 'Failed to delete account. Please try again later.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
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
                  placeholder="Enter your name"
                  autoFocus
                />
                <View style={styles.nameEditButtons}>
                  <TouchableOpacity style={styles.nameEditButton} onPress={handleSaveName}>
                    <Check color="#059669" size={20} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.nameEditButton} onPress={handleCancelEdit}>
                    <X color="#6b7280" size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.nameDisplayContainer}>
                <Text style={styles.nameText}>{userName || 'No name set'}</Text>
                <TouchableOpacity onPress={() => setEditingName(true)}>
                  <Edit2 color="#2563eb" size={18} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color="#ef4444" size={20} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Danger Zone</Text>

        <View style={styles.card}>
          <Text style={styles.dangerWarning}>
            Deleting your account is permanent and cannot be undone. All groups you own and their
            data will be permanently deleted.
          </Text>

          <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
            <Trash2 color="#ffffff" size={20} />
            <Text style={styles.deleteAccountButtonText}>Delete My Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exchange Rates</Text>

        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last updated:</Text>
            <Text style={styles.infoValue}>{formatLastRefresh()}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cached rates:</Text>
            <Text style={styles.infoValue}>{rateCount}</Text>
          </View>

          <TouchableOpacity
            style={[styles.refreshButton, refreshing && styles.refreshButtonDisabled]}
            onPress={handleManualRefresh}
            disabled={refreshing}>
            <RefreshCw color="#ffffff" size={20} />
            <Text style={styles.refreshButtonText}>
              {refreshing ? 'Refreshing...' : 'Refresh Now'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.helpText}>
          Exchange rates are automatically fetched from the internet and cached for 12 hours. When
          offline, the app will use the last cached rates.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>

        <View style={styles.card}>
          <Text style={styles.appName}>MoneySplit</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.appDescription}>
            Track shared expenses and debts with friends. All calculations use fixed-point
            arithmetic with 4 decimal places precision for accuracy.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Technical Details</Text>

        <View style={styles.card}>
          <Text style={styles.techDetail}>• Money stored as integers scaled by 10,000</Text>
          <Text style={styles.techDetail}>• 4 decimal places internal precision</Text>
          <Text style={styles.techDetail}>• 2 decimal places display precision</Text>
          <Text style={styles.techDetail}>• No floating point drift</Text>
          <Text style={styles.techDetail}>• Deterministic rounding with remainder distribution</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    paddingTop: 60,
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
});
