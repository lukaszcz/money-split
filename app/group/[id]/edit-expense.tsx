import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, Check, Trash2 } from 'lucide-react-native';
import {
  getGroup,
  getExpense,
  updateExpense,
  deleteExpense,
  GroupWithMembers,
  Expense,
} from '../../../services/groupRepository';
import {
  toScaled,
  applyExchangeRate,
  calculateSharesForSplit,
  formatCurrency,
  type SplitMethod,
} from '../../../utils/money';
import { getExchangeRate } from '../../../services/exchangeRateService';
import { useCurrencyOrder } from '../../../hooks/useCurrencyOrder';

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

  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const { currencies: orderedCurrencies, selectCurrency } = useCurrencyOrder(
    group?.mainCurrencyCode,
  );

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

  const validateDecimalInput = (
    text: string,
    maxDecimals: number = 2,
  ): string => {
    const sanitized = text.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      return parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2) {
      return parts[0] + '.' + parts[1].substring(0, maxDecimals);
    }
    return sanitized;
  };

  const toggleParticipant = (userId: string) => {
    if (selectedParticipants.includes(userId)) {
      setSelectedParticipants(
        selectedParticipants.filter((id) => id !== userId),
      );
    } else {
      setSelectedParticipants([...selectedParticipants, userId]);
    }
  };

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

            const success = await deleteExpense(expenseId);
            if (success) {
              router.back();
            } else {
              Alert.alert('Error', 'Failed to delete expense');
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
    if (!group || !expenseId || typeof expenseId !== 'string') return;

    setSaving(true);

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

      const updatedExpense = await updateExpense(
        expenseId,
        description.trim() || undefined,
        new Date().toISOString(),
        currency,
        totalScaled,
        payerId,
        rate.rateScaled,
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <X color="#111827" size={24} />
          </TouchableOpacity>
          <Text style={styles.title}>Loading...</Text>
          <View style={styles.placeholder} />
        </View>
      </View>
    );
  }

  const participants = group.members.filter((m) =>
    selectedParticipants.includes(m.id),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <X color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Expense</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
          <Trash2 color="#dc2626" size={20} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="What was this for?"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={(text) => setAmount(validateDecimalInput(text))}
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Currency *</Text>
            <TouchableOpacity
              style={styles.currencyButton}
              onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
            >
              <Text style={styles.currencyButtonText}>{currency}</Text>
            </TouchableOpacity>

            {showCurrencyPicker && (
              <ScrollView style={styles.currencyList} nestedScrollEnabled>
                {orderedCurrencies.map((curr) => (
                  <TouchableOpacity
                    key={curr.code}
                    style={styles.currencyItem}
                    onPress={() => {
                      setCurrency(curr.code);
                      selectCurrency(curr.code);
                      setShowCurrencyPicker(false);
                    }}
                  >
                    <Text style={styles.currencyCode}>{curr.code}</Text>
                    <Text style={styles.currencyName}>{curr.name}</Text>
                    {currency === curr.code && (
                      <Check color="#2563eb" size={20} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Paid by *</Text>
            {group.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.optionItem,
                  payerId === member.id && styles.optionItemSelected,
                ]}
                onPress={() => setPayerId(member.id)}
              >
                <Text
                  style={[
                    styles.optionText,
                    payerId === member.id && styles.optionTextSelected,
                  ]}
                >
                  {member.name}
                </Text>
                {payerId === member.id && <Check color="#2563eb" size={20} />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>For whom *</Text>
            {group.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.optionItem,
                  selectedParticipants.includes(member.id) &&
                    styles.optionItemSelected,
                ]}
                onPress={() => toggleParticipant(member.id)}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedParticipants.includes(member.id) &&
                      styles.optionTextSelected,
                  ]}
                >
                  {member.name}
                </Text>
                {selectedParticipants.includes(member.id) && (
                  <Check color="#2563eb" size={20} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Split Method *</Text>
            <View style={styles.splitMethodRow}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  splitMethod === 'equal' && styles.methodButtonActive,
                ]}
                onPress={() => setSplitMethod('equal')}
              >
                <Text
                  style={[
                    styles.methodButtonText,
                    splitMethod === 'equal' && styles.methodButtonTextActive,
                  ]}
                >
                  Equal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  splitMethod === 'percentage' && styles.methodButtonActive,
                ]}
                onPress={() => setSplitMethod('percentage')}
              >
                <Text
                  style={[
                    styles.methodButtonText,
                    splitMethod === 'percentage' &&
                      styles.methodButtonTextActive,
                  ]}
                >
                  Percentage
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  splitMethod === 'exact' && styles.methodButtonActive,
                ]}
                onPress={() => setSplitMethod('exact')}
              >
                <Text
                  style={[
                    styles.methodButtonText,
                    splitMethod === 'exact' && styles.methodButtonTextActive,
                  ]}
                >
                  Exact
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {splitMethod === 'percentage' && (
            <View style={styles.section}>
              <View style={styles.labelWithRemaining}>
                <Text style={styles.label}>Percentages</Text>
                <Text style={styles.remainingText}>
                  Remaining:{' '}
                  {(() => {
                    const total = participants.reduce((sum, m) => {
                      const value = parseFloat(percentages[m.id] || '0');
                      return sum + (isNaN(value) ? 0 : value);
                    }, 0);
                    return Math.max(0, 100 - total);
                  })()}
                  %
                </Text>
              </View>
              {participants.map((member) => (
                <View key={member.id} style={styles.inputRow}>
                  <Text style={styles.inputRowLabel}>{member.name}</Text>
                  <TextInput
                    style={styles.inputRowField}
                    value={percentages[member.id] || ''}
                    onChangeText={(text) => {
                      const sanitized = text.replace(/[^0-9]/g, '');
                      if (sanitized === '') {
                        setPercentages({ ...percentages, [member.id]: '' });
                        return;
                      }
                      const value = parseInt(sanitized, 10);
                      if (isNaN(value)) return;

                      const currentTotal = participants.reduce((sum, m) => {
                        if (m.id === member.id) return sum;
                        const val = parseFloat(percentages[m.id] || '0');
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0);

                      const remaining = 100 - currentTotal;
                      const finalValue = Math.min(value, remaining);
                      setPercentages({
                        ...percentages,
                        [member.id]: finalValue.toString(),
                      });
                    }}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                  />
                  <Text style={styles.inputRowUnit}>%</Text>
                </View>
              ))}
            </View>
          )}

          {splitMethod === 'exact' && (
            <View style={styles.section}>
              <View style={styles.labelWithRemaining}>
                <Text style={styles.label}>Exact Amounts</Text>
                <Text style={styles.remainingText}>
                  Remaining:{' '}
                  {(() => {
                    const totalAmount = parseFloat(amount) || 0;
                    const allocated = participants.reduce((sum, m) => {
                      const value = parseFloat(exactAmounts[m.id] || '0');
                      return sum + (isNaN(value) ? 0 : value);
                    }, 0);
                    return Math.max(0, totalAmount - allocated).toFixed(2);
                  })()}
                </Text>
              </View>
              {participants.map((member) => (
                <View key={member.id} style={styles.inputRow}>
                  <Text style={styles.inputRowLabel}>{member.name}</Text>
                  <TextInput
                    style={styles.inputRowField}
                    value={exactAmounts[member.id] || ''}
                    onChangeText={(text) => {
                      const sanitized = validateDecimalInput(text);
                      if (sanitized === '' || sanitized === '.') {
                        setExactAmounts({
                          ...exactAmounts,
                          [member.id]: sanitized,
                        });
                        return;
                      }

                      const value = parseFloat(sanitized);
                      if (isNaN(value)) return;

                      const totalAmount = parseFloat(amount) || 0;
                      const currentTotal = participants.reduce((sum, m) => {
                        if (m.id === member.id) return sum;
                        const val = parseFloat(exactAmounts[m.id] || '0');
                        return sum + (isNaN(val) ? 0 : val);
                      }, 0);

                      const remaining = totalAmount - currentTotal;
                      const finalValue = Math.min(
                        value,
                        Math.max(0, remaining),
                      );
                      setExactAmounts({
                        ...exactAmounts,
                        [member.id]: sanitized,
                      });

                      if (value > remaining) {
                        setExactAmounts({
                          ...exactAmounts,
                          [member.id]: finalValue.toFixed(2),
                        });
                      }
                    }}
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Update Expense'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  section: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  currencyButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  currencyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  currencyList: {
    maxHeight: 200,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginTop: 8,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    width: 60,
  },
  currencyName: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginBottom: 8,
  },
  optionItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  optionText: {
    fontSize: 16,
    color: '#111827',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#2563eb',
  },
  splitMethodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  methodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  methodButtonActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  methodButtonTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  inputRowLabel: {
    fontSize: 14,
    color: '#374151',
    width: 100,
  },
  inputRowField: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: '#111827',
  },
  inputRowUnit: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    width: 24,
  },
  labelWithRemaining: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  remainingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  footer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
