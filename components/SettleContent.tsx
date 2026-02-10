import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowRight, CheckSquare, Play, Square } from 'lucide-react-native';
import {
  createExpense,
  Expense,
  getGroup,
  getGroupExpenses,
  GroupWithMembers,
} from '../services/groupRepository';
import {
  computeSettlementsNoSimplify,
  computeSettlementsSimplified,
  computeSimplificationSteps,
  Settlement,
  SimplificationStep,
} from '../services/settlementService';
import { formatNumber } from '../utils/money';
import { getCurrencySymbol } from '../utils/currencies';
import { getExchangeRate } from '../services/exchangeRateService';
import {
  getSettleSimplifyPreference,
  setSettleSimplifyPreference,
} from '../services/settlePreferenceService';

type SettleContentProps = {
  groupId: string;
  embedded?: boolean;
  onTransferRecorded?: () => void;
};

export default function SettleContent({
  groupId,
  embedded = false,
  onTransferRecorded,
}: SettleContentProps) {
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [simplified, setSimplified] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSteps, setAnimationSteps] = useState<SimplificationStep[]>(
    [],
  );
  const [animationNotice, setAnimationNotice] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simplifiedRef = useRef(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const preferenceLoadedRef = useRef(false);
  const [recordingTransfer, setRecordingTransfer] = useState(false);
  const controlsDisabled = recordingTransfer;

  const loadData = useCallback(async () => {
    if (!groupId) return;

    setLoading(true);
    setError(null);
    setAnimationNotice(null);

    try {
      const fetchedGroup = await getGroup(groupId);
      if (!fetchedGroup) {
        setError('Could not load group.');
        setLoading(false);
        return;
      }

      const fetchedExpenses = await getGroupExpenses(groupId);
      let resolvedSimplified = simplifiedRef.current;

      if (!preferenceLoadedRef.current) {
        const storedPreference = await getSettleSimplifyPreference();
        resolvedSimplified = storedPreference;
        simplifiedRef.current = storedPreference;
        setSimplified(storedPreference);
        preferenceLoadedRef.current = true;
      }

      const computedSettlements = resolvedSimplified
        ? computeSettlementsSimplified(fetchedExpenses, fetchedGroup.members)
        : computeSettlementsNoSimplify(fetchedExpenses, fetchedGroup.members);

      setGroup(fetchedGroup);
      setExpenses(fetchedExpenses);
      setSettlements(computedSettlements);
      setLastUpdated(Date.now());
      setLoading(false);
    } catch (loadError) {
      console.error('Failed to load settlements', loadError);
      setError('Could not load settlements.');
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleSimplified = () => {
    if (controlsDisabled) {
      return;
    }

    if (!group || expenses.length === 0) return;

    const newSimplified = !simplified;

    if (newSimplified) {
      const settlementsSimplified = computeSettlementsSimplified(
        expenses,
        group.members,
      );
      setSettlements(settlementsSimplified);
    } else {
      const settlementsNormal = computeSettlementsNoSimplify(
        expenses,
        group.members,
      );
      setSettlements(settlementsNormal);
    }

    simplifiedRef.current = newSimplified;
    setSimplified(newSimplified);
    setLastUpdated(Date.now());
    setAnimationNotice(null);
    setSettleSimplifyPreference(newSimplified);
  };

  const handleAddTransfer = async (settlement: Settlement) => {
    if (controlsDisabled || !group) return;

    setRecordingTransfer(true);

    try {
      const rate = await getExchangeRate(
        group.mainCurrencyCode,
        group.mainCurrencyCode,
      );

      if (!rate) {
        setError('Could not process transfer. Please try again.');
        return;
      }

      const totalScaled = settlement.amountScaled;
      const transferDescription = `Settlement: ${settlement.from.name} → ${settlement.to.name}`;

      const shareData = [
        {
          memberId: settlement.to.id,
          shareAmountScaled: totalScaled,
          shareInMainScaled: totalScaled,
        },
      ];

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
        'transfer',
      );

      if (expense) {
        await loadData();
        onTransferRecorded?.();
      } else {
        setError('Failed to record transfer.');
      }
    } catch (recordError) {
      console.error('Failed to record transfer', recordError);
      setError('An error occurred while recording transfer.');
    } finally {
      setRecordingTransfer(false);
    }
  };

  const startAnimation = () => {
    if (controlsDisabled) {
      return;
    }

    if (!group || expenses.length === 0) return;

    const steps = computeSimplificationSteps(expenses, group.members);

    if (steps.length <= 1) {
      setAnimationNotice('No simplification steps to show.');
      setIsAnimating(false);
      setAnimationSteps([]);
      setCurrentStepIndex(0);
      return;
    }

    setAnimationNotice(null);
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
      setCurrentStepIndex((prev) => prev + 1);
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, embedded && styles.embedded]}>
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCard} />
        <View style={styles.skeletonCardTall} />
      </View>
    );
  }

  if (!group) {
    return (
      <View style={[styles.emptyState, embedded && styles.embedded]}>
        <Text style={styles.emptyText}>Could not load settlements</Text>
        <Text style={styles.emptySubtext}>
          {error || 'The group is unavailable right now.'}
        </Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currencySymbol = getCurrencySymbol(group.mainCurrencyCode);
  const transferCount = settlements.length;
  const showLastUpdated = lastUpdated !== null;
  const lastUpdatedLabel = lastUpdated
    ? `Last updated ${new Date(lastUpdated).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : null;

  return (
    <View style={embedded ? styles.embedded : styles.content}>
      {error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Couldn{"'"}t load settlements</Text>
          <Text style={styles.emptySubtext}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadData}
            disabled={controlsDisabled}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!error && settlements.length === 0 && !isAnimating && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>All settled up!</Text>
          <Text style={styles.emptySubtext}>No outstanding balances</Text>
        </View>
      )}

      {isAnimating &&
        animationSteps.length > 0 &&
        currentStepIndex < animationSteps.length &&
        (() => {
          const currentStep = animationSteps[currentStepIndex];
          const hasHighlights = currentStep.highlightedIndices.length > 0;
          const hasResults = currentStep.resultIndices.length > 0;
          const stepNumber = currentStepIndex + 1;
          const totalSteps = animationSteps.length;

          let stepTitle = '';
          let stepDescription = '';

          if (stepNumber === 1 && !hasHighlights && !hasResults) {
            stepTitle = 'Initial transfers';
            stepDescription = `${currentStep.settlements.length} transfer${
              currentStep.settlements.length !== 1 ? 's' : ''
            } before simplification`;
          } else if (hasHighlights) {
            stepTitle = 'Next step';
            stepDescription = 'Highlighted transfers will be combined';
          } else if (hasResults) {
            const isLastStep = currentStepIndex === animationSteps.length - 1;
            stepTitle = isLastStep ? 'Final result' : 'Result';
            const resultCount = (currentStep.resultIndices || []).length;
            stepDescription = isLastStep
              ? `Simplified to ${currentStep.settlements.length} transfer${
                  currentStep.settlements.length !== 1 ? 's' : ''
                }`
              : `${resultCount} new transfer${
                  resultCount !== 1 ? 's' : ''
                } highlighted in green`;
          } else {
            const isLastStep = currentStepIndex === animationSteps.length - 1;
            stepTitle = isLastStep ? 'Final result' : 'Result';
            stepDescription = isLastStep
              ? `Simplified to ${currentStep.settlements.length} transfer${
                  currentStep.settlements.length !== 1 ? 's' : ''
                }`
              : `${currentStep.settlements.length} transfer${
                  currentStep.settlements.length !== 1 ? 's' : ''
                } remaining`;
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
                const isHighlighted =
                  currentStep.highlightedIndices.includes(idx);
                const isResult = (currentStep.resultIndices || []).includes(
                  idx,
                );
                return (
                  <View
                    key={`${currentStepIndex}-${settlement.from.id}-${
                      settlement.to.id
                    }-${idx}`}
                    style={[
                      styles.settlementCard,
                      isHighlighted && styles.settlementCardHighlighted,
                      isResult && styles.settlementCardResult,
                    ]}
                  >
                    <View style={styles.settlementContent}>
                      <View style={styles.settlementInfo}>
                        <View style={styles.settlementRow}>
                          <Text style={styles.fromUser}>
                            {settlement.from.name}
                          </Text>
                          <Text style={styles.arrow}>→</Text>
                          <Text style={styles.toUser}>
                            {settlement.to.name}
                          </Text>
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

      {!error && !isAnimating && settlements.length > 0 && (
        <>
          {animationNotice && (
            <View style={styles.noticeBox}>
              <Text style={styles.noticeText}>{animationNotice}</Text>
            </View>
          )}
          <View style={styles.infoBox}>
            <View style={styles.infoHeader}>
              <View style={styles.infoTextGroup}>
                <Text style={styles.infoText}>
                  {transferCount} transfer{transferCount !== 1 ? 's' : ''}
                </Text>
                {showLastUpdated && lastUpdatedLabel && (
                  <Text style={styles.lastUpdatedText}>{lastUpdatedLabel}</Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.simplifyToggle}
                onPress={toggleSimplified}
                disabled={controlsDisabled}
              >
                {simplified ? (
                  <CheckSquare color="#2563eb" size={20} />
                ) : (
                  <Square color="#6b7280" size={20} />
                )}
                <Text style={styles.simplifyLabel}>Simplify debts</Text>
              </TouchableOpacity>
            </View>
          </View>

          {settlements.map((settlement) => (
            <View
              key={`${settlement.from.id}-${settlement.to.id}`}
              style={styles.settlementCard}
            >
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
                  onPress={() => handleAddTransfer(settlement)}
                  disabled={controlsDisabled}
                >
                  <Text style={styles.transferButtonText}>Record payment</Text>
                  <ArrowRight color="#2563eb" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))}

          {simplified && (
            <>
              <TouchableOpacity
                style={styles.explainButton}
                onPress={startAnimation}
                disabled={controlsDisabled}
              >
                <Play color="#059669" size={16} />
                <Text style={styles.explainButtonText}>Explain Debts</Text>
              </TouchableOpacity>
              <Text style={styles.simplifyHint}>
                Simplifying reduces the number of transfers, but may change who
                pays whom.
              </Text>
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  embedded: {
    padding: 0,
  },
  loadingContainer: {
    paddingTop: 8,
    paddingHorizontal: 0,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 32,
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
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
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
  lastUpdatedText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  noticeBox: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  noticeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#166534',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoTextGroup: {
    flex: 1,
  },
  simplifyToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  simplifyLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
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
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: '#2563eb',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
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
  simplifyHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  skeletonCard: {
    height: 56,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginBottom: 12,
  },
  skeletonCardTall: {
    height: 96,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
});
