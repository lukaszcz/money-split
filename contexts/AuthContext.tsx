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
  signUp: (email: string, password: string) => Promise<void>;
  completeRecoveryPasswordChange: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const RECOVERY_PASSWORD_EXPIRES_AT_KEY = 'recoveryPasswordExpiresAt';
const RECOVERY_PASSWORD_MUST_CHANGE_KEY = 'recoveryPasswordMustChange';

function generateInvalidatedRecoveryPassword() {
  const randomChunk = () => {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) =>
      value.toString(16).padStart(2, '0'),
    ).join('');
  };
  return `msr-${Date.now().toString(36)}-${randomChunk()}-${randomChunk()}`;
}

function requiresRecoveryPasswordChange(user: User | null): boolean {
  return user?.user_metadata?.[RECOVERY_PASSWORD_MUST_CHANGE_KEY] === true;
}

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
      setRequiresRecoveryPasswordChange(
        requiresRecoveryPasswordChange(session?.user ?? null),
      );
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
        setRequiresRecoveryPasswordChange(
          requiresRecoveryPasswordChange(session?.user ?? null),
        );
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) {
      const recoveryExpiry = userData.user.user_metadata?.[
        RECOVERY_PASSWORD_EXPIRES_AT_KEY
      ] as string | undefined;
      let shouldRequireRecoveryPasswordChange = requiresRecoveryPasswordChange(
        userData.user,
      );

      if (recoveryExpiry) {
        const expiresAtMs = Date.parse(recoveryExpiry);
        if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
          await supabase.auth.signOut();
          throw new Error('Recovery password expired. Request a new one.');
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: generateInvalidatedRecoveryPassword(),
          data: {
            [RECOVERY_PASSWORD_EXPIRES_AT_KEY]: null,
            [RECOVERY_PASSWORD_MUST_CHANGE_KEY]: true,
          },
        });
        if (updateError) {
          console.warn('Failed to invalidate recovery password', updateError);
          await supabase.auth.signOut();
          throw new Error(
            'Unable to finalize recovery sign-in. Request a new recovery password.',
          );
        }
        shouldRequireRecoveryPasswordChange = true;
      }
      setRequiresRecoveryPasswordChange(shouldRequireRecoveryPasswordChange);

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
      data: {
        [RECOVERY_PASSWORD_EXPIRES_AT_KEY]: null,
        [RECOVERY_PASSWORD_MUST_CHANGE_KEY]: null,
      },
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

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
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
