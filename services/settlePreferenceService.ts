import { supabase } from '@/lib/supabase';
import {
  getCachedUserPreference,
  setCachedUserPreference,
} from './userPreferenceCache';

const SETTLE_SIMPLIFY_CACHE = 'simplify_debts';

export async function getSettleSimplifyPreference(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return true;
  }

  const cached = await getCachedUserPreference<boolean>(
    user.id,
    SETTLE_SIMPLIFY_CACHE,
  );

  if (cached !== null) {
    void refreshSettlePreferenceForUser(user.id);
    return cached;
  }

  const { data, error } = await supabase
    .from('user_settle_preferences')
    .select('simplify_debts')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching settle preferences:', error);
    return true;
  }

  const resolved = data?.simplify_debts ?? true;
  await setCachedUserPreference(user.id, SETTLE_SIMPLIFY_CACHE, resolved);

  if (!data) {
    await saveSettleSimplifyPreference(user.id, resolved);
  }

  return resolved;
}

export async function setSettleSimplifyPreference(
  value: boolean,
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  await saveSettleSimplifyPreference(user.id, value);
  await setCachedUserPreference(user.id, SETTLE_SIMPLIFY_CACHE, value);
}

async function saveSettleSimplifyPreference(
  userId: string,
  value: boolean,
): Promise<void> {
  const { error } = await supabase.from('user_settle_preferences').upsert(
    {
      user_id: userId,
      simplify_debts: value,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'user_id',
    },
  );

  if (error) {
    console.error('Error updating settle preferences:', error);
  }
}

export async function refreshSettlePreferenceForUser(
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('user_settle_preferences')
    .select('simplify_debts')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching settle preferences:', error);
    return;
  }

  const resolved = data?.simplify_debts ?? true;
  await setCachedUserPreference(userId, SETTLE_SIMPLIFY_CACHE, resolved);
}
