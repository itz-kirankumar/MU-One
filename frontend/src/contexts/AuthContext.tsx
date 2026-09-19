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
import { auth, authPersistenceReady } from '@/lib/firebase';
import { subscribeToUser } from '@/lib/firestore';
import { signInWithGoogle, signOutUser, validateMuDomain } from '@/lib/auth';
import type { UserProfile } from '@/types';

// ─── Context shape ────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleConnected: boolean;
  authError: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  profileLoading: true,
  googleConnected: false,
  authError: null,
  signIn: async () => {},
  signOut: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [cachedGoogleConnected, setCachedGoogleConnected] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Firebase auth state listener
  useEffect(() => {
    let cancelled = false;
    let unsubAuth: (() => void) | undefined;

    void authPersistenceReady.then(() => {
      if (cancelled) return;
      unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser && !validateMuDomain(firebaseUser.email ?? '')) {
          // Reject non-MU accounts at the client level
          signOutUser().catch(console.error);
          setUser(null);
          setProfile(null);
          setProfileLoading(false);
          setCachedGoogleConnected(false);
          setAuthError("Only @mastersunion.org accounts can access MU One.");
          setLoading(false);
          return;
        }

        if (firebaseUser) {
          setProfileLoading(true);
          try {
            setCachedGoogleConnected(
              localStorage.getItem(`muone:google-connected:${firebaseUser.uid}`) === 'true'
            );
          } catch {
            setCachedGoogleConnected(false);
          }
        } else {
          setProfile(null);
          setProfileLoading(false);
          setCachedGoogleConnected(false);
        }

        setUser(firebaseUser);
        setAuthError(null);
        setLoading(false);
      });
    });

    return () => {
      cancelled = true;
      unsubAuth?.();
    };
  }, []);

  // Firestore profile listener
  useEffect(() => {
    if (!user) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const unsubProfile = subscribeToUser(
      user.uid,
      (p) => {
        setProfile(p);
        const connected = p?.googleConnection?.connected === true;
        setCachedGoogleConnected(connected);
        try {
          const key = `muone:google-connected:${user.uid}`;
          if (connected) localStorage.setItem(key, 'true');
          else localStorage.removeItem(key);
        } catch {}
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );
    return () => unsubProfile();
  }, [user]);

  const googleConnected =
    profile?.googleConnection?.connected === true ||
    (profileLoading && cachedGoogleConnected);

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
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        profileLoading,
        googleConnected,
        authError,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
