import { User, Session } from '@supabase/supabase-js';

export interface MockSupabaseQueryBuilder {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  is: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
  order: jest.Mock;
}

export interface MockSupabaseClient {
  auth: {
    getUser: jest.Mock;
    getSession: jest.Mock;
    signInWithPassword: jest.Mock;
    updateUser: jest.Mock;
    signUp: jest.Mock;
    signOut: jest.Mock;
    onAuthStateChange: jest.Mock;
  };
  from: jest.Mock<MockSupabaseQueryBuilder>;
  functions: {
    invoke: jest.Mock;
  };
}

export function createMockSupabaseClient(): MockSupabaseClient {
  const createQueryBuilder = (): MockSupabaseQueryBuilder => {
    const builder: MockSupabaseQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      order: jest.fn().mockReturnThis(),
    };
    return builder as any;
  };

  return {
    auth: {
      getUser: jest
        .fn()
        .mockResolvedValue({ data: { user: null }, error: null }),
      getSession: jest
        .fn()
        .mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
      updateUser: jest
        .fn()
        .mockResolvedValue({ data: { user: null }, error: null }),
      signUp: jest.fn().mockResolvedValue({
        data: { user: null, session: null },
        error: null,
      }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    from: jest.fn(createQueryBuilder),
    functions: {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null }),
    },
  };
}

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

export function createMockSession(userOverrides: Partial<User> = {}): Session {
  const user = createMockUser(userOverrides);
  return {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as Session;
}

export function resetAllMocks(mockClient: MockSupabaseClient): void {
  mockClient.auth.getUser.mockClear();
  mockClient.auth.getSession.mockClear();
  mockClient.auth.signInWithPassword.mockClear();
  mockClient.auth.updateUser.mockClear();
  mockClient.auth.signUp.mockClear();
  mockClient.auth.signOut.mockClear();
  mockClient.auth.onAuthStateChange.mockClear();
  mockClient.from.mockClear();
  mockClient.functions.invoke.mockClear();
}
