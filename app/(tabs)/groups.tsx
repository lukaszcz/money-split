import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { getAllGroups, GroupWithMembers } from '../../services/groupRepository';
import { getGroupExpenses } from '../../services/groupRepository';
import { computeBalances } from '../../services/settlementService';
import { formatCurrency } from '../../utils/money';
import { getOrderedGroups } from '../../services/groupPreferenceService';

interface GroupWithSettledStatus extends GroupWithMembers {
  isSettled?: boolean;
}

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<GroupWithSettledStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadGroups = useCallback(async () => {
    const fetchedGroups = await getAllGroups();
    const orderedGroups = await getOrderedGroups(fetchedGroups);

    const groupIds = orderedGroups.map(g => g.id);

    const allExpensesMap = new Map<string, any[]>();

    if (groupIds.length > 0) {
      const { data: allExpenses } = await (await import('../../lib/supabase')).supabase
        .from('expenses')
        .select(`
          *,
          expense_shares (
            id,
            member_id,
            share_amount_scaled,
            share_in_main_scaled
          )
        `)
        .in('group_id', groupIds);

      (allExpenses || []).forEach((e: any) => {
        if (!allExpensesMap.has(e.group_id)) {
          allExpensesMap.set(e.group_id, []);
        }
        allExpensesMap.get(e.group_id)!.push({
          id: e.id,
          groupId: e.group_id,
          description: e.description || undefined,
          dateTime: e.date_time,
          currencyCode: e.currency_code,
          totalAmountScaled: BigInt(e.total_amount_scaled),
          payerMemberId: e.payer_member_id,
          exchangeRateToMainScaled: BigInt(e.exchange_rate_to_main_scaled),
          totalInMainScaled: BigInt(e.total_in_main_scaled),
          createdAt: e.created_at,
          paymentType: e.payment_type || 'expense',
          shares: (e.expense_shares || []).map((s: any) => ({
            id: s.id,
            memberId: s.member_id,
            shareAmountScaled: BigInt(s.share_amount_scaled),
            shareInMainScaled: BigInt(s.share_in_main_scaled),
          })),
        });
      });
    }

    const groupsWithSettledStatus = orderedGroups.map((group) => {
      const expenses = allExpensesMap.get(group.id) || [];

      let isSettled = false;
      if (expenses.length > 0) {
        const balances = computeBalances(expenses, group.members);
        isSettled = Array.from(balances.values()).every(balance => balance === 0n);
      }

      return {
        ...group,
        isSettled,
      };
    });

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
