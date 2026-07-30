'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { createClient } from '@/app/lib/supabase/client';
import type { User } from '@/app/data/types';

interface AuthContextValue {
  user: User | null;
  login: (u: User | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function userFromSession(session: Session | null): User | null {
  if (!session) return null;

  const metadata = session.user.user_metadata;
  const name =
    metadata?.username ??
    metadata?.full_name ??
    metadata?.name ??
    session.user.email?.split('@')[0] ??
    'Jugador';

  return { name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(userFromSession(session));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(userFromSession(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = (u: User | null) => {
    setUser(u);
  };

  const signOut = () => {
    const supabase = createClient();
    supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, login, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
