// notify.ts — foreground (in-app) browser notifications.
// Usage: import { canNotify, showNotification } from '@/lib/v1/notify';
//   if (canNotify()) showNotification('Naya message', 'Ali: Salam!');

export function canNotify(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && Notification.permission === 'granted';
}

export function showNotification(title: string, body: string): void {
  if (!canNotify()) return;
  try {
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
    });
  } catch {
    // Permission lost ya platform issue — silently ignore
  }
}
