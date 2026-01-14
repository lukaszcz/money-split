import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, User, Mail, Link, MoreVertical } from 'lucide-react-native';
import {
  getGroup,
  getGroupExpenses,
  leaveGroup,
  Expense,
  GroupWithMembers,
  GroupMember,
} from '../../services/groupRepository';
import { computeBalances } from '../../services/settlementService';
import { formatNumber, multiplyScaled } from '../../utils/money';
import { getCurrencySymbol } from '../../utils/currencies';
import { getExchangeRate } from '../../services/exchangeRateService';
import { recordGroupVisit } from '../../services/groupPreferenceService';
import { getMenuPosition } from '../../utils/ui';
import BottomActionBar from '../../components/BottomActionBar';

type Tab = 'payments' | 'balances' | 'members' | 'settle';

const MENU_WIDTH = 180;

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const moreButtonRef = useRef<View>(null);
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('payments');
  const [loading, setLoading] = useState(true);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    const fetchedGroup = await getGroup(id);
    const fetchedExpenses = await getGroupExpenses(id);

    setGroup(fetchedGroup);
    setExpenses(fetchedExpenses);
    setLoading(false);

    await recordGroupVisit(id);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  if (loading || !group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#111827" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currencySymbol = getCurrencySymbol(group.mainCurrencyCode);
  const balances = computeBalances(expenses, group.members);
  const showAddButton = activeTab === 'payments' || activeTab === 'members';

  const handleAddPress = () => {
    if (activeTab === 'payments') {
      router.push(`/group/${group.id}/add-expense` as any);
      return;
    }

    router.push(`/group/${group.id}/add-member` as any);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group? If you are the last member, the group will be deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            if (!id || typeof id !== 'string') return;

            const success = await leaveGroup(id);
            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to leave group. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleMorePress = () => {
    moreButtonRef.current?.measureInWindow((x, y, width, height) => {
      setMenuAnchor({ x, y, width, height });
      setMenuVisible(true);
    });
  };

  const handleMenuClose = () => {
    setMenuVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{group.name}</Text>
          <Text style={styles.headerSubtitle}>{group.mainCurrencyCode}</Text>
        </View>
        <View style={styles.headerActions}>
          <View ref={moreButtonRef} collapsable={false}>
            <TouchableOpacity
              style={styles.moreButton}
              accessibilityRole="button"
              accessibilityLabel="Group actions"
              onPress={handleMorePress}
            >
              <MoreVertical color="#6b7280" size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'payments' && styles.tabActive]}
          onPress={() => setActiveTab('payments')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'payments' && styles.tabTextActive,
            ]}
          >
            Payments
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balances' && styles.tabActive]}
          onPress={() => setActiveTab('balances')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'balances' && styles.tabTextActive,
            ]}
          >
            Balances
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'members' && styles.tabActive]}
          onPress={() => setActiveTab('members')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'members' && styles.tabTextActive,
            ]}
          >
            Members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settle' && styles.tabActive]}
          onPress={() => setActiveTab('settle')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'settle' && styles.tabTextActive,
            ]}
          >
            Settle
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === 'payments' && (
          <ExpensesTab expenses={expenses} group={group} reload={loadData} />
        )}
        {activeTab === 'balances' && (
          <BalancesTab
            balances={balances}
            members={group.members}
            currencySymbol={currencySymbol}
          />
        )}
        {activeTab === 'members' && (
          <MembersTab members={group.members} groupId={group.id} />
        )}
        {activeTab === 'settle' && (
          <SettleTab
            expenses={expenses}
            members={group.members}
            currencySymbol={currencySymbol}
            groupId={group.id}
            balances={balances}
          />
        )}
      </ScrollView>

      {showAddButton && (
        <BottomActionBar
          label={activeTab === 'payments' ? 'Add expense' : 'Add member'}
          onPress={handleAddPress}
        />
      )}

      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={handleMenuClose}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleMenuClose}
          />
          {menuAnchor && (
            <View
              style={[
                styles.menu,
                getMenuPosition(menuAnchor, insets.top, MENU_WIDTH),
              ]}
            >
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  handleMenuClose();
                  handleLeaveGroup();
                }}
              >
                <Text style={styles.menuItemDestructive}>Leave group</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
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
  const router = useRouter();
  const memberMap = new Map(group.members.map((m) => [m.id, m]));
  const [convertedAmounts, setConvertedAmounts] = useState<Map<string, bigint>>(
    new Map(),
  );
  const groupCurrencySymbol = getCurrencySymbol(group.mainCurrencyCode);

  useEffect(() => {
    const fetchConversions = async () => {
      const conversions = new Map<string, bigint>();

      for (const expense of expenses) {
        if (expense.currencyCode !== group.mainCurrencyCode) {
          const rate = await getExchangeRate(
            expense.currencyCode,
            group.mainCurrencyCode,
          );
          if (rate) {
            const converted = multiplyScaled(
              expense.totalAmountScaled,
              rate.rateScaled,
            );
            conversions.set(expense.id, converted);
          }
        }
      }

      setConvertedAmounts(conversions);
    };

    if (expenses.length > 0) {
      fetchConversions();
    }
  }, [expenses, group.mainCurrencyCode]);

  if (expenses.length === 0) {
    return (
      <View style={styles.tabContent}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No expenses yet</Text>
          <Text style={styles.emptySubtext}>
            Add your first expense to get started
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      {expenses.map((expense) => {
        const payer = memberMap.get(expense.payerMemberId);
        const convertedAmount = convertedAmounts.get(expense.id);
        const showConversion =
          expense.currencyCode !== group.mainCurrencyCode && convertedAmount;
        const isTransfer = expense.paymentType === 'transfer';
        const editRoute = isTransfer
          ? `/group/${group.id}/edit-transfer?expenseId=${expense.id}`
          : `/group/${group.id}/edit-expense?expenseId=${expense.id}`;

        return (
          <TouchableOpacity
            key={expense.id}
            style={styles.expenseCard}
            onPress={() => router.push(editRoute as any)}
          >
            <View style={styles.expenseHeader}>
              <Text style={styles.expenseDescription}>
                {expense.description || 'Expense'}
              </Text>
              <View style={styles.expenseAmountContainer}>
                <Text style={styles.expenseAmount}>
                  {expense.currencyCode}{' '}
                  {formatNumber(expense.totalAmountScaled)}
                </Text>
                {showConversion && (
                  <Text style={styles.expenseConverted}>
                    ({groupCurrencySymbol}
                    {formatNumber(convertedAmount)})
                  </Text>
                )}
              </View>
            </View>
            <Text style={styles.expenseDetails}>
              Paid by {payer?.name || 'Unknown'}
            </Text>
            <Text style={styles.expenseDate}>
              {new Date(expense.createdAt).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
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
              ]}
            >
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

function MembersTab({
  members,
  groupId,
}: {
  members: GroupMember[];
  groupId: string;
}) {
  const router = useRouter();

  return (
    <View style={styles.tabContent}>
      {members.map((member) => (
        <TouchableOpacity
          key={member.id}
          style={styles.memberCard}
          onPress={() =>
            router.push(
              `/group/${groupId}/edit-member?memberId=${member.id}` as any,
            )
          }
        >
          <View style={styles.memberIcon}>
            <User
              color={member.connectedUserId ? '#2563eb' : '#6b7280'}
              size={20}
            />
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
          <Text style={styles.emptySubtext}>
            Add members to start splitting expenses
          </Text>
        </View>
      )}
    </View>
  );
}

function SettleTab({
  groupId,
  balances,
}: {
  expenses: Expense[];
  members: GroupMember[];
  currencySymbol: string;
  groupId: string;
  balances: Map<string, bigint>;
}) {
  const router = useRouter();

  const hasNonZeroBalances = Array.from(balances.values()).some(
    (balance) => balance !== 0n,
  );

  if (!hasNonZeroBalances) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.settledUpText}>All settled up!</Text>
        <Text style={styles.settledUpSubtext}>No outstanding balances</Text>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <TouchableOpacity
        style={styles.settleButton}
        onPress={() => {
          router.push(`/group/${groupId}/settle` as any);
        }}
      >
        <Text style={styles.settleButtonText}>Compute Settlements</Text>
      </TouchableOpacity>

      <Text style={styles.settleInfo}>
        Tap above to see who should pay whom.
      </Text>

      <Text style={[styles.settleInfo, { marginTop: 12 }]}>
        You{"'"}ll have the option to simplify debts. Simplifying reduces the
        number of transfers, but may change who pays whom.
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
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 6,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuItemDestructive: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
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
  scrollContent: {
    paddingBottom: 24,
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
  settledUpText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  settledUpSubtext: {
    fontSize: 14,
    color: '#6b7280',
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
  expenseAmountContainer: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  expenseConverted: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 2,
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
