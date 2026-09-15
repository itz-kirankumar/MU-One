import {
  signInWithPopup,
  signOut,
  type UserCredential,
} from 'firebase/auth';
import { auth, provider } from '@/lib/firebase';

const MU_DOMAIN = '@mastersunion.org';

/**
 * Returns true if the email belongs to the Masters' Union domain.
 */
export function validateMuDomain(email: string): boolean {
  return typeof email === 'string' && email.toLowerCase().endsWith(MU_DOMAIN);
}

/**
 * Open Google sign-in popup and validate the domain.
 * Throws if the user's email is not a Masters' Union account.
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const credential = await signInWithPopup(auth, provider);
  const email = credential.user.email ?? '';
  if (!validateMuDomain(email)) {
    // Sign the user out immediately to prevent access
    await signOut(auth);
    throw new Error(
      `Only @mastersunion.org accounts can access MU One. Got: ${email}`
    );
  }
  return credential;
}

/**
 * Sign out the current user from Firebase.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
