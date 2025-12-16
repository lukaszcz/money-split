import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useState, useCallback } from 'react';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, User, Mail, Link, Trash2 } from 'lucide-react-native';
import {
  getGroup,
  getGroupExpenses,
  deleteGroup,
  isGroupOwner,
  Expense,
  GroupWithMembers,
  GroupMember,
} from '../../services/groupRepository';
import { computeBalances } from '../../services/settlementService';
import { formatNumber } from '../../utils/money';
import { getCurrencySymbol } from '../../utils/currencies';

type Tab = 'expenses' | 'balances' | 'members' | 'settle';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('expenses');
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const loadData = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    const fetchedGroup = await getGroup(id);
    const fetchedExpenses = await getGroupExpenses(id);
    const ownerStatus = await isGroupOwner(id);

    setGroup(fetchedGroup);
    setExpenses(fetchedExpenses);
    setIsOwner(ownerStatus);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading || !group) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#111827" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </View>
    );
  }

  const currencySymbol = getCurrencySymbol(group.mainCurrencyCode);
  const balances = computeBalances(expenses, group.members);

  const handleAddPress = () => {
    if (activeTab === 'expenses') {
      router.push(`/group/${id}/add-expense` as any);
    } else if (activeTab === 'members') {
      router.push(`/group/${id}/add-member` as any);
    }
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This will permanently remove all expenses, members, and data associated with this group. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id || typeof id !== 'string') return;

            const success = await deleteGroup(id);
            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete group. You must be the group owner to delete it.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{group.name}</Text>
          <Text style={styles.headerSubtitle}>{group.mainCurrencyCode}</Text>
        </View>
        <View style={styles.headerActions}>
          {isOwner && (
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGroup}>
              <Trash2 color="#dc2626" size={20} />
            </TouchableOpacity>
          )}
          {(activeTab === 'expenses' || activeTab === 'members') && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
              <Plus color="#ffffff" size={20} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'expenses' && styles.tabActive]}
          onPress={() => setActiveTab('expenses')}>
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.tabTextActive]}>
            Expenses
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
          onPress={() => setActiveTab('balances')}>
          <Text style={[styles.tabText, activeTab === 'balances' && styles.tabTextActive]}>
            Balances
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}>
          <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
            Members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settle' && styles.tabActive]}
          onPress={() => setActiveTab('settle')}>
          <Text style={[styles.tabText, activeTab === 'settle' && styles.tabTextActive]}>
            Settle
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'expenses' && (
          <ExpensesTab expenses={expenses} group={group} reload={loadData} />
        )}
        {activeTab === 'balances' && (
          <BalancesTab balances={balances} members={group.members} currencySymbol={currencySymbol} />
        )}
        {activeTab === 'members' && <MembersTab members={group.members} groupId={group.id} />}
        {activeTab === 'settle' && (
          <SettleTab expenses={expenses} members={group.members} currencySymbol={currencySymbol} />
        )}
      </ScrollView>
    </View>
  );
}

function ExpensesTab({
  expenses,
  group,
}: {
  expenses: Expense[];
  group: GroupWithMembers;
  reload: () => void;
}) {
  const memberMap = new Map(group.members.map((m) => [m.id, m]));

  if (expenses.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No expenses yet</Text>
        <Text style={styles.emptySubtext}>Add your first expense to get started</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {expenses.map((expense) => {
        const payer = memberMap.get(expense.payerMemberId);
        return (
          <View key={expense.id} style={styles.expenseCard}>
            <View style={styles.expenseHeader}>
              <Text style={styles.expenseDescription}>{expense.description || 'Expense'}</Text>
              <Text style={styles.expenseAmount}>
                {expense.currencyCode} {formatNumber(expense.totalAmountScaled)}
              </Text>
            </View>
            <Text style={styles.expenseDetails}>Paid by {payer?.name || 'Unknown'}</Text>
            <Text style={styles.expenseDate}>
              {new Date(expense.dateTime).toLocaleDateString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function BalancesTab({
  balances,
  members,
  currencySymbol,
}: {
  balances: Map<string, bigint>;
  members: GroupMember[];
  currencySymbol: string;
}) {
  return (
    <View style={styles.tabContent}>
      {members.map((member) => {
        const balance = balances.get(member.id) || BigInt(0);
        const isPositive = balance > BigInt(0);
        const isZero = balance === BigInt(0);

        return (
          <View key={member.id} style={styles.balanceCard}>
            <Text style={styles.balanceName}>{member.name}</Text>
            <Text
              style={[
                styles.balanceAmount,
                isPositive && styles.balancePositive,
                !isPositive && !isZero && styles.balanceNegative,
              ]}>
              {isPositive ? '+' : balance < BigInt(0) ? '-' : ''}
              {currencySymbol}
              {formatNumber(balance < BigInt(0) ? -balance : balance)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function MembersTab({ members, groupId }: { members: GroupMember[]; groupId: string }) {
  const router = useRouter();

  return (
    <View style={styles.tabContent}>
      {members.map((member) => (
        <TouchableOpacity
          key={member.id}
          style={styles.memberCard}
          onPress={() => router.push(`/group/${groupId}/edit-member?memberId=${member.id}` as any)}>
          <View style={styles.memberIcon}>
            <User color={member.connectedUserId ? '#2563eb' : '#6b7280'} size={20} />
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            {member.email && (
              <View style={styles.memberEmailRow}>
                <Mail color="#9ca3af" size={12} />
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>
            )}
          </View>
          {member.connectedUserId && (
            <View style={styles.connectedBadge}>
              <Link color="#059669" size={14} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}

      {members.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No members yet</Text>
          <Text style={styles.emptySubtext}>Add members to start splitting expenses</Text>
        </View>
      )}
    </View>
  );
}

function SettleTab({
  expenses,
  currencySymbol,
}: {
  expenses: Expense[];
  members: GroupMember[];
  currencySymbol: string;
}) {
  const router = useRouter();

  return (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.settleButton}
        onPress={() => {
          router.push(`/group/${expenses[0]?.groupId}/settle` as any);
        }}>
        <Text style={styles.settleButtonText}>Compute Settlements</Text>
      </TouchableOpacity>

      <Text style={styles.settleInfo}>
        Tap above to see who should pay whom and how much. You'll have the option to simplify debts
        to reduce the number of transfers.
      </Text>
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
    alignItems: 'center',
    padding: 16,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
  },
  addButton: {
    backgroundColor: '#2563eb',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
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
  expenseCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  expenseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  expenseDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  expenseDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  balanceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  balanceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  balanceAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  balancePositive: {
    color: '#059669',
  },
  balanceNegative: {
    color: '#dc2626',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  memberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  memberEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  memberEmail: {
    fontSize: 13,
    color: '#9ca3af',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#059669',
  },
  settleButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  settleButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  settleInfo: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
  },
});
