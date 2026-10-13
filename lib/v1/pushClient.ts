// pushClient — message bhejne ke baad push notification trigger karta hai.
// Server route /api/push/send ko call karta hai (jo VAPID se subscribers ko bhejta hai).
// Usage: triggerPush(chatId, senderName, previewText)

import { backend } from '@/lib/backend';

export async function triggerPush(chatId: string, title: string, body: string): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    const token = await backend.getAuthToken?.();
    if (!token) return;
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatId, title, body }),
    }).catch(() => {});
  } catch {
    // push optional hai — fail ho to khamoshi se ignore
  }
}
