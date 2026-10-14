'use client';

/**
 * haptic — mobile par halki vibration (Haptic Touch feel).
 * Desktop / unsupported browsers par silently no-op.
 */
export function haptic(pattern: number | number[] = 12): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
}

/** Button dabane par — halka tap */
export const tapHaptic = () => haptic(10);
/** Send / confirm par — thoda wazeh */
export const sendHaptic = () => haptic([12, 30, 18]);
/** Error / cancel par */
export const errorHaptic = () => haptic([25, 40, 25]);
