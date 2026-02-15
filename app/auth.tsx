import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { type Href, router } from 'expo-router';
import { isValidEmail } from '@/utils/validation';
import { normalizeEmail } from '@/utils/email';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const { signIn, signUp } = useAuth();
  const controlsDisabled = loading;

  const handleSubmit = async () => {
    if (controlsDisabled) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const trimmedName = name.trim();

    if (!normalizedEmail || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (!isValidEmail(normalizedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!isLogin && !trimmedName) {
      setError('Please enter your name');
      return;
    }

    setError('');
    setInfo('');
    setLoading(true);

    if (isLogin) {
      try {
        await signIn(normalizedEmail, password);
        router.replace('/(tabs)/groups');
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        setLoading(false);
      }

      return;
    }

    try {
      await signUp(normalizedEmail, password, trimmedName);
      setIsLogin(true);
      setName('');
      setPassword('');
      setEmail(normalizedEmail);
      setInfo('Check your email and confirm your address before signing in.');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../assets/images/moneysplit.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>
            {isLogin ? 'Welcome back' : 'Create account'}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
          </Text>

          <View style={styles.form}>
            {!isLogin ? (
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                onBlur={() => setName((currentName) => currentName.trim())}
                autoCapitalize="words"
                autoComplete="name"
                editable={!controlsDisabled}
              />
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              onBlur={() => setEmail((email1) => normalizeEmail(email1) ?? '')}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!controlsDisabled}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!controlsDisabled}
            />

            {isLogin ? (
              <TouchableOpacity
                style={[
                  styles.forgotButton,
                  controlsDisabled && styles.inlineButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Forgot password"
                onPress={() => router.push('/password-recovery' as Href)}
                disabled={controlsDisabled}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {info ? <Text style={styles.infoText}>{info}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={controlsDisabled}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.switchButton,
                controlsDisabled && styles.inlineButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isLogin ? 'Switch to sign up' : 'Switch to sign in'
              }
              onPress={() => {
                setIsLogin(!isLogin);
                setError('');
                setInfo('');
              }}
              disabled={controlsDisabled}
            >
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <Text style={styles.switchTextBold}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 280,
    height: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  inlineButtonDisabled: {
    opacity: 0.5,
  },
  forgotButton: {
    alignItems: 'flex-end',
  },
  forgotText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  switchText: {
    fontSize: 14,
    color: '#666',
  },
  switchTextBold: {
    fontWeight: '600',
    color: '#007AFF',
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 14,
    textAlign: 'center',
  },
  infoText: {
    color: '#2f7d32',
    fontSize: 14,
    textAlign: 'center',
  },
});
