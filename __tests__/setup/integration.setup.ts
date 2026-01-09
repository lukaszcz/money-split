/**
 * Integration test setup
 *
 * This file provides utilities for running integration tests against a real Supabase instance.
 * Use Docker Compose to spin up a local Supabase environment for testing.
 *
 * Setup:
 * 1. Install Docker and Docker Compose
 * 2. Run: docker-compose -f __tests__/setup/docker-compose.test.yml up -d
 * 3. Wait for services to be healthy
 * 4. Run migrations against test database
 * 5. Run integration tests
 * 6. Cleanup: docker-compose -f __tests__/setup/docker-compose.test.yml down -v
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface IntegrationTestConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
}

export const TEST_CONFIG: IntegrationTestConfig = {
  // Default to Kong/PostgREST API port (54321), not Postgres port (54322)
  supabaseUrl: process.env.TEST_SUPABASE_URL || 'http://localhost:54321',
  supabaseAnonKey:
    process.env.TEST_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  supabaseServiceKey:
    process.env.TEST_SUPABASE_SERVICE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
};

/**
 * Create a Supabase client for integration testing
 */
export function createIntegrationTestClient(
  useServiceKey = false,
): SupabaseClient {
  const key = useServiceKey
    ? TEST_CONFIG.supabaseServiceKey
    : TEST_CONFIG.supabaseAnonKey;
  return createClient(TEST_CONFIG.supabaseUrl, key);
}

/**
 * Clean up test data from the database
 */
export async function cleanupTestData(client: SupabaseClient): Promise<void> {
  // Delete in reverse order of foreign key dependencies
  await client
    .from('expense_shares')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await client
    .from('expenses')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await client
    .from('group_members')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await client
    .from('groups')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await client
    .from('users')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
}

/**
 * Wait for Supabase to be ready
 */
export async function waitForSupabase(
  maxAttempts = 30,
  interval = 1000,
): Promise<boolean> {
  const client = createIntegrationTestClient();

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const { error } = await client.from('users').select('count').limit(1);
      if (!error) {
        return true;
      }
    } catch (err) {
      // Ignore connection errors
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Create a test user for integration tests
 */
export async function createTestUser(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<{ userId: string; email: string }> {
  const { data, error } = await client.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error('User creation failed');

  return {
    userId: data.user.id,
    email: data.user.email!,
  };
}

/**
 * Sign in a test user
 */
export async function signInTestUser(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.session) throw new Error('Sign in failed');

  return data.session.access_token;
}

/**
 * Integration test lifecycle helpers
 */
export class IntegrationTestHelper {
  private client: SupabaseClient;
  private createdUsers: string[] = [];
  private createdGroups: string[] = [];

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Track a user for cleanup
   */
  trackUser(userId: string): void {
    this.createdUsers.push(userId);
  }

  /**
   * Track a group for cleanup
   */
  trackGroup(groupId: string): void {
    this.createdGroups.push(groupId);
  }

  /**
   * Clean up all tracked resources
   */
  async cleanup(): Promise<void> {
    // Delete groups and their related data
    for (const groupId of this.createdGroups) {
      // First, get all expense IDs for this group
      const { data: expenses } = await this.client
        .from('expenses')
        .select('id')
        .eq('group_id', groupId);

      // Delete expense shares for those expenses
      if (expenses && expenses.length > 0) {
        const expenseIds = expenses.map((e) => e.id);
        await this.client
          .from('expense_shares')
          .delete()
          .in('expense_id', expenseIds);
      }

      // Now delete expenses, members, and the group
      await this.client.from('expenses').delete().eq('group_id', groupId);
      await this.client.from('group_members').delete().eq('group_id', groupId);
      await this.client.from('groups').delete().eq('id', groupId);
    }

    // Delete users
    for (const userId of this.createdUsers) {
      await this.client.from('users').delete().eq('id', userId);
    }

    this.createdUsers = [];
    this.createdGroups = [];
  }
}

/**
 * Example integration test pattern
 *
 * describe('Group Integration Tests', () => {
 *   let client: SupabaseClient;
 *   let helper: IntegrationTestHelper;
 *
 *   beforeAll(async () => {
 *     const ready = await waitForSupabase();
 *     if (!ready) {
 *       throw new Error('Supabase not ready for integration tests');
 *     }
 *     client = createIntegrationTestClient(true); // Use service key
 *   });
 *
 *   beforeEach(() => {
 *     helper = new IntegrationTestHelper(client);
 *   });
 *
 *   afterEach(async () => {
 *     await helper.cleanup();
 *   });
 *
 *   it('should create a group with members', async () => {
 *     const user = await createTestUser(client, 'test@example.com', 'password123');
 *     helper.trackUser(user.userId);
 *
 *     // Your test logic here
 *   });
 * });
 */
