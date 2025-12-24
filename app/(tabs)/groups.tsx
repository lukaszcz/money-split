import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { getAllGroups, GroupWithMembers } from '../../services/groupRepository';
import { getGroupExpenses } from '../../services/groupRepository';
import { computeBalances } from '../../services/settlementService';
import { formatCurrency } from '../../utils/money';

interface GroupWithSettledStatus extends GroupWithMembers {
  isSettled?: boolean;
}

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithSettledStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const checkIfGroupIsSettled = async (group: GroupWithMembers): Promise<boolean> => {
    const expenses = await getGroupExpenses(group.id);

    if (expenses.length === 0) {
      return false;
    }

    const balances = computeBalances(expenses, group.members);

    const allBalancesZero = Array.from(balances.values()).every(balance => balance === 0n);

    return allBalancesZero;
  };

  const loadGroups = useCallback(async () => {
    const fetchedGroups = await getAllGroups();

    const groupsWithSettledStatus = await Promise.all(
      fetchedGroups.map(async (group) => ({
        ...group,
        isSettled: await checkIfGroupIsSettled(group),
      }))
    );

    setGroups(groupsWithSettledStatus);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  const renderGroupItem = ({ item }: { item: GroupWithSettledStatus }) => (
    <TouchableOpacity
      style={[styles.groupCard, item.isSettled && styles.groupCardSettled]}
      onPress={() => router.push(`/group/${item.id}` as any)}>
      <View style={styles.groupHeader}>
        <Text style={[styles.groupName, item.isSettled && styles.groupNameSettled]}>{item.name}</Text>
        <Text style={[styles.currency, item.isSettled && styles.currencySettled]}>{item.mainCurrencyCode}</Text>
      </View>
      <Text style={[styles.members, item.isSettled && styles.membersSettled]}>
        {item.members.length} {item.members.length === 1 ? 'member' : 'members'}
        {item.isSettled && ' • Settled'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Groups</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create-group' as any)}>
          <Plus color="#ffffff" size={24} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text>Loading groups...</Text>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No groups yet</Text>
          <Text style={styles.emptySubtext}>Create your first group to get started</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          renderItem={renderGroupItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
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
  addButton: {
    backgroundColor: '#2563eb',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  groupCardSettled: {
    backgroundColor: '#fafbfc',
    borderColor: '#e5e7eb',
    opacity: 0.75,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  groupNameSettled: {
    color: '#6b7280',
  },
  currency: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  currencySettled: {
    color: '#9ca3af',
    backgroundColor: '#f9fafb',
  },
  members: {
    fontSize: 14,
    color: '#6b7280',
  },
  membersSettled: {
    color: '#9ca3af',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
