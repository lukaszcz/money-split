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
import { validateDecimalInput } from '../../../utils/validation';
import {
  toScaled,
  applyExchangeRate,
  formatCurrency,
} from '../../../utils/money';
import { getExchangeRate } from '../../../services/exchangeRateService';
import { useCurrencyOrder } from '../../../hooks/useCurrencyOrder';

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

      const updated = await updateExpense(
        expense.id,
        transferDescription,
        expense.dateTime,
        currency,
        totalScaled,
        payerId,
        rate.rateScaled,
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
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <X color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Transfer</Text>
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
            <Text style={styles.label}>From *</Text>
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
            <Text style={styles.label}>To *</Text>
            {group.members.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.optionItem,
                  recipientId === member.id && styles.optionItemSelected,
                ]}
                onPress={() => setRecipientId(member.id)}
              >
                <Text
                  style={[
                    styles.optionText,
                    recipientId === member.id && styles.optionTextSelected,
                  ]}
                >
                  {member.name}
                </Text>
                {recipientId === member.id && (
                  <Check color="#2563eb" size={20} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional note"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Transfer'}
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
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  deleteButton: {
    padding: 4,
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
