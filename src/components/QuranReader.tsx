"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ChevronLeft, Bookmark, BookmarkCheck, BookOpen, X, Clock } from "lucide-react";
import {
  fetchSurahList, fetchSurah, getBookmarks, toggleBookmark,
  saveLastRead, getLastRead, getAllLastRead, BISMILLAH, BISMILLAH_URDU,
  type SurahMeta, type Ayah, type Bookmark as BM,
} from "@/lib/quran";

type View = { kind: "list" } | { kind: "reader"; surah: number; scrollTo?: number } | { kind: "bookmarks" };

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-black/[0.06] ${className}`} />;
}

function SurahList({ onOpen }: { onOpen: (n: number) => void }) {
  const [surahs, setSurahs] = useState<SurahMeta[] | null>(null);
  const [err, setErr] = useState(false);
  const [q, setQ] = useState("");
  const lastRead = useMemo(() => getAllLastRead().slice(0, 1)[0], [surahs]);

  useEffect(() => {
    fetchSurahList().then(setSurahs).catch(() => setErr(true));
  }, []);

  const filtered = useMemo(() => {
    if (!surahs) return [];
    const t = q.trim().toLowerCase();
    if (!t) return surahs;
    return surahs.filter((s) =>
      s.englishName.toLowerCase().includes(t) ||
      String(s.number) === t ||
      (s.englishNameTranslation || "").toLowerCase().includes(t)
    );
  }, [surahs, q]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 space-y-2.5 p-3 sm:p-4">
        {lastRead && (
          <button
            onClick={() => onOpen(lastRead.surah)}
            className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-[#5865f2] to-[#7b86f5] p-4 text-left text-white soft-shadow transition active:scale-[0.99]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20"><Clock size={20} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold uppercase tracking-[0.1em] text-white/75">Jari rakho</span>
              <span className="block truncate text-[15px] font-extrabold">{lastRead.surahName} · Ayat {lastRead.ayah}</span>
            </span>
            <ChevronLeft size={18} className="rotate-180 text-white/80" />
          </button>
        )}
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#80848e]" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Surah talash karo…"
            className="field w-full py-2.5 pl-10 pr-4 text-sm"
          />
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
        {err && (
          <div className="rounded-2xl border border-black/10 bg-white/60 p-6 text-center">
            <p className="text-sm font-bold text-[#2f3035]">Internet check karo 🌐</p>
            <p className="mt-1 text-xs text-[#80848e]">Surah list load nahi ho saki</p>
            <button onClick={() => { setErr(false); fetchSurahList().then(setSurahs).catch(() => setErr(true)); }} className="mt-3 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-bold text-white">Dobara koshish</button>
          </div>
        )}
        {!err && !surahs && (
          <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[68px]" />)}</div>
        )}
        {!err && surahs && (
          <div className="space-y-1.5">
            {filtered.map((s) => {
              const lr = getLastRead(s.number);
              return (
                <button
                  key={s.number} onClick={() => onOpen(s.number)}
                  className="flex w-full items-center gap-3 rounded-xl border border-transparent bg-white/50 p-3 text-left transition hover:border-[#5865f2]/30 hover:bg-white active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#5865f2]/[0.08] text-sm font-extrabold text-[#5865f2]">{s.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-bold text-[#2f3035]">{s.englishName}</span>
                      {lr && <span className="badge-pill shrink-0" style={{ background: "#23a55a22", color: "#1a7a55" }}>Jari rakho</span>}
                    </span>
                    <span className="block text-xs text-[#80848e]">{s.revelationType === "Meccan" ? "Makki" : "Madani"} · {s.numberOfAyahs} ayatein</span>
                  </span>
                  <span className="font-quran shrink-0 text-xl text-[#2f3035]" dir="rtl" lang="ar">{s.name}</span>
                </button>
              );
            })}
            {filtered.length === 0 && <p className="py-8 text-center text-sm text-[#80848e]">Koi surah nahi mili 🔍</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function Reader({ surah, scrollTo }: { surah: number; scrollTo?: number }) {
  const [data, setData] = useState<{ meta: SurahMeta; ayahs: Ayah[] } | null>(null);
  const [err, setErr] = useState(false);
  const [marks, setMarks] = useState<BM[]>([]);
  const scRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData(null); setErr(false);
    fetchSurah(surah).then(setData).catch(() => setErr(true));
    setMarks(getBookmarks());
  }, [surah]);

  useEffect(() => {
    if (data && scrollTo) {
      const t = setTimeout(() => {
        document.getElementById(`q-ayah-${scrollTo}`)?.scrollIntoView({ block: "center" });
      }, 350);
      return () => clearTimeout(t);
    }
  }, [data, scrollTo]);

  // last-read tracking: save the topmost visible ayah (throttled on scroll)
  useEffect(() => {
    const el = scRef.current;
    if (!el || !data) return;
    let t: any;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const nodes = el.querySelectorAll("[data-ayah]");
        for (const n of Array.from(nodes)) {
          const r = (n as HTMLElement).getBoundingClientRect();
          const pr = el.getBoundingClientRect();
          if (r.top >= pr.top - 40) {
            const a = parseInt((n as HTMLElement).dataset.ayah || "1", 10);
            saveLastRead(surah, a, data.meta.englishName);
            break;
          }
        }
      }, 600);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); clearTimeout(t); };
  }, [data, surah]);

  const toggle = (ayah: number) => {
    if (!data) return;
    setMarks(toggleBookmark({ surah, ayah, surahName: data.meta.englishName, at: Date.now() }));
  };
  const showBismillah = data && data.meta.number !== 1 && data.meta.number !== 9;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6" ref={scRef}>
        {!data && !err && (
          <div className="space-y-4 pt-4">
            <Skeleton className="mx-auto h-10 w-48" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-4 w-3/4" /></div>
            ))}
          </div>
        )}
        {err && (
          <div className="rounded-2xl border border-black/10 bg-white/60 p-6 text-center">
            <p className="text-sm font-bold text-[#2f3035]">Internet check karo 🌐</p>
            <button onClick={() => { setErr(false); fetchSurah(surah).then(setData).catch(() => setErr(true)); }} className="mt-3 rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-bold text-white">Dobara koshish</button>
          </div>
        )}
        {data && (
          <div className="mx-auto max-w-2xl">
            {/* Surah header: Arabic naam + English naam + Makki/Madani + ayat count */}
            <div className="soft-shadow mt-4 rounded-2xl border border-black/[0.08] bg-white/70 px-4 py-4 text-center">
              <p className="font-quran text-[30px] leading-snug text-[#2f3035]" dir="rtl" lang="ar">{data.meta.name}</p>
              <p className="mt-1 text-[16px] font-extrabold text-[#2f3035]">{data.meta.englishName}</p>
              {data.meta.englishNameTranslation && (
                <p className="mt-0.5 text-xs text-[#80848e]">{data.meta.englishNameTranslation}</p>
              )}
              <div className="mt-2 flex items-center justify-center gap-2">
                <span className="badge-pill" style={{ background: "#5865f222", color: "#5865f2" }}>
                  {data.meta.revelationType === "Meccan" ? "Makki" : "Madani"}
                </span>
                <span className="text-xs font-semibold text-[#80848e]">{data.meta.numberOfAyahs} ayatein</span>
              </div>
            </div>
            {showBismillah && (
              <div className="py-6 text-center">
                <p className="font-quran text-[28px] leading-loose text-[#b8860b]" dir="rtl" lang="ar">{BISMILLAH}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#8a6d1a]" dir="rtl" lang="ur">{BISMILLAH_URDU}</p>
              </div>
            )}
            <div className="divide-y divide-black/[0.06]">
              {data.ayahs.map((a) => {
                const marked = marks.some((m) => m.surah === surah && m.ayah === a.numberInSurah);
                const arabic = (a.arabic || "").trim(); // stripping edge-case: khali matan par UI na toote
                return (
                  <article key={a.numberInSurah} id={`q-ayah-${a.numberInSurah}`} data-ayah={a.numberInSurah} className="group scroll-mt-24 py-5">
                    {arabic ? (
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-quran min-w-0 flex-1 text-right text-[24px] leading-[2.2] text-[#1f2023]" dir="rtl" lang="ar">
                          {arabic}
                          <span className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#5865f2]/30 bg-[#5865f2]/[0.07] align-middle font-sans text-[13px] font-bold text-[#5865f2]">{a.numberInSurah}</span>
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl bg-black/[0.04] p-3 text-center">
                        <span className="text-sm font-bold text-[#80848e]">Ayat {a.numberInSurah}</span>
                      </div>
                    )}
                    {a.urdu && <p className="mt-2 text-right text-[15px] leading-relaxed text-[#5c5e66]" dir="rtl" lang="ur">{a.urdu}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#a0a3ab]">Ayat {a.numberInSurah}</span>
                      <button
                        onClick={() => toggle(a.numberInSurah)}
                        className={`rounded-lg p-1.5 transition ${marked ? "text-[#5865f2]" : "text-[#a0a3ab] opacity-0 hover:bg-black/5 group-hover:opacity-100"}`}
                        aria-label="Bookmark"
                      >
                        {marked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="pt-4 text-center text-xs text-[#80848e]">SadaqAllahul Azeem 🤲</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BookmarksView({ onJump }: { onJump: (surah: number, ayah: number) => void }) {
  const [marks, setMarks] = useState<BM[]>([]);
  useEffect(() => { setMarks(getBookmarks()); }, []);
  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      <div className="mx-auto max-w-2xl space-y-1.5">
        {marks.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white/60 p-8 text-center">
            <Bookmark size={28} className="mx-auto text-[#a0a3ab]" />
            <p className="mt-2 text-sm font-bold text-[#2f3035]">Koi bookmark nahi</p>
            <p className="mt-1 text-xs text-[#80848e]">Kisi ayat par bookmark icon dabao — yahan save ho jayegi</p>
          </div>
        )}
        {marks.map((m, i) => (
          <div key={`${m.surah}:${m.ayah}`} className="flex items-center gap-3 rounded-xl bg-white/50 p-3">
            <button onClick={() => onJump(m.surah, m.ayah)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#5865f2]/[0.08]"><BookOpen size={17} className="text-[#5865f2]" /></span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-bold text-[#2f3035]">{m.surahName}</span>
                <span className="block text-xs text-[#80848e]">Ayat {m.ayah}</span>
              </span>
            </button>
            <button
              onClick={() => setMarks(toggleBookmark(m))}
              className="rounded-lg p-2 text-[#80848e] hover:bg-black/5 hover:text-[#e0245e]" aria-label="Hatao"
            ><X size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuranReader({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ kind: "list" });
  const title = view.kind === "reader" ? `Surah` : view.kind === "bookmarks" ? "Bookmarks" : "Quran-e-Pak";

  return (
    <div className="absolute inset-0 z-30 flex flex-col rounded-2xl bg-[#f4f5fa]/95 backdrop-blur-xl">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-black/10 px-3">
        <button onClick={() => view.kind === "list" ? onClose() : setView({ kind: "list" })} className="rounded-md p-2 text-[#5c5e66] hover:bg-black/5" aria-label="Wapas">
          <ChevronLeft size={20} />
        </button>
        <span className="text-xl">📖</span>
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-extrabold tracking-tight text-[#2f3035]">{title}</h1>
        <button
          onClick={() => setView(view.kind === "bookmarks" ? { kind: "list" } : { kind: "bookmarks" })}
          className={`rounded-lg p-2 transition ${view.kind === "bookmarks" ? "bg-[#5865f2]/10 text-[#5865f2]" : "text-[#5c5e66] hover:bg-black/5"}`}
          aria-label="Bookmarks"
        ><Bookmark size={19} /></button>
      </header>
      {view.kind === "list" && (
        <SurahList
          onOpen={(n) => setView({ kind: "reader", surah: n })}
        />
      )}
      {view.kind === "reader" && (
        <Reader surah={view.surah} scrollTo={view.scrollTo} />
      )}
      {view.kind === "bookmarks" && (
        <BookmarksView onJump={(s, a) => setView({ kind: "reader", surah: s, scrollTo: a })} />
      )}
    </div>
  );
}
