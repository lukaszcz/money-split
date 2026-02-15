import { View, Text, Alert } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getGroup,
  createExpense,
  GroupWithMembers,
} from '../../../services/groupRepository';
import { useAuth } from '../../../contexts/AuthContext';
import {
  toScaled,
  applyExchangeRate,
  calculateSharesForSplit,
  type SplitMethod,
} from '../../../utils/money';
import { getExchangeRate } from '../../../services/exchangeRateService';
import ExpenseFormScreen from '../../../components/ExpenseFormScreen';

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [payerId, setPayerId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    [],
  );
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal');

  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  const loadGroup = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    const fetchedGroup = await getGroup(id);
    if (fetchedGroup) {
      setGroup(fetchedGroup);
      setCurrency(fetchedGroup.mainCurrencyCode);

      if (fetchedGroup.members.length > 0) {
        const currentUserMember = fetchedGroup.members.find(
          (member) => member.connectedUserId === user?.id,
        );
        setPayerId(currentUserMember?.id ?? fetchedGroup.members[0].id);
        const allIds = fetchedGroup.members.map((m) => m.id);
        setSelectedParticipants(allIds);
      }
    }
  }, [id, user?.id]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const handleSaveExpense = async () => {
    if (!group) return;

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

  const handleSaveTransfer = async () => {
    if (saving) {
      return;
    }

    if (!group) return;

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
    let shouldResetSaving = true;

    try {
      const rate = await getExchangeRate(currency, group.mainCurrencyCode);

      if (!rate) {
        Alert.alert(
          'Error',
          'Could not fetch exchange rate. Please try again.',
        );
        setSaving(false);
        return;
      }

      const totalScaled = toScaled(parseFloat(amount));
      const totalInMainScaled = applyExchangeRate(totalScaled, rate.rateScaled);

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

      const expense = await createExpense(
        group.id,
        transferDescription,
        new Date().toISOString(),
        currency,
        totalScaled,
        payerId,
        rate.rateScaled,
        totalInMainScaled,
        shareData,
        'transfer',
        'equal',
      );

      if (expense) {
        shouldResetSaving = false;
        router.back();
      } else {
        Alert.alert('Error', 'Failed to create transfer');
      }
    } catch (error) {
      console.error('Failed to save transfer', error);
      Alert.alert('Error', 'An error occurred while saving');
    } finally {
      if (shouldResetSaving) {
        setSaving(false);
      }
    }
  };

  const saveExpense = async (shares: bigint[]) => {
    if (saving) {
      return;
    }

    if (!group) return;

    setSaving(true);
    let shouldResetSaving = true;

    try {
      const rate = await getExchangeRate(currency, group.mainCurrencyCode);

      if (!rate) {
        Alert.alert(
          'Error',
          'Could not fetch exchange rate. Please try again.',
        );
        setSaving(false);
        return;
      }

      const totalScaled = toScaled(parseFloat(amount));
      const totalInMainScaled = applyExchangeRate(totalScaled, rate.rateScaled);

      const shareData = selectedParticipants.map((memberId, idx) => ({
        memberId,
        shareAmountScaled: shares[idx],
        shareInMainScaled: applyExchangeRate(shares[idx], rate.rateScaled),
      }));

      const expense = await createExpense(
        group.id,
        description.trim() || undefined,
        new Date().toISOString(),
        currency,
        totalScaled,
        payerId,
        rate.rateScaled,
        totalInMainScaled,
        shareData,
        'expense',
        splitMethod,
      );

      if (expense) {
        shouldResetSaving = false;
        router.back();
      } else {
        Alert.alert('Error', 'Failed to create expense');
      }
    } catch (error) {
      console.error('Failed to save expense', error);
      Alert.alert('Error', 'An error occurred while saving');
    } finally {
      if (shouldResetSaving) {
        setSaving(false);
      }
    }
  };

  if (!group) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f9fafb', padding: 16 }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ExpenseFormScreen
      mode="add"
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
      selectedParticipants={selectedParticipants}
      setSelectedParticipants={setSelectedParticipants}
      splitMethod={splitMethod}
      setSplitMethod={setSplitMethod}
      percentages={percentages}
      setPercentages={setPercentages}
      exactAmounts={exactAmounts}
      setExactAmounts={setExactAmounts}
      saving={saving}
      onClose={() => router.back()}
      onSaveExpense={handleSaveExpense}
      onSaveTransfer={handleSaveTransfer}
    />
  );
}
