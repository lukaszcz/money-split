import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearCachedUserPreference,
  getCachedUserPreference,
  setCachedUserPreference,
} from '@/services/userPreferenceCache';

describe('userPreferenceCache', () => {
  const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue();
    storage.removeItem.mockResolvedValue();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('returns null when nothing is cached', async () => {
    const result = await getCachedUserPreference('user-1', 'currency_order');

    expect(result).toBeNull();
    expect(storage.getItem).toHaveBeenCalledWith(
      'user_pref_v1:user-1:currency_order',
    );
  });

  it('returns parsed cached values', async () => {
    storage.getItem.mockResolvedValueOnce('["USD","EUR"]');

    const result = await getCachedUserPreference<string[]>(
      'user-1',
      'currency_order',
    );

    expect(result).toEqual(['USD', 'EUR']);
  });

  it('stores cached values', async () => {
    await setCachedUserPreference('user-2', 'group_order', ['g1', 'g2']);

    expect(storage.setItem).toHaveBeenCalledWith(
      'user_pref_v1:user-2:group_order',
      '["g1","g2"]',
    );
  });

  it('clears cached values', async () => {
    await clearCachedUserPreference('user-3', 'simplify_debts');

    expect(storage.removeItem).toHaveBeenCalledWith(
      'user_pref_v1:user-3:simplify_debts',
    );
  });

  it('logs and returns null when cache read fails', async () => {
    storage.getItem.mockRejectedValueOnce(new Error('boom'));

    const result = await getCachedUserPreference('user-4', 'group_order');

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('logs when cache write fails', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('boom'));

    await setCachedUserPreference('user-5', 'currency_order', ['PLN']);

    expect(console.error).toHaveBeenCalled();
  });

  it('logs when cache clear fails', async () => {
    storage.removeItem.mockRejectedValueOnce(new Error('boom'));

    await clearCachedUserPreference('user-6', 'simplify_debts');

    expect(console.error).toHaveBeenCalled();
  });
});
