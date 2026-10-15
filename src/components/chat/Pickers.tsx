"use client";
import { Search, Smile, Sticker, Film, Clock, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { BUILTIN_PACKS, EMOJI, EMOJI_KW, GIFS, GIF_CATS } from "@/data/assets";
import { useStore } from "@/data/store";
import { cn } from "@/lib/util";
import { go } from "@/data/api";

export default function Pickers({ onEmoji, onSticker, onGif }: { onEmoji: (e: string) => void; onSticker: (src: string) => void; onGif: (id: string) => void }) {
  const [tab, setTab] = useState<"emoji" | "gif" | "sticker">("emoji");
  return (
    <div className="flex h-[300px] flex-col border-t border-line bg-surface md:h-[320px]">
      <div className="flex items-center gap-1 px-2 pt-1.5">
        {([["emoji", Smile, "Emoji"], ["gif", Film, "GIF"], ["sticker", Sticker, "Sticker"]] as const).map(([k, I, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition", tab === k ? "bg-accent text-accent-fg" : "text-mute hover:bg-surface2")}><I size={16} />{l}</button>
        ))}
      </div>
      {tab === "emoji" && <EmojiTab onPick={onEmoji} />}
      {tab === "gif" && <GifTab onPick={onGif} />}
      {tab === "sticker" && <StickerTab onPick={onSticker} />}
    </div>
  );
}

function EmojiTab({ onPick }: { onPick: (e: string) => void }) {
  const recent = useStore((s) => s.recentEmoji);
  const [cat, setCat] = useState("recent");
  const [q, setQ] = useState("");
  const all = useMemo(() => EMOJI.flatMap((c) => c.list), []);
  const list = q.trim()
    ? all.filter((e, i) => all.indexOf(e) === i && (((EMOJI_KW[e] ?? "") + " " + EMOJI.find((c) => c.list.includes(e))?.name).toLowerCase().includes(q.toLowerCase())))
    : cat === "recent" ? recent : EMOJI.find((c) => c.id === cat)!.list;
  return (
    <>
      <div className="relative px-3 pt-2"><Search size={15} className="absolute left-5 top-[19px] text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Emoji dhoondo (jaise: chai, dua, hasi)" className="w-full rounded-full bg-surface2 py-2 pl-9 pr-3 text-sm outline-none" /></div>
      {!q && (
        <div className="noscroll flex gap-0.5 overflow-x-auto px-2 py-1.5">
          <button onClick={() => setCat("recent")} className={cn("grid h-8 w-9 shrink-0 place-items-center rounded-lg", cat === "recent" ? "bg-surface2 text-accent" : "text-mute")}><Clock size={17} /></button>
          {EMOJI.map((c) => <button key={c.id} title={c.name} onClick={() => setCat(c.id)} className={cn("h-8 w-9 shrink-0 rounded-lg text-lg", cat === c.id ? "bg-surface2" : "opacity-60 hover:opacity-100")}>{c.icon}</button>)}
        </div>
      )}
      <div className="thin min-h-0 flex-1 overflow-y-auto px-2 pb-2" style={{ contentVisibility: "auto" }}>
        {list.length === 0 && <p className="py-8 text-center text-sm text-mute">{q ? "Koi emoji nahi mila" : "Abhi koi recent emoji nahi"}</p>}
        <div className="grid grid-cols-8 gap-0.5 md:grid-cols-10">
          {list.map((e, i) => <button key={e + i} onClick={() => onPick(e)} className="grid h-10 place-items-center rounded-lg text-[26px] transition active:scale-125 hover:bg-surface2">{e}</button>)}
        </div>
      </div>
    </>
  );
}

function GifTab({ onPick }: { onPick: (id: string) => void }) {
  const [cat, setCat] = useState("Sab");
  const [q, setQ] = useState("");
  const list = GIFS.filter((g) => (cat === "Sab" || g.cat === cat) && (!q || (g.cap + g.cat).toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <div className="relative px-3 pt-2"><Search size={15} className="absolute left-5 top-[19px] text-mute" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="GIF dhoondo" className="w-full rounded-full bg-surface2 py-2 pl-9 pr-3 text-sm outline-none" /></div>
      <div className="noscroll flex gap-1.5 overflow-x-auto px-3 py-2">{GIF_CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold", cat === c ? "bg-accent text-accent-fg" : "bg-surface2 text-mute")}>{c}</button>)}</div>
      <div className="thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {list.map((g) => (
            // eslint-disable-next-line @next/next/no-img-element
            <button key={g.id} onClick={() => onPick(g.id)} className="overflow-hidden rounded-xl transition active:scale-95"><img src={g.url} alt={g.cap} className="aspect-[13/10] w-full object-cover" /></button>
          ))}
        </div>
        {!list.length && <p className="py-8 text-center text-sm text-mute">Koi GIF nahi mila</p>}
      </div>
    </>
  );
}

function StickerTab({ onPick }: { onPick: (src: string) => void }) {
  const custom = useStore((s) => s.stickerPacks);
  const recent = useStore((s) => s.recentStickers);
  const packs = [{ id: "recent", name: "Recent", icon: "", stickers: recent }, ...BUILTIN_PACKS, ...custom];
  const [pid, setPid] = useState(recent.length ? "recent" : "urdu");
  const p = packs.find((x) => x.id === pid) ?? packs[1];
  return (
    <>
      <div className="noscroll flex items-center gap-1.5 overflow-x-auto px-2 py-2">
        {packs.map((k) => (
          <button key={k.id} onClick={() => setPid(k.id)} className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", pid === k.id ? "bg-surface2 ring-1 ring-accent" : "opacity-70")}>
            {k.id === "recent" ? <Clock size={18} /> : k.icon ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={k.icon} alt="" className="h-8 w-8" /> : <Sticker size={18} />}
          </button>
        ))}
        <button onClick={() => go("stickerpacks")} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-accent"><Plus size={18} /></button>
      </div>
      <p className="px-3 pb-1 text-xs font-bold uppercase tracking-wider text-mute">{p.name}</p>
      <div className="thin min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
          {p.stickers.map((s, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <button key={i} onClick={() => onPick(s)} className="rounded-xl p-1 transition active:scale-90 hover:bg-surface2"><img src={s} alt="sticker" className="aspect-square w-full" draggable={false} /></button>
          ))}
        </div>
        {!p.stickers.length && <p className="py-8 text-center text-sm text-mute">{p.id === "recent" ? "Abhi koi recent sticker nahi" : "Is pack me sticker nahi. Sticker banao (+)"}</p>}
      </div>
    </>
  );
}
