import { supabase } from '@/lib/supabase';

export async function requestPasswordRecovery(email: string): Promise<void> {
  const { error } = await supabase.functions.invoke('password-recovery', {
    body: { email },
  });

  if (error) {
    throw error;
  }
}
