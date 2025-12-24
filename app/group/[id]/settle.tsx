import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Alert } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Play } from 'lucide-react-native';
import { getGroup, getGroupExpenses, GroupWithMembers, createExpense } from '../../../services/groupRepository';
import {
  computeSettlementsNoSimplify,
  computeSettlementsSimplified,
  Settlement,
  computeSimplificationSteps,
  SimplificationStep,
} from '../../../services/settlementService';
import { formatNumber, toScaled, applyExchangeRate } from '../../../utils/money';
import { getCurrencySymbol } from '../../../utils/currencies';
import { getExchangeRate } from '../../../services/exchangeRateService';

export default function SettleScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [showDialog, setShowDialog] = useState(true);
  const [simplified, setSimplified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSteps, setAnimationSteps] = useState<SimplificationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const handleAddTransfer = async (settlement: Settlement) => {
    if (!group || !id || typeof id !== 'string') return;

    try {
      const rate = await getExchangeRate(group.mainCurrencyCode, group.mainCurrencyCode);

      if (!rate) {
        Alert.alert('Error', 'Could not process transfer. Please try again.');
        return;
      }

      const totalScaled = settlement.amountScaled;
      const transferDescription = `Settlement: ${settlement.from.name} → ${settlement.to.name}`;

      const shareData = [{
        memberId: settlement.to.id,
        shareAmountScaled: totalScaled,
        shareInMainScaled: totalScaled,
      }];

      const expense = await createExpense(
        group.id,
        transferDescription,
        new Date().toISOString(),
        group.mainCurrencyCode,
        totalScaled,
        settlement.from.id,
        rate.rateScaled,
        totalScaled,
        shareData,
        'transfer'
      );

      if (expense) {
        setSettlements(prev => prev.filter(s =>
          !(s.from.id === settlement.from.id && s.to.id === settlement.to.id)
        ));
        Alert.alert('Success', 'Transfer recorded successfully');
      } else {
        Alert.alert('Error', 'Failed to record transfer');
      }
    } catch (error) {
      Alert.alert('Error', 'An error occurred while recording transfer');
    }
  };

  const startAnimation = async () => {
    if (!group || !id || typeof id !== 'string') return;

    const expenses = await getGroupExpenses(id);
    const steps = computeSimplificationSteps(expenses, group.members);

    console.log(`Generated ${steps.length} animation steps:`);
    steps.forEach((step, idx) => {
      console.log(`  Step ${idx}: ${step.settlements.length} settlements, highlights: [${step.highlightedIndices.join(', ')}]`);
      step.settlements.forEach((s, sidx) => {
        console.log(`    ${sidx}: ${s.from.name} → ${s.to.name}: ${formatNumber(s.amountScaled)}`);
      });
    });

    if (steps.length <= 1) {
      Alert.alert('No Simplification', 'There are no simplification steps to show for these debts.');
      return;
    }

    setAnimationSteps(steps);
    setCurrentStepIndex(0);
    setIsAnimating(true);
  };

  useEffect(() => {
    if (!isAnimating || animationSteps.length === 0) return;

    if (currentStepIndex >= animationSteps.length) {
      setIsAnimating(false);
      if (animationSteps.length > 0) {
        setSettlements(animationSteps[animationSteps.length - 1].settlements);
      }
      return;
    }

    const delay = 3000;

    animationTimerRef.current = setTimeout(() => {
      setCurrentStepIndex(prev => prev + 1);
    }, delay);

    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, [currentStepIndex, isAnimating, animationSteps]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) {
        clearTimeout(animationTimerRef.current);
      }
    };
  }, []);

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
        {settlements.length === 0 && !showDialog && !isAnimating && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>All settled up!</Text>
            <Text style={styles.emptySubtext}>No outstanding balances</Text>
          </View>
        )}

        {isAnimating && animationSteps.length > 0 && currentStepIndex < animationSteps.length && (() => {
          const currentStep = animationSteps[currentStepIndex];
          const hasHighlights = currentStep.highlightedIndices.length > 0;
          const hasResult = currentStep.resultIndex !== undefined;
          const stepNumber = currentStepIndex + 1;
          const totalSteps = animationSteps.length;

          let stepTitle = '';
          let stepDescription = '';

          if (stepNumber === 1 && !hasHighlights && !hasResult) {
            stepTitle = 'Initial transfers';
            stepDescription = `${currentStep.settlements.length} transfer${currentStep.settlements.length !== 1 ? 's' : ''} before simplification`;
          } else if (hasHighlights) {
            stepTitle = 'Next step';
            stepDescription = 'Highlighted transfers will be combined';
          } else if (hasResult) {
            const isLastStep = currentStepIndex === animationSteps.length - 1;
            stepTitle = isLastStep ? 'Final result' : 'Result';
            stepDescription = isLastStep
              ? `Simplified to ${currentStep.settlements.length} transfer${currentStep.settlements.length !== 1 ? 's' : ''}`
              : 'New transfer highlighted in green';
          } else {
            stepTitle = 'Final result';
            stepDescription = `${currentStep.settlements.length} transfer${currentStep.settlements.length !== 1 ? 's' : ''} remaining`;
          }

          return (
            <>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{stepTitle}</Text>
                <Text style={styles.infoSubtext}>
                  {stepDescription} ({stepNumber}/{totalSteps})
                </Text>
              </View>

              {currentStep.settlements.map((settlement, idx) => {
                const isHighlighted = currentStep.highlightedIndices.includes(idx);
                const isResult = currentStep.resultIndex === idx;
                return (
                  <View
                    key={`${currentStepIndex}-${settlement.from.id}-${settlement.to.id}-${idx}`}
                    style={[
                      styles.settlementCard,
                      isHighlighted && styles.settlementCardHighlighted,
                      isResult && styles.settlementCardResult,
                    ]}>
                    <View style={styles.settlementContent}>
                      <View style={styles.settlementInfo}>
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
                    </View>
                  </View>
                );
              })}
            </>
          );
        })()}

        {!isAnimating && settlements.length > 0 && (
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
                <View style={styles.settlementContent}>
                  <View style={styles.settlementInfo}>
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
                  <TouchableOpacity
                    style={styles.transferButton}
                    onPress={() => handleAddTransfer(settlement)}>
                    <Text style={styles.transferButtonText}>Transfer</Text>
                    <ArrowRight color="#2563eb" size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {simplified && (
              <TouchableOpacity
                style={styles.explainButton}
                onPress={startAnimation}>
                <Play color="#059669" size={16} />
                <Text style={styles.explainButtonText}>Explain Debts</Text>
              </TouchableOpacity>
            )}

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
  settlementCardHighlighted: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
    borderWidth: 2,
  },
  settlementCardResult: {
    backgroundColor: '#d1fae5',
    borderColor: '#059669',
    borderWidth: 2,
  },
  settlementContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settlementInfo: {
    flex: 1,
    minWidth: 0,
  },
  settlementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  fromUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 0,
  },
  arrow: {
    fontSize: 16,
    color: '#6b7280',
    marginHorizontal: 8,
    flexShrink: 0,
  },
  toUser: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 0,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  transferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  transferButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  explainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#059669',
    marginTop: 8,
    gap: 8,
  },
  explainButtonText: {
    color: '#059669',
    fontSize: 16,
    fontWeight: '600',
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
