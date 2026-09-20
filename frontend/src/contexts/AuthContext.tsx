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
import { getPlatformAccess, type PlatformAccessStatus } from '@/lib/functions';

// ─── Context shape ────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  googleConnected: boolean;
  authError: string | null;
  access: PlatformAccessStatus | null;
  accessLoading: boolean;
  refreshAccess: () => Promise<void>;
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
  access: null,
  accessLoading: true,
  refreshAccess: async () => {},
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
  const [access, setAccess] = useState<PlatformAccessStatus | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  const refreshAccess = useCallback(async () => {
    if (!auth.currentUser) {
      setAccess(null);
      setAccessLoading(false);
      return;
    }
    setAccessLoading(true);
    try {
      setAccess(await getPlatformAccess());
    } catch (error) {
      console.warn('Unable to verify platform access:', error);
      setAccess({
        email: auth.currentUser.email ?? '',
        isAdmin: false,
        hasAccess: false,
        waitlistStatus: null,
      });
    } finally {
      setAccessLoading(false);
    }
  }, []);

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
          setAccessLoading(true);
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
          setAccess(null);
          setAccessLoading(false);
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

  useEffect(() => {
    if (user) void refreshAccess();
  }, [user, refreshAccess]);

  // Firestore profile listener
  useEffect(() => {
    if (!user || accessLoading || !access?.hasAccess) {
      setProfile(null);
      if (!accessLoading) setProfileLoading(false);
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
  }, [user, access, accessLoading]);

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
    setAccess(null);
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
        access,
        accessLoading,
        refreshAccess,
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
