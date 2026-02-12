describe('lib/supabase client configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const loadModule = (platform: 'ios' | 'web') => {
    const createClient = jest.fn().mockReturnValue({ mockClient: true });
    const secureStore = {
      getItemAsync: jest.fn().mockResolvedValue(null),
      setItemAsync: jest.fn().mockResolvedValue(undefined),
      deleteItemAsync: jest.fn().mockResolvedValue(undefined),
    };

    jest.doMock('react-native-url-polyfill/auto', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({ createClient }));
    jest.doMock('react-native', () => ({
      Platform: {
        OS: platform,
      },
    }));
    jest.doMock('expo-secure-store', () => secureStore);

    require('../../lib/supabase');

    return {
      createClient,
      secureStore,
    };
  };

  it('uses SecureStore auth persistence on native', async () => {
    const { createClient, secureStore } = loadModule('ios');
    const options = createClient.mock.calls[0]?.[2] as {
      auth: {
        autoRefreshToken: boolean;
        persistSession: boolean;
        detectSessionInUrl: boolean;
        storage: {
          getItem: (key: string) => Promise<string | null>;
          setItem: (key: string, value: string) => Promise<void>;
          removeItem: (key: string) => Promise<void>;
        };
      };
    };

    expect(options.auth.autoRefreshToken).toBe(true);
    expect(options.auth.persistSession).toBe(true);
    expect(options.auth.detectSessionInUrl).toBe(false);

    await options.auth.storage.setItem('token-key', 'token-value');
    await options.auth.storage.getItem('token-key');
    await options.auth.storage.removeItem('token-key');

    expect(secureStore.setItemAsync).toHaveBeenCalledWith(
      'token-key',
      'token-value',
      { keychainService: 'money-split-auth' },
    );
    expect(secureStore.getItemAsync).toHaveBeenCalledWith('token-key', {
      keychainService: 'money-split-auth',
    });
    expect(secureStore.deleteItemAsync).toHaveBeenCalledWith('token-key', {
      keychainService: 'money-split-auth',
    });
  });

  it('keeps URL session detection and omits storage override on web', () => {
    const { createClient } = loadModule('web');
    const options = createClient.mock.calls[0]?.[2] as {
      auth: { detectSessionInUrl: boolean; storage?: unknown };
    };

    expect(options.auth.detectSessionInUrl).toBe(true);
    expect(options.auth).not.toHaveProperty('storage');
  });
});
