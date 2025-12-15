import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { getGroup, getGroupExpenses, GroupWithMembers } from '../../../services/groupRepository';
import {
  computeSettlementsNoSimplify,
  computeSettlementsSimplified,
  Settlement,
} from '../../../services/settlementService';
import { formatNumber } from '../../../utils/money';
import { getCurrencySymbol } from '../../../utils/currencies';

export default function SettleScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showDialog, setShowDialog] = useState(true);
  const [simplified, setSimplified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id || typeof id !== 'string') return;

    const fetchedGroup = await getGroup(id);
    if (!fetchedGroup) return;

    const expenses = await getGroupExpenses(id);

    setGroup(fetchedGroup);
    setLoading(false);
  };

  const handleSimplifyChoice = async (simplify: boolean) => {
    if (!group || !id || typeof id !== 'string') return;

    const expenses = await getGroupExpenses(id);

    if (simplify) {
      const settlementsSimplified = computeSettlementsSimplified(expenses, group.members);
      setSettlements(settlementsSimplified);
      setSimplified(true);
    } else {
      const settlementsNormal = computeSettlementsNoSimplify(expenses, group.members);
      setSettlements(settlementsNormal);
      setSimplified(false);
    }

    setShowDialog(false);
  };

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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Settle Up</Text>
          <Text style={styles.headerSubtitle}>{group.name}</Text>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {settlements.length === 0 && !showDialog && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>All settled up!</Text>
            <Text style={styles.emptySubtext}>No outstanding balances</Text>
          </View>
        )}

        {settlements.length > 0 && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                {simplified ? 'Simplified settlements' : 'Standard settlements'}
              </Text>
              <Text style={styles.infoSubtext}>
                {settlements.length} transfer{settlements.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {settlements.map((settlement, idx) => (
              <View key={idx} style={styles.settlementCard}>
                <View style={styles.settlementRow}>
                  <Text style={styles.fromUser}>{settlement.from.name}</Text>
                  <Text style={styles.arrow}>→</Text>
                  <Text style={styles.toUser}>{settlement.to.name}</Text>
                </View>
                <Text style={styles.amount}>
                  {currencySymbol}
                  {formatNumber(settlement.amountScaled)}
                </Text>
              </View>
            ))}

            <TouchableOpacity
              style={styles.recalculateButton}
              onPress={() => setShowDialog(true)}>
              <Text style={styles.recalculateButtonText}>Recalculate</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <Modal visible={showDialog} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Simplify debts?</Text>
            <Text style={styles.modalMessage}>
              Simplifying reduces the number of transfers, but may change who pays whom compared
              to individual expenses.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => handleSimplifyChoice(false)}>
                <Text style={styles.modalButtonTextSecondary}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={() => handleSimplifyChoice(true)}>
                <Text style={styles.modalButtonTextPrimary}>Simplify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#3b82f6',
  },
  settlementCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fromUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  arrow: {
    fontSize: 16,
    color: '#6b7280',
    marginHorizontal: 8,
  },
  toUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'right',
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
    textAlign: 'center',
  },
  recalculateButton: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2563eb',
    alignItems: 'center',
    marginTop: 8,
  },
  recalculateButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonPrimary: {
    backgroundColor: '#2563eb',
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
