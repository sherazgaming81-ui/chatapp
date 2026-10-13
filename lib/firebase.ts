import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
}

let cached: FirebaseServices | null = null;

export function getFirebase(): FirebaseServices | null {
  if (!isFirebaseConfigured) return null;
  if (!cached) {
    const app =
      getApps().length > 0
        ? getApps()[0]
        : initializeApp({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          });
    cached = { app, auth: getAuth(app), db: getFirestore(app), storage: getStorage(app) };
  }
  return cached;
}
