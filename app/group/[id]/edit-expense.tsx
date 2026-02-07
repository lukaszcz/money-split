import { View, Text, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getGroup,
  getExpense,
  updateExpense,
  deleteExpense,
  GroupWithMembers,
  Expense,
} from '../../../services/groupRepository';
import {
  applyExchangeRate,
  calculateSharesForSplit,
  formatCurrency,
  toScaled,
  type SplitMethod,
} from '../../../utils/money';
import { resolveExchangeRateForEdit } from '../../../services/exchangeRateService';
import ExpenseFormScreen from '../../../components/ExpenseFormScreen';

export default function EditExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [payerId, setPayerId] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');

  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    if (
      !id ||
      typeof id !== 'string' ||
      !expenseId ||
      typeof expenseId !== 'string'
    )
      return;

    const fetchedGroup = await getGroup(id);
    const fetchedExpense = await getExpense(expenseId);

    if (fetchedGroup && fetchedExpense) {
      setGroup(fetchedGroup);
      setExpense(fetchedExpense);

      setDescription(fetchedExpense.description || '');
      setAmount(formatCurrency(fetchedExpense.totalAmountScaled));
      setCurrency(fetchedExpense.currencyCode);
      setPayerId(fetchedExpense.payerMemberId);

      const participants = fetchedExpense.shares.map((s) => s.memberId);
      setSelectedParticipants(participants);

      const splitType = fetchedExpense.splitType || 'equal';
      setSplitMethod(splitType);

      if (splitType === 'percentage') {
        const percentageData: Record<string, string> = {};
        const totalAmount = Number(fetchedExpense.totalAmountScaled);

        fetchedExpense.shares.forEach((share) => {
          const shareAmount = Number(share.shareAmountScaled);
          const percentage = (shareAmount / totalAmount) * 100;
          percentageData[share.memberId] = percentage.toFixed(0);
        });

        setPercentages(percentageData);
      } else if (splitType === 'exact') {
        const exactAmts: Record<string, string> = {};
        fetchedExpense.shares.forEach((share) => {
          exactAmts[share.memberId] = formatCurrency(share.shareAmountScaled);
        });
        setExactAmounts(exactAmts);
      }
    }

    setLoading(false);
  }, [expenseId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!expenseId || typeof expenseId !== 'string') return;

            setDeleting(true);
            try {
              const success = await deleteExpense(expenseId);
              if (success) {
                router.back();
              } else {
                Alert.alert('Error', 'Failed to delete expense');
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleSave = async () => {
    if (!group || !expenseId || typeof expenseId !== 'string') return;

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!payerId) {
      Alert.alert('Error', 'Please select a payer');
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert('Error', 'Please select at least one participant');
      return;
    }

    const shareResult = calculateSharesForSplit({
      splitMethod,
      amountScaled: toScaled(parseFloat(amount)),
      participantIds: selectedParticipants,
      percentages,
      exactAmounts,
    });

    if ('error' in shareResult) {
      Alert.alert('Error', shareResult.error);
      return;
    }

    await saveExpense(shareResult.shares);
  };

  const saveExpense = async (shares: bigint[]) => {
    if (!group || !expense || !expenseId || typeof expenseId !== 'string')
      return;

    setSaving(true);

    try {
      const rateScaled = await resolveExchangeRateForEdit(
        expense.currencyCode,
        currency,
        group.mainCurrencyCode,
        expense.exchangeRateToMainScaled,
      );

      if (rateScaled === null) {
        Alert.alert(
          'Error',
          'Could not fetch exchange rate. Please try again.',
        );
        return;
      }

      const totalScaled = toScaled(parseFloat(amount));
      const totalInMainScaled = applyExchangeRate(totalScaled, rateScaled);

      const shareData = selectedParticipants.map((memberId, idx) => ({
        memberId,
        shareAmountScaled: shares[idx],
        shareInMainScaled: applyExchangeRate(shares[idx], rateScaled),
      }));

      const updatedExpense = await updateExpense(
        expenseId,
        description.trim() || undefined,
        new Date().toISOString(),
        currency,
        totalScaled,
        payerId,
        rateScaled,
        totalInMainScaled,
        shareData,
        splitMethod,
      );

      if (updatedExpense) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to update expense');
      }
    } catch (error) {
      console.error('Failed to save expense', error);
      Alert.alert('Error', 'An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !group || !expense) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb', padding: 16 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ExpenseFormScreen
      mode="edit-expense"
      group={group}
      description={description}
      setDescription={setDescription}
      amount={amount}
      setAmount={setAmount}
      currency={currency}
      setCurrency={setCurrency}
      payerId={payerId}
      setPayerId={setPayerId}
      selectedParticipants={selectedParticipants}
      setSelectedParticipants={setSelectedParticipants}
      splitMethod={splitMethod}
      setSplitMethod={setSplitMethod}
      percentages={percentages}
      setPercentages={setPercentages}
      exactAmounts={exactAmounts}
      setExactAmounts={setExactAmounts}
      saving={saving || deleting}
      onClose={() => router.back()}
      onDelete={handleDelete}
      onSaveExpense={handleSave}
    />
  );
}
