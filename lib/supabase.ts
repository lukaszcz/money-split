import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials are not configured. Check your .env file.',
  );
}

const isWeb = Platform.OS === 'web';
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainService: 'money-split-auth',
};

const secureAuthStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key, secureStoreOptions),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, secureStoreOptions),
  removeItem: (key: string) =>
    SecureStore.deleteItemAsync(key, secureStoreOptions),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
    ...(isWeb ? {} : { storage: secureAuthStorage }),
  },
});
