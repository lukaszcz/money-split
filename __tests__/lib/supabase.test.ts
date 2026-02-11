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
    const asyncStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    jest.doMock('react-native-url-polyfill/auto', () => ({}));
    jest.doMock('@supabase/supabase-js', () => ({ createClient }));
    jest.doMock('react-native', () => ({
      Platform: {
        OS: platform,
      },
    }));
    jest.doMock(
      '@react-native-async-storage/async-storage',
      () => asyncStorage,
    );

    require('../../lib/supabase');

    return {
      createClient,
      asyncStorage,
    };
  };

  it('uses AsyncStorage auth persistence on native', () => {
    const { createClient, asyncStorage } = loadModule('ios');

    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          storage: asyncStorage,
        }),
      }),
    );
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
