import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// Firebase's default Firestore database is literally named "(default)".
// Passing the bare string "default" targets a *named* database that does not
// exist, and every listener fails with NOT_FOUND. Only opt into a named
// database when one is explicitly configured.
const databaseId = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID?.trim() || 'default';
const db = getFirestore(app, databaseId);
const auth = getAuth(app);
const functions = getFunctions(app, 'us-central1');

const provider = new GoogleAuthProvider();
// Full scopes for calendar, mail, and tasks — used for sign-in only.
// Actual API calls are made server-side via Cloud Functions.
provider.addScope('https://www.googleapis.com/auth/calendar');
provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/tasks');

export { app, db, auth, functions, provider };
