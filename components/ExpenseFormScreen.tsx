import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, Trash2 } from 'lucide-react-native';
import type { GroupWithMembers } from '../services/groupRepository';
import {
  validateDecimalInput,
  validateExactAmountInput,
  validatePercentageInput,
} from '../utils/validation';
import type { SplitMethod } from '../utils/money';
import { useCurrencyOrder } from '../hooks/useCurrencyOrder';

type PaymentType = 'expense' | 'transfer';

type BaseProps = {
  group: GroupWithMembers;
  description: string;
  setDescription: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  currency: string;
  setCurrency: (value: string) => void;
  payerId: string;
  setPayerId: (value: string) => void;
  saving: boolean;
  onClose: () => void;
};

type ExpenseProps = {
  selectedParticipants: string[];
  setSelectedParticipants: (value: string[]) => void;
  splitMethod: SplitMethod;
  setSplitMethod: (value: SplitMethod) => void;
  percentages: Record<string, string>;
  setPercentages: (value: Record<string, string>) => void;
  exactAmounts: Record<string, string>;
  setExactAmounts: (value: Record<string, string>) => void;
};

type TransferProps = {
  recipientId: string;
  setRecipientId: (value: string) => void;
};

type AddProps = BaseProps &
  ExpenseProps &
  TransferProps & {
    mode: 'add';
    onSaveExpense: () => void;
    onSaveTransfer: () => void;
  };

type EditExpenseProps = BaseProps &
  ExpenseProps & {
    mode: 'edit-expense';
    onSaveExpense: () => void;
    onDelete: () => void;
  };

type EditTransferProps = BaseProps &
  TransferProps & {
    mode: 'edit-transfer';
    onSaveTransfer: () => void;
    onDelete: () => void;
  };

type ExpenseFormScreenProps = AddProps | EditExpenseProps | EditTransferProps;

export default function ExpenseFormScreen(props: ExpenseFormScreenProps) {
  const [paymentType, setPaymentType] = useState<PaymentType>('expense');
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const { currencies: orderedCurrencies, selectCurrency } = useCurrencyOrder(
    props.group.mainCurrencyCode,
  );

  const isAdd = props.mode === 'add';
  const isEditExpense = props.mode === 'edit-expense';
  const isEditTransfer = props.mode === 'edit-transfer';
  const isExpenseForm = isEditExpense || (isAdd && paymentType === 'expense');
  const isTransferForm = isEditTransfer || (isAdd && paymentType === 'transfer');

  const title = isAdd
    ? 'Add Payment'
    : isEditExpense
      ? 'Edit Expense'
      : 'Edit Transfer';
  const saveLabel = isAdd
    ? paymentType === 'expense'
      ? 'Save Expense'
      : 'Save Transfer'
    : isEditExpense
      ? 'Update Expense'
      : 'Save Transfer';

  const expenseProps =
    isExpenseForm && 'selectedParticipants' in props ? props : null;
  const transferProps = isTransferForm && 'recipientId' in props ? props : null;
  const participants = expenseProps
    ? props.group.members.filter((member) =>
        expenseProps.selectedParticipants.includes(member.id),
      )
    : [];

  const toggleParticipant = (memberId: string) => {
    if (!expenseProps) return;

    if (expenseProps.selectedParticipants.includes(memberId)) {
      expenseProps.setSelectedParticipants(
        expenseProps.selectedParticipants.filter((id) => id !== memberId),
      );
    } else {
      expenseProps.setSelectedParticipants([
        ...expenseProps.selectedParticipants,
        memberId,
      ]);
    }
  };

  const handleSave = () => {
    if (isExpenseForm && 'onSaveExpense' in props) {
      props.onSaveExpense();
      return;
    }
    if (isTransferForm && 'onSaveTransfer' in props) {
      props.onSaveTransfer();
    }
  };

  const renderCurrencyPicker = () => (
    <View style={styles.section}>
      <Text style={styles.label}>Currency *</Text>
      <TouchableOpacity
        style={styles.currencyButton}
        onPress={() => setShowCurrencyPicker(!showCurrencyPicker)}
      >
        <Text style={styles.currencyButtonText}>{props.currency}</Text>
      </TouchableOpacity>

      {showCurrencyPicker && (
        <ScrollView style={styles.currencyList} nestedScrollEnabled>
          {orderedCurrencies.map((curr) => (
            <TouchableOpacity
              key={curr.code}
              style={styles.currencyItem}
              onPress={() => {
                props.setCurrency(curr.code);
                selectCurrency(curr.code);
                setShowCurrencyPicker(false);
              }}
            >
              <Text style={styles.currencyCode}>{curr.code}</Text>
              <Text style={styles.currencyName}>{curr.name}</Text>
              {props.currency === curr.code && (
                <Check color="#2563eb" size={20} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  const renderExpenseForm = () => {
    if (!expenseProps) return null;

    return (
      <>
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={props.description}
            onChangeText={props.setDescription}
            placeholder="What was this for?"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={styles.input}
            value={props.amount}
            onChangeText={(text) => props.setAmount(validateDecimalInput(text))}
            placeholder="0.00"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
        </View>

        {renderCurrencyPicker()}

        <View style={styles.section}>
          <Text style={styles.label}>Paid by *</Text>
          {props.group.members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.optionItem,
                props.payerId === member.id && styles.optionItemSelected,
              ]}
              onPress={() => props.setPayerId(member.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  props.payerId === member.id && styles.optionTextSelected,
                ]}
              >
                {member.name}
              </Text>
              {props.payerId === member.id && (
                <Check color="#2563eb" size={20} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>For whom *</Text>
          {props.group.members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.optionItem,
                expenseProps.selectedParticipants.includes(member.id) &&
                  styles.optionItemSelected,
              ]}
              onPress={() => toggleParticipant(member.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  expenseProps.selectedParticipants.includes(member.id) &&
                    styles.optionTextSelected,
                ]}
              >
                {member.name}
              </Text>
              {expenseProps.selectedParticipants.includes(member.id) && (
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
                expenseProps.splitMethod === 'equal' &&
                  styles.methodButtonActive,
              ]}
              onPress={() => expenseProps.setSplitMethod('equal')}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  expenseProps.splitMethod === 'equal' &&
                    styles.methodButtonTextActive,
                ]}
              >
                Equal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodButton,
                expenseProps.splitMethod === 'percentage' &&
                  styles.methodButtonActive,
              ]}
              onPress={() => expenseProps.setSplitMethod('percentage')}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  expenseProps.splitMethod === 'percentage' &&
                    styles.methodButtonTextActive,
                ]}
              >
                Percentage
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodButton,
                expenseProps.splitMethod === 'exact' && styles.methodButtonActive,
              ]}
              onPress={() => expenseProps.setSplitMethod('exact')}
            >
              <Text
                style={[
                  styles.methodButtonText,
                  expenseProps.splitMethod === 'exact' &&
                    styles.methodButtonTextActive,
                ]}
              >
                Exact
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {expenseProps.splitMethod === 'percentage' && (
          <View style={styles.section}>
            <View style={styles.labelWithRemaining}>
              <Text style={styles.label}>Percentages</Text>
              <Text style={styles.remainingText}>
                Remaining:{' '}
                {(() => {
                  const total = participants.reduce((sum, member) => {
                    const value = parseFloat(
                      expenseProps.percentages[member.id] || '0',
                    );
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
                  value={expenseProps.percentages[member.id] || ''}
                  onChangeText={(text) => {
                    const finalValue = validatePercentageInput(
                      text,
                      member.id,
                      participants.map((m) => m.id),
                      expenseProps.percentages,
                    );
                    if (finalValue === null) return;
                    expenseProps.setPercentages({
                      ...expenseProps.percentages,
                      [member.id]: finalValue,
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

        {expenseProps.splitMethod === 'exact' && (
          <View style={styles.section}>
            <View style={styles.labelWithRemaining}>
              <Text style={styles.label}>Exact Amounts</Text>
              <Text style={styles.remainingText}>
                Remaining:{' '}
                {(() => {
                  const totalAmount = parseFloat(props.amount) || 0;
                  const allocated = participants.reduce((sum, member) => {
                    const value = parseFloat(
                      expenseProps.exactAmounts[member.id] || '0',
                    );
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
                  value={expenseProps.exactAmounts[member.id] || ''}
                  onChangeText={(text) => {
                    const nextValue = validateExactAmountInput(
                      text,
                      member.id,
                      participants.map((m) => m.id),
                      expenseProps.exactAmounts,
                      parseFloat(props.amount) || 0,
                    );
                    if (nextValue === null) return;
                    expenseProps.setExactAmounts({
                      ...expenseProps.exactAmounts,
                      [member.id]: nextValue,
                    });
                  }}
                  placeholder="0.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
        )}
      </>
    );
  };

  const renderTransferForm = () => {
    if (!transferProps) return null;

    return (
      <>
        <View style={styles.section}>
          <Text style={styles.label}>Amount *</Text>
          <TextInput
            style={styles.input}
            value={props.amount}
            onChangeText={(text) => props.setAmount(validateDecimalInput(text))}
            placeholder="0.00"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
        </View>

        {renderCurrencyPicker()}

        <View style={styles.section}>
          <Text style={styles.label}>From *</Text>
          {props.group.members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.optionItem,
                props.payerId === member.id && styles.optionItemSelected,
              ]}
              onPress={() => props.setPayerId(member.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  props.payerId === member.id && styles.optionTextSelected,
                ]}
              >
                {member.name}
              </Text>
              {props.payerId === member.id && (
                <Check color="#2563eb" size={20} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>To *</Text>
          {props.group.members.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[
                styles.optionItem,
                transferProps.recipientId === member.id &&
                  styles.optionItemSelected,
              ]}
              onPress={() => transferProps.setRecipientId(member.id)}
            >
              <Text
                style={[
                  styles.optionText,
                  transferProps.recipientId === member.id &&
                    styles.optionTextSelected,
                ]}
              >
                {member.name}
              </Text>
              {transferProps.recipientId === member.id && (
                <Check color="#2563eb" size={20} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={styles.input}
            value={props.description}
            onChangeText={props.setDescription}
            placeholder="Optional note"
            placeholderTextColor="#9ca3af"
          />
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={props.onClose} style={styles.closeButton}>
          <X color="#111827" size={24} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        {'onDelete' in props ? (
          <TouchableOpacity onPress={props.onDelete} style={styles.deleteButton}>
            <Trash2 color="#dc2626" size={20} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {isAdd && (
        <View style={styles.typeTabsContainer}>
          <TouchableOpacity
            style={[
              styles.typeTab,
              paymentType === 'expense' && styles.typeTabActive,
            ]}
            onPress={() => setPaymentType('expense')}
          >
            <Text
              style={[
                styles.typeTabText,
                paymentType === 'expense' && styles.typeTabTextActive,
              ]}
            >
              Expense
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeTab,
              paymentType === 'transfer' && styles.typeTabActive,
            ]}
            onPress={() => setPaymentType('transfer')}
          >
            <Text
              style={[
                styles.typeTabText,
                paymentType === 'transfer' && styles.typeTabTextActive,
              ]}
            >
              Transfer
            </Text>
          </TouchableOpacity>
        </View>
      )}

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
          {renderExpenseForm()}
          {renderTransferForm()}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, props.saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={props.saving}
          >
            <Text style={styles.saveButtonText}>
              {props.saving ? 'Saving...' : saveLabel}
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
  typeTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    padding: 4,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 6,
  },
  typeTabActive: {
    backgroundColor: '#ffffff',
  },
  typeTabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#6b7280',
  },
  typeTabTextActive: {
    color: '#2563eb',
    fontWeight: '600',
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
