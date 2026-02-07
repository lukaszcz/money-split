import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Keyboard,
} from 'react-native';
import { User } from 'lucide-react-native';
import { getKnownUsers, KnownUser } from '../services/groupRepository';

interface KnownUserSuggestionInputProps {
  nameValue: string;
  onNameChange: (name: string) => void;
  emailValue: string;
  onEmailChange: (email: string) => void;
  onSelectUser: (user: KnownUser) => void;
  hasDuplicateName?: boolean;
  onNameBlur?: (name: string) => void;
  onEmailBlur?: (email: string) => void;
  nameInputRef?: React.RefObject<TextInput>;
  emailInputRef?: React.RefObject<TextInput>;
}

export function KnownUserSuggestionInput({
  nameValue,
  onNameChange,
  emailValue,
  onEmailChange,
  onSelectUser,
  hasDuplicateName = false,
  onNameBlur,
  onEmailBlur,
  nameInputRef,
  emailInputRef,
}: KnownUserSuggestionInputProps) {
  const [knownUsers, setKnownUsers] = useState<KnownUser[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<KnownUser[]>(
    [],
  );
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filterSuggestions = useCallback(
    (text: string) => {
      // If no text, show all known users
      if (!text) {
        setFilteredSuggestions(knownUsers);
        setShowSuggestions(knownUsers.length > 0);
        return;
      }

      const searchText = text.toLowerCase().trim();
      const filtered = knownUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(searchText) ||
          (user.email && user.email.toLowerCase().includes(searchText)),
      );

      setFilteredSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    },
    [knownUsers],
  );

  useEffect(() => {
    loadKnownUsers();
  }, []);

  useEffect(() => {
    if (nameValue) {
      filterSuggestions(nameValue);
    }
  }, [filterSuggestions, nameValue]);

  const loadKnownUsers = async () => {
    const users = await getKnownUsers();
    setKnownUsers(users);
  };

  const handleNameChange = (text: string) => {
    onNameChange(text);
    filterSuggestions(text);
  };

  const handleSelectSuggestion = (user: KnownUser) => {
    onSelectUser(user);
    onNameChange(user.name);
    onEmailChange(user.email || '');
    setShowSuggestions(false);
    setFilteredSuggestions([]);
    Keyboard.dismiss();
  };

  const renderSuggestion = (user: KnownUser) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelectSuggestion(user)}
    >
      <View style={styles.suggestionContent}>
        <User size={18} color="#6b7280" style={styles.suggestionIcon} />
        <View style={styles.suggestionText}>
          <Text style={styles.suggestionName}>{user.name}</Text>
          {user.email && (
            <Text style={styles.suggestionEmail}>{user.email}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>Name</Text>
        <TextInput
          ref={nameInputRef}
          style={[styles.input, hasDuplicateName && styles.inputError]}
          value={nameValue}
          onChangeText={handleNameChange}
          onBlur={() => {
            // Delay hiding suggestions to allow tap to register
            setTimeout(() => setShowSuggestions(false), 200);
            onNameBlur?.(nameValue);
          }}
          onFocus={() => {
            filterSuggestions(nameValue);
          }}
          placeholder="Member name"
          placeholderTextColor="#9ca3af"
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <ScrollView
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
            >
              {filteredSuggestions.map((user) => (
                <React.Fragment key={user.id}>
                  {renderSuggestion(user)}
                </React.Fragment>
              ))}
            </ScrollView>
          </View>
        )}
        <Text style={styles.hint}>
          Suggestions from users you{"'"}ve shared groups with will appear as
          you type
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Email (optional)</Text>
        <TextInput
          ref={emailInputRef}
          style={styles.input}
          value={emailValue}
          onChangeText={onEmailChange}
          onBlur={() => onEmailBlur?.(emailValue)}
          placeholder="member@example.com"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          If provided, the member will be connected to their account when they
          register
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
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
  inputError: {
    borderColor: '#ef4444',
    borderWidth: 2,
  },
  hint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },
  suggestionsContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    marginTop: -8,
    zIndex: 1000,
  },
  suggestionsList: {
    flexGrow: 0,
  },
  suggestionItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionIcon: {
    marginRight: 12,
  },
  suggestionText: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  suggestionEmail: {
    fontSize: 13,
    color: '#6b7280',
  },
});
