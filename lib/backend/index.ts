import { isFirebaseConfigured } from '../firebase';
import { DemoBackend } from './demoBackend';
import { FirebaseBackend } from './firebaseBackend';
import { isSupabaseConfigured, SupabaseBackend } from './supabaseBackend';
import type { ChatBackend } from './types';

function pickBackend(): ChatBackend {
  if (isSupabaseConfigured) return new SupabaseBackend();
  if (isFirebaseConfigured) return new FirebaseBackend();
  return new DemoBackend();
}

export const backend: ChatBackend = pickBackend();
export const isDemoMode = backend.mode === 'demo';
export const activeBackendName = backend.mode;
