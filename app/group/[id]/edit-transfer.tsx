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
  formatCurrency,
  toScaled,
} from '../../../utils/money';
import { resolveExchangeRateForEdit } from '../../../services/exchangeRateService';
import ExpenseFormScreen from '../../../components/ExpenseFormScreen';

export default function EditTransferScreen() {
  const { id, expenseId } = useLocalSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [expense, setExpense] = useState<Expense | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [payerId, setPayerId] = useState('');
  const [recipientId, setRecipientId] = useState('');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

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

      if (fetchedExpense.shares.length > 0) {
        setRecipientId(fetchedExpense.shares[0].memberId);
      }
    }

    setLoading(false);
  }, [expenseId, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!group || !expense) return;

    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!payerId) {
      Alert.alert('Error', 'Please select who is sending');
      return;
    }

    if (!recipientId) {
      Alert.alert('Error', 'Please select who is receiving');
      return;
    }

    if (payerId === recipientId) {
      Alert.alert('Error', 'Sender and recipient must be different');
      return;
    }

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

      const payer = group.members.find((m) => m.id === payerId);
      const recipient = group.members.find((m) => m.id === recipientId);

      const transferDescription =
        description.trim() ||
        `Transfer from ${payer?.name} to ${recipient?.name}`;

      const shareData = [
        {
          memberId: recipientId,
          shareAmountScaled: totalScaled,
          shareInMainScaled: totalInMainScaled,
        },
      ];

      const updated = await updateExpense(
        expense.id,
        transferDescription,
        expense.dateTime,
        currency,
        totalScaled,
        payerId,
        rateScaled,
        totalInMainScaled,
        shareData,
        'equal',
      );

      if (updated) {
        router.back();
      } else {
        Alert.alert('Error', 'Failed to update transfer');
      }
    } catch (error) {
      console.error('Failed to save transfer', error);
      Alert.alert('Error', 'An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!expense) return;

    Alert.alert(
      'Delete Transfer',
      'Are you sure you want to delete this transfer? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteExpense(expense.id);
            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete transfer');
            }
          },
        },
      ],
    );
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
      mode="edit-transfer"
      group={group}
      description={description}
      setDescription={setDescription}
      amount={amount}
      setAmount={setAmount}
      currency={currency}
      setCurrency={setCurrency}
      payerId={payerId}
      setPayerId={setPayerId}
      recipientId={recipientId}
      setRecipientId={setRecipientId}
      saving={saving}
      onClose={() => router.back()}
      onDelete={handleDelete}
      onSaveTransfer={handleSave}
    />
  );
}
