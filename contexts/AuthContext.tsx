import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/services/groupRepository';
import { syncUserPreferences } from '@/services/userPreferenceSync';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  requiresRecoveryPasswordChange: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  completeRecoveryPasswordChange: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [
    requiresRecoveryPasswordChangeState,
    setRequiresRecoveryPasswordChange,
  ] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await ensureUserProfile();
        await syncUserPreferences(session.user.id);
      }
      setSession(session);
      setUser(session?.user ?? null);
      // Don't set requiresRecoveryPasswordChange on initial load
      // It's only set during the signIn flow
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_IN' && session?.user) {
          await ensureUserProfile();
          await syncUserPreferences(session.user.id);
        }
        setSession(session);
        setUser(session?.user ?? null);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    // First, try normal sign-in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // If normal sign-in succeeds, proceed with normal flow
    if (!signInError) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user?.id) {
        setRequiresRecoveryPasswordChange(false);
        const now = new Date().toISOString();
        await supabase
          .from('users')
          .update({ last_login: now })
          .eq('id', userData.user.id);
        await syncUserPreferences(userData.user.id);
      }
      return;
    }

    // If normal sign-in failed, check if it's a recovery password
    const { data: verifyData, error: verifyError } =
      await supabase.functions.invoke<{
        isRecoveryPassword: boolean;
        expired?: boolean;
        temporaryPassword?: string;
      }>('verify-recovery-password', {
        body: { email, password },
      });

    if (verifyError) {
      console.error(
        'Recovery verification and temporary password assignment failed:',
        verifyError,
      );
      throw new Error(
        'Unable to complete recovery sign-in. Please request a new recovery password.',
      );
    }

    if (verifyData?.expired) {
      throw new Error('Recovery password expired. Request a new one.');
    }

    if (!verifyData?.isRecoveryPassword) {
      // Not a recovery password, throw the original sign-in error
      throw signInError;
    }

    if (!verifyData.temporaryPassword) {
      console.error(
        'Recovery verification succeeded without a temporary password',
      );
      throw new Error(
        'Unable to complete recovery sign-in. Please request a new recovery password.',
      );
    }

    // The recovery edge function already verified the recovery password and
    // atomically set a temporary password server-side.
    const { error: tempSignInError } = await supabase.auth.signInWithPassword({
      email,
      password: verifyData.temporaryPassword,
    });

    if (tempSignInError) {
      console.error('Failed to sign in with temporary password');
      throw new Error(
        'Unable to complete recovery sign-in. Please request a new recovery password.',
      );
    }

    // Mark that password change is required
    setRequiresRecoveryPasswordChange(true);

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) {
      const now = new Date().toISOString();
      await supabase
        .from('users')
        .update({ last_login: now })
        .eq('id', userData.user.id);
      await syncUserPreferences(userData.user.id);
    }
  };

  const completeRecoveryPasswordChange = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw error;
    }

    setRequiresRecoveryPasswordChange(false);

    const { data: refreshedUserData, error: refreshedUserError } =
      await supabase.auth.getUser();
    if (refreshedUserError) {
      console.warn(
        'Password changed but failed to refresh auth user metadata',
        refreshedUserError,
      );
      return;
    }

    if (refreshedUserData.user) {
      setUser(refreshedUserData.user);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setRequiresRecoveryPasswordChange(false);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        requiresRecoveryPasswordChange: requiresRecoveryPasswordChangeState,
        signIn,
        signUp,
        completeRecoveryPasswordChange,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
