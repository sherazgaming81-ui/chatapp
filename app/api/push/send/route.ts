import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

// ---- helpers ----
function b64u(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function unb64u(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}
function hkdf(ikm: Buffer, salt: Buffer, info: Buffer, len: number): Buffer {
  const prk = crypto.createHmac('sha256', salt).update(ikm).digest();
  let prev = Buffer.alloc(0);
  let res = Buffer.alloc(0);
  let i = 1;
  while (res.length < len) {
    const h = crypto.createHmac('sha256', prk);
    h.update(Buffer.concat([prev, info, Buffer.from([i])]));
    prev = h.digest();
    res = Buffer.concat([res, prev]);
    i++;
  }
  return res.slice(0, len);
}
function derToRaw(der: Buffer): Buffer {
  // ECDSA DER -> r||s (64 bytes)
  let o = 2; // skip 0x30 len
  if (der[1] & 0x80) o = 2 + (der[1] & 0x7f);
  o++; // skip 0x02
  let rLen = der[o++];
  let r = der.slice(o, o + rLen); o += rLen;
  o++; // skip 0x02
  let sLen = der[o++];
  let s = der.slice(o, o + sLen);
  if (r.length > 32) r = r.slice(r.length - 32);
  if (s.length > 32) s = s.slice(s.length - 32);
  return Buffer.concat([Buffer.alloc(32 - r.length).fill(0), r, Buffer.alloc(32 - s.length).fill(0), s]);
}

async function sendWebPush(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string
): Promise<number> {
  const vapidPub = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPriv = process.env.VAPID_PRIVATE_KEY || '';
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@chatapp0071.vercel.app';
  if (!vapidPub || !vapidPriv) throw new Error('VAPID keys missing');

  const uaPub = unb64u(sub.keys.p256dh);
  const authSecret = unb64u(sub.keys.auth);
  const salt = crypto.randomBytes(16);
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const serverPub = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(uaPub);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPub, serverPub]);
  const ikm = hkdf(sharedSecret, authSecret, keyInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);

  const plaintext = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const recordSize = 4096;
  const body = Buffer.concat([
    salt,
    Buffer.from([(recordSize >> 24) & 255, (recordSize >> 16) & 255, (recordSize >> 8) & 255, recordSize & 255]),
    Buffer.from([serverPub.length]),
    serverPub,
    ct,
  ]);

  // VAPID JWT (ES256)
  const aud = new URL(sub.endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const header = b64u(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64u(Buffer.from(JSON.stringify({ aud, exp, sub: subject })));
  const signInput = `${header}.${claims}`;
  const privDer = Buffer.concat([
    Buffer.from('302e0201010420', 'hex'),
    unb64u(vapidPriv),
    Buffer.from('a00706052b8104000a', 'hex'),
  ]);
  const keyObj = crypto.createPrivateKey({ key: privDer, format: 'der', type: 'sec1' });
  const derSig = crypto.sign('sha256', Buffer.from(signInput), keyObj);
  const jwt = `${signInput}.${b64u(derToRaw(derSig))}`;

  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      Authorization: `vapid t=${jwt}, k=${vapidPub}`,
      TTL: '120',
    },
    body: new Uint8Array(body),
  });
  return res.status;
}

// ---- route ----
export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { chatId, title, body: text } = await req.json();
    if (!chatId) return NextResponse.json({ error: 'chatId required' }, { status: 400 });

    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: userRes } = await sb.auth.getUser();
    const senderId = userRes?.user?.id;
    if (!senderId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const { data: parts } = await sb.from('chat_participants').select('user_id').eq('chat_id', chatId);
    const recipients = [...new Set((parts || []).map((p) => p.user_id).filter((id: string) => id !== senderId))];
    if (recipients.length === 0) return NextResponse.json({ sent: 0 });

    // muted chats skip karo
    const { data: settings } = await sb
      .from('user_chat_settings')
      .select('user_id,muted')
      .eq('chat_id', chatId)
      .in('user_id', recipients);
    const mutedSet = new Set(((settings || []) as Array<{ user_id: string; muted: boolean }>).filter((s) => s.muted).map((s) => s.user_id));
    const targets = recipients.filter((id) => !mutedSet.has(id));

    const { data: subs } = await sb.from('push_subscriptions').select('endpoint,keys').in('user_id', targets);
    const list = (subs || []) as Array<{ endpoint: string; keys: { p256dh: string; auth: string } }>;

    const payload = JSON.stringify({ title: title || 'Chat', body: text || 'Naya message', chatId });
    const results = await Promise.allSettled(list.map((s) => sendWebPush(s, payload)));

    // 404/410 wali dead subscriptions saaf karo
    const dead: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && (r.value === 404 || r.value === 410)) dead.push(list[i].endpoint);
    });
    if (dead.length > 0) {
      await sb.from('push_subscriptions').delete().in('endpoint', dead);
    }

    const sent = results.filter((r) => r.status === 'fulfilled' && (r.value === 200 || r.value === 201)).length;
    return NextResponse.json({ sent, total: list.length });
  } catch (e) {
    console.error('push send failed:', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
