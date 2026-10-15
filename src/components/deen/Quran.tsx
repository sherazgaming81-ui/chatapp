"use client";
import { BookMarked, Bookmark, Loader2, Search, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/data/store";
import { SURAHS, QURAN_LOCAL } from "@/data/deen";
import { getSurah, go, toggleBookmark } from "@/data/api";
import { cn } from "@/lib/util";
import { Btn, Page, Seg, inputCls } from "../ui";

export function QuranList() {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "marks">("all");
  const marks = useStore((s) => s.bookmarks);
  const list = SURAHS.filter((s) => !q || (s.name + s.meaning + s.n).toLowerCase().includes(q.toLowerCase()));
  return (
    <Page title="Quran-e-Pak" sub="114 suratein">
      <div className="relative mb-3"><Search size={17} className="absolute left-3.5 top-3.5 text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Surah dhoondo…" className={cn(inputCls, "pl-10")} /></div>
      <Seg value={tab} onChange={setTab} className="mb-4" options={[{ v: "all", l: "Saari suratein" }, { v: "marks", l: `Bookmarks (${marks.length})` }]} />
      {tab === "all" ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {list.map((s) => (
            <button key={s.n} onClick={() => go("reader", { n: s.n })} className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface2">
              <span className="relative grid h-10 w-10 shrink-0 place-items-center"><svg viewBox="0 0 40 40" className="absolute inset-0 text-accent/30"><path d="M20 2l5 5h8v8l5 5-5 5v8h-8l-5 5-5-5H7v-8l-5-5 5-5V7h8z" fill="currentColor" /></svg><span className="relative text-xs font-extrabold">{s.n}</span></span>
              <span className="flex-1"><span className="block font-bold">{s.name}</span><span className="text-xs text-mute">{s.meaning} · {s.ayahs} aayaat</span></span>
              {QURAN_LOCAL[s.n] && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">offline</span>}
            </button>
          ))}
        </div>
      ) : marks.length === 0 ? <p className="py-10 text-center text-mute">Koi bookmark nahi. Reader me aayat par bookmark dabayein.</p> : (
        <div className="space-y-2">{marks.map((k) => { const [n, a] = k.split(":").map(Number); return <button key={k} onClick={() => go("reader", { n, focus: a })} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left"><BookMarked className="text-gold" size={20} /><span className="font-bold">{SURAHS[n - 1].name} · Aayat {a}</span></button>; })}</div>
      )}
    </Page>
  );
}

export function QuranReader({ n, focus }: { n: number; focus?: number }) {
  const s = SURAHS[n - 1];
  const marks = useStore((st) => st.bookmarks);
  const [data, setData] = useState<{ ar: string[]; ur: string[] } | null>(QURAN_LOCAL[n] ?? null);
  const [err, setErr] = useState(false);
  const load = () => { setErr(false); getSurah(n).then((d) => (d ? setData(d) : setErr(true))); };
  useEffect(() => { if (!data) load(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (data && focus) setTimeout(() => document.getElementById("ay-" + focus)?.scrollIntoView({ block: "center" }), 150); }, [data, focus]);
  return (
    <Page title={`${s.n}. ${s.name}`} sub={`${s.meaning} · ${s.ayahs} aayaat`}>
      {n !== 1 && n !== 9 && <p className="arabic mb-6 text-center text-3xl text-gold">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>}
      {!data && !err && <div className="grid place-items-center py-16 text-mute"><Loader2 className="animate-spin" /><p className="mt-2 text-sm">Surah load ho rahi hai…</p></div>}
      {err && <div className="py-12 text-center"><WifiOff className="mx-auto mb-3 text-mute" /><p className="mb-4 text-mute">Is surah ka text offline nahi hai. Internet on karke dobara koshish karein.</p><Btn onClick={load}>Dobara koshish</Btn></div>}
      {data && data.ar.map((a, i) => {
        const k = `${n}:${i + 1}`, on = marks.includes(k);
        const text = n !== 1 && i === 0 && a.startsWith("بِسْمِ") && a.length > 45 ? a.replace(/^بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَـٰنِ\s+ٱلرَّحِيمِ\s*/, "") : a;
        return (
          <div id={"ay-" + (i + 1)} key={i} className={cn("mb-4 rounded-2xl border p-4", focus === i + 1 ? "border-gold bg-gold/5" : "border-line bg-surface")}>
            <div className="mb-2 flex items-center justify-between"><span className="grid h-7 w-7 place-items-center rounded-full bg-accent/15 text-xs font-extrabold text-accent">{i + 1}</span>
              <button onClick={() => toggleBookmark(k)} className={cn("rounded-full p-1.5 transition", on ? "text-gold" : "text-mute hover:text-fg")} aria-label="Bookmark"><Bookmark size={19} fill={on ? "currentColor" : "none"} /></button></div>
            <p className="arabic text-[28px]">{text}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-mute" dir="auto">{data.ur[i]}</p>
          </div>
        );
      })}
    </Page>
  );
}
