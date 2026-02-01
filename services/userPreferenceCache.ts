import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'user_pref_v1';

const buildKey = (userId: string, name: string) =>
  `${KEY_PREFIX}:${userId}:${name}`;

export async function getCachedUserPreference<T>(
  userId: string,
  name: string,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(userId, name));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('Failed to read cached preference', error);
    return null;
  }
}

export async function setCachedUserPreference<T>(
  userId: string,
  name: string,
  value: T,
): Promise<void> {
  try {
    await AsyncStorage.setItem(buildKey(userId, name), JSON.stringify(value));
  } catch (error) {
    console.error('Failed to write cached preference', error);
  }
}

export async function clearCachedUserPreference(
  userId: string,
  name: string,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(buildKey(userId, name));
  } catch (error) {
    console.error('Failed to clear cached preference', error);
  }
}
