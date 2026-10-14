import { isFirebaseConfigured } from '../firebase';
import { DemoBackend } from './demoBackend';
import { FirebaseBackend } from './firebaseBackend';
import { isSupabaseConfigured, SupabaseBackend } from './supabaseBackend';
import type { ChatBackend } from './types';
import type { BackendV2, BackendV3 } from '../v2/types';

function pickBackend(): ChatBackend {
  if (isSupabaseConfigured) return new SupabaseBackend();
  if (isFirebaseConfigured) return new FirebaseBackend();
  return new DemoBackend();
}

export const backend: ChatBackend = pickBackend();
/** v2 API — same instance, BackendV2 contract ke roop me (demo/firebase me stubs hain). */
export const backendV2 = backend as unknown as BackendV2;
/** v3 API — same instance, BackendV3 contract ke roop me (demo/firebase me stubs hain). */
export const backendV3 = backend as unknown as BackendV3;
export const isDemoMode = backend.mode === 'demo';
export const activeBackendName = backend.mode;
