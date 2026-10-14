'use client';

/**
 * NamazWidget — Pakistan (Karachi) ke live namaz timings.
 * Aladhan API: timingsByCity?city=Karachi&country=Pakistan&method=2
 * Client-side fetch, localStorage me din bhar cache.
 * Next prayer + countdown: "Maghrib me 45 min".
 */

import { useEffect, useMemo, useState } from 'react';
import { Icon, ICONS } from './common';

const API = 'https://api.aladhan.com/v1/timingsByCity?city=Karachi&country=Pakistan&method=2';
const CACHE_KEY = 'v5-namaz-timings';

export interface PrayerTimes {
  Fajr: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

export interface NextPrayer {
  name: keyof PrayerTimes;
  urdu: string;
  at: Date;
  minsLeft: number;
}

const URDU: Record<keyof PrayerTimes, string> = {
  Fajr: 'Fajr',
  Dhuhr: 'Zohar',
  Asr: 'Asr',
  Maghrib: 'Maghrib',
  Isha: 'Isha',
};

const ORDER: (keyof PrayerTimes)[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** "05:12 (PKT)" -> {h:5,m:12} */
function parseHM(s: string): { h: number; m: number } | null {
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

function atToday(hm: { h: number; m: number }, dayOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hm.h, hm.m, 0, 0);
  return d;
}

async function fetchTimings(): Promise<PrayerTimes | null> {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const c = JSON.parse(cached) as { key: string; timings: PrayerTimes };
      if (c.key === todayKey() && c.timings?.Fajr) return c.timings;
    }
  } catch {}
  try {
    const res = await fetch(API);
    const json = await res.json();
    const t = json?.data?.timings;
    if (!t?.Fajr) return null;
    const timings: PrayerTimes = {
      Fajr: String(t.Fajr),
      Dhuhr: String(t.Dhuhr),
      Asr: String(t.Asr),
      Maghrib: String(t.Maghrib),
      Isha: String(t.Isha),
    };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ key: todayKey(), timings }));
    } catch {}
    return timings;
  } catch {
    return null;
  }
}

export function useNamaz() {
  const [timings, setTimings] = useState<PrayerTimes | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetchTimings().then((t) => {
      if (live && t) setTimings(t);
    });
    const iv = setInterval(() => setTick((x) => x + 1), 30000);
    return () => {
      live = false;
      clearInterval(iv);
    };
  }, []);

  const next: NextPrayer | null = useMemo(() => {
    if (!timings) return null;
    void tick;
    const now = new Date();
    for (const name of ORDER) {
      const hm = parseHM(timings[name]);
      if (!hm) continue;
      const at = atToday(hm);
      if (at.getTime() > now.getTime()) {
        return { name, urdu: URDU[name], at, minsLeft: Math.max(1, Math.round((at.getTime() - now.getTime()) / 60000)) };
      }
    }
    // sab guzar gayi — kal ki Fajr
    const hm = parseHM(timings.Fajr);
    if (!hm) return null;
    const at = atToday(hm, 1);
    return { name: 'Fajr', urdu: URDU.Fajr, at, minsLeft: Math.max(1, Math.round((at.getTime() - now.getTime()) / 60000)) };
  }, [timings, tick]);

  return { timings, next };
}

/** Countdown text: "Maghrib me 45 min" / "Fajr me 2 ghante 10 min". */
export function nextPrayerLabel(next: NextPrayer | null): string {
  if (!next) return 'Namaz timings load ho rahe hain…';
  const m = next.minsLeft;
  const dur = m >= 60 ? `${Math.floor(m / 60)} ghante ${m % 60 ? `${m % 60} min` : ''}`.trim() : `${m} min`;
  return `${next.urdu} me ${dur}`;
}

function fmtClock12(s: string): string {
  const hm = parseHM(s);
  if (!hm) return s;
  let h = hm.h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(hm.m).padStart(2, '0')} ${ampm}`;
}

/** Rail ke liye chhota badge: next prayer ka naam + waqt. */
export function useNamazBadge(): string | null {
  const { next } = useNamaz();
  if (!next) return null;
  return `${next.urdu} ${next.minsLeft >= 60 ? `${Math.floor(next.minsLeft / 60)}g ${next.minsLeft % 60}m` : `${next.minsLeft}m`}`;
}

/** Full widget — home/welcome area + namaz panel. */
export default function NamazWidget() {
  const { timings, next } = useNamaz();

  return (
    <div className="bg-[#111b21] border border-[#222d34] rounded-2xl overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 2v3M12 5c-4 0-7 2.5-7 6v9h14V11c0-3.5-3-6-7-6zM4 20h16M9 11h.01M15 11h.01" />
            <path d="M18.5 4.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
          </svg>
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium text-[#e9edef]">Namaz Timings</h3>
          <p className="text-[12px] text-[#8696a0]">Karachi, Pakistan · aaj</p>
        </div>
      </div>

      {next && (
        <div className="mx-4 mb-3 rounded-xl bg-[#00a884]/10 border border-[#00a884]/25 px-4 py-3 flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="v5pulse absolute inline-flex h-full w-full rounded-full bg-[#00a884]" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00a884]" />
          </span>
          <p className="text-[13.5px] text-[#e9edef]">
            Agli namaz: <span className="font-semibold text-[#00a884]">{next.urdu}</span>
            <span className="text-[#8696a0]"> · {nextPrayerLabel(next).split(' me ')[1] ? `${nextPrayerLabel(next)}` : ''}</span>
          </p>
        </div>
      )}

      <div className="px-2 pb-3">
        {!timings ? (
          <div className="px-3 py-2 space-y-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="v5shimmer h-9 rounded-lg" />
            ))}
          </div>
        ) : (
          ORDER.map((name) => {
            const isNext = next?.name === name;
            return (
              <div
                key={name}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl mx-1 ${
                  isNext ? 'bg-[#00a884]/10' : 'hover:bg-[#1f2c34]'
                }`}
              >
                <span className={`text-[14px] flex items-center gap-2 ${isNext ? 'text-[#00a884] font-semibold' : 'text-[#e9edef]'}`}>
                  {isNext && <Icon d={ICONS.clock} size={15} />}
                  {URDU[name]}
                  {isNext && <span className="text-[10.5px] font-medium bg-[#00a884]/20 text-[#00a884] px-1.5 py-[1px] rounded-full">AGLI</span>}
                </span>
                <span className={`text-[13.5px] tabular-nums ${isNext ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}`}>
                  {fmtClock12(timings[name])}
                </span>
              </div>
            );
          })
        )}
      </div>
      <p className="px-5 pb-4 text-[11px] text-[#8696a0]">Timings Aladhan API se · rozana auto-update</p>
    </div>
  );
}
