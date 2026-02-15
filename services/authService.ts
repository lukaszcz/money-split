import { supabase } from '@/lib/supabase';
import { normalizeEmail } from '@/utils/email';

export async function requestPasswordRecovery(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Invalid email address');
  }

  const { error } = await supabase.functions.invoke('password-recovery', {
    body: { email: normalizedEmail },
  });

  if (error) {
    throw error;
  }
}
