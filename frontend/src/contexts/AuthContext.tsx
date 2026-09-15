'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { subscribeToUser } from '@/lib/firestore';
import { signInWithGoogle, signOutUser, validateMuDomain } from '@/lib/auth';
import type { UserProfile } from '@/types';

// ─── Context shape ────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
  signIn: async () => {},
  signOut: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Firebase auth state listener
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser && !validateMuDomain(firebaseUser.email ?? '')) {
        // Reject non-MU accounts at the client level
        signOutUser().catch(console.error);
        setUser(null);
        setProfile(null);
        setAuthError("Only @mastersunion.org accounts can access MU One.");
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
      setAuthError(null);
      setLoading(false);
    });

    return () => unsubAuth();
  }, []);

  // Firestore profile listener
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const unsubProfile = subscribeToUser(user.uid, (p) => setProfile(p));
    return () => unsubProfile();
  }, [user]);

  const signIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      setAuthError(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, authError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
