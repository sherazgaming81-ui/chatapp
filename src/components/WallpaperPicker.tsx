"use client";
// ─── Wallpaper Picker — premium gallery UI ───
// Categories → grid → tap → BEAUTIFUL preview modal (mock chat ke sath)
// Blur / opacity / tint sliders, per-chat ya sab chats, random 🎲, reset.
import { useMemo, useRef, useState } from "react";
import { X, Check, Dices, RotateCcw, Upload, ImagePlus, Sparkles } from "lucide-react";
import {
  ALL_WALLPAPERS, MIXED_WALLPAPERS,
  wallpaperTileStyle, wallpaperBg, wallpaperAnimClass,
  getChatWallpaper, setChatWallpaper, clearChatWallpaper,
  setAllWallpaper, resetWallpapers, randomWallpaper,
  getCustomWallpaper, setCustomWallpaper,
  getSettings, setSettings, useWallpaperVersion, tintLayerStyle,
  type WallpaperDef,
} from "@/lib/wallpapers";
import { toast } from "@/lib/store";
import { THEMES, getStoredThemeId, setStoredThemeId, applyTheme } from "@/lib/themes";
import { ThemeCard } from "@/components/ThemePicker";

/* ─── Mock chat preview — wallpaper ke upar sample bubbles ─── */
function MockChat({ wpId, blur, opacity, tint, tintOpacity, customUrl }: {
  wpId: string; blur: number; opacity: number; tint: string; tintOpacity: number; customUrl: string | null;
}) {
  const bg = useMemo(() => {
    if (wpId === "custom" && customUrl) {
      return { backgroundImage: `url(${customUrl})`, backgroundSize: "cover", backgroundPosition: "center" };
    }
    return wallpaperBg(wpId);
  }, [wpId, customUrl]);
  const anim = wallpaperAnimClass(wpId);
  return (
    <div className="relative h-64 overflow-hidden rounded-2xl border border-black/10">
      {/* wallpaper layer */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${anim}`}
        style={{ ...bg, opacity: opacity / 100, filter: blur > 0 ? `blur(${blur}px)` : undefined, transform: blur > 0 ? "scale(1.1)" : undefined }}
      />
      {/* tint layer */}
      {tint && tintOpacity > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundColor: tint, opacity: tintOpacity / 100 }} />
      )}
      {/* mock messages */}
      <div className="relative flex h-full flex-col justify-end gap-2 p-3">
        <div className="max-w-[75%] self-start rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[11px] text-[#2f3035] shadow-sm">
          Assalam o Alaikum! 🌙
          <span className="ml-1.5 text-[9px] text-[#80848e]">10:24</span>
        </div>
        <div className="max-w-[75%] self-end rounded-2xl rounded-br-md bg-[#d9fdd3] px-3 py-2 text-[11px] text-[#1a2b1e] shadow-sm">
          Walaikum Assalam! Kya haal hai? 😊
          <span className="ml-1.5 text-[9px] text-[#5c7a63]">10:26 ✓✓</span>
        </div>
        <div className="max-w-[75%] self-start rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[11px] text-[#2f3035] shadow-sm">
          Alhamdulillah! Madrasa me milte hain 📚
          <span className="ml-1.5 text-[9px] text-[#80848e]">10:27</span>
        </div>
      </div>
    </div>
  );
}

const TINTS = ["#5865f2", "#23a55a", "#f5a623", "#ed4245", "#e91e63", "#9b7bff", "#00a8fc", "#0e7c5b", "#1e293b", "#ffffff"];

/* ═══════════ Preview modal ═══════════ */
function PreviewModal({ wp, chatId, chatName, onClose }: {
  wp: WallpaperDef; chatId: string | undefined; chatName: string; onClose: () => void;
}) {
  const s0 = getSettings();
  const [blur, setBlur] = useState(s0.blur);
  const [opacity, setOpacity] = useState(s0.opacity);
  const [tint, setTint] = useState(s0.tint);
  const [tintOpacity, setTintOpacity] = useState(s0.tintOpacity || 25);
  const [scope, setScope] = useState<"chat" | "all">(chatId ? "chat" : "all");
  const customUrl = getCustomWallpaper();

  const apply = () => {
    setSettings({ blur, opacity, tint, tintOpacity: tint ? tintOpacity : 0 });
    if (wp.id === "custom" && !customUrl) { toast("Pehle photo upload karo", ""); return; }
    if (scope === "all" || !chatId) {
      setAllWallpaper(wp.id);
      toast("Wallpaper lag gaya ✨", "Sab chats me");
    } else {
      setChatWallpaper(chatId, wp.id);
      toast("Wallpaper lag gaya ✨", chatName);
    }
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-[121] max-h-[92vh] w-[400px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-black/10 bg-white p-4 soft-shadow thin-scroll">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold tracking-tight text-[#2f3035]">{wp.name}</h3>
            <p className="text-xs text-[#80848e]">Preview dekho, phir lagao ✨</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
        </div>

        <MockChat wpId={wp.id} blur={blur} opacity={opacity} tint={tint} tintOpacity={tintOpacity} customUrl={customUrl} />

        {/* sliders */}
        <div className="mt-4 space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold text-[#2f3035]">
              <span>Blur</span><span className="text-[#80848e]">{blur}px</span>
            </div>
            <input type="range" min={0} max={20} value={blur} onChange={(e) => setBlur(+e.target.value)}
              className="w-full accent-[#5865f2]" aria-label="Blur" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs font-bold text-[#2f3035]">
              <span>Opacity</span><span className="text-[#80848e]">{opacity}%</span>
            </div>
            <input type="range" min={10} max={100} value={opacity} onChange={(e) => setOpacity(+e.target.value)}
              className="w-full accent-[#5865f2]" aria-label="Opacity" />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-bold text-[#2f3035]">Color tint</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setTint("")}
                title="No tint"
                className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs ${!tint ? "border-[#5865f2]" : "border-black/10"}`}
                style={{ background: "linear-gradient(135deg,#fff 50%,#f1f5f9 50%)" }}
              >✕</button>
              {TINTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTint(tint === c ? "" : c)}
                  title={c}
                  className={`h-8 w-8 rounded-full border-2 transition ${tint === c ? "scale-110 border-[#5865f2]" : "border-black/10"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            {tint && (
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-xs font-bold text-[#2f3035]">
                  <span>Tint intensity</span><span className="text-[#80848e]">{tintOpacity}%</span>
                </div>
                <input type="range" min={5} max={60} value={tintOpacity} onChange={(e) => setTintOpacity(+e.target.value)}
                  className="w-full accent-[#5865f2]" aria-label="Tint intensity" />
              </div>
            )}
          </div>
        </div>

        {/* scope */}
        {chatId && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["chat", "all"] as const).map((sc) => (
              <button
                key={sc}
                onClick={() => setScope(sc)}
                className={`rounded-xl border-2 px-3 py-2 text-xs font-bold transition ${scope === sc ? "border-[#5865f2] bg-[#5865f2]/10 text-[#5865f2]" : "border-black/10 text-[#5c5e66] hover:border-black/25"}`}
              >
                {sc === "chat" ? `Sirf ${chatName}` : "Sab chats"}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={apply}
          className="mt-4 w-full rounded-2xl bg-[#5865f2] py-3 text-sm font-extrabold text-white shadow-lg transition hover:bg-[#4752c4] active:scale-[0.98]"
        >
          <Check size={16} className="mr-1.5 inline" /> Wallpaper Lagao
        </button>
      </div>
    </>
  );
}

/* ═══════════ Main picker: [Wallpapers] + [Themes] ═══════════ */
export default function WallpaperPicker({ chatId, chatName, onClose }: {
  chatId?: string; chatName?: string; onClose: () => void;
}) {
  const [preview, setPreview] = useState<WallpaperDef | null>(null);
  const [q, setQ] = useState("");
  const [themeId, setThemeId] = useState(getStoredThemeId());
  const file = useRef<HTMLInputElement>(null);
  const current = getChatWallpaper(chatId);

  const items = useMemo(() => {
    // ONE mixed category: doodle + gradients + rang + patterns — sab shuffle
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      return ALL_WALLPAPERS.filter((w) => w.name.toLowerCase().includes(needle));
    }
    return MIXED_WALLPAPERS;
  }, [q]);

  const doRandom = () => {
    const wp = randomWallpaper();
    setPreview(wp);
  };

  const doReset = () => {
    if (chatId) clearChatWallpaper(chatId);
    else resetWallpapers();
    toast("Wallpaper reset ho gaya", "Default par wapas");
    onClose();
  };

  const selectTheme = (id: string) => {
    setThemeId(id);
    setStoredThemeId(id);
    applyTheme(id);
    const t = THEMES.find((x) => x.id === id);
    toast(`${t?.emoji || "🎨"} ${t?.name || "Theme"} lag gaya!`, "");
  };

  const pickCustom = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    try {
      const url = await new Promise<string>((res, rej) => {
        const img = new Image();
        const obj = URL.createObjectURL(f);
        img.onload = () => {
          const max = 1024;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.round(img.width * scale);
          cv.height = Math.round(img.height * scale);
          cv.getContext("2d")?.drawImage(img, 0, 0, cv.width, cv.height);
          URL.revokeObjectURL(obj);
          res(cv.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = rej;
        img.src = obj;
      });
      setCustomWallpaper(url);
      setPreview({ id: "custom", name: "Apni Photo 📤", kind: "custom", bg: "" });
      toast("Photo tayar hai", "Preview dekho!");
    } catch { toast("Photo nahi khuli", "Doosri try karo"); }
  };

  return (
    <>
      <div className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-[111] flex max-h-[90vh] w-[560px] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-black/10 bg-white soft-shadow">
        {/* header */}
        <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-[#2f3035]">Wallpapers & Themes 🎨</h2>
            <p className="text-xs text-[#80848e]">
              {chatName ? `${chatName} ke liye chuno` : "Apni pasand lagao"} · sirf owner badal sakta hai 👑
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={doRandom} title="Surprise me! 🎲"
              className="grid h-9 w-9 place-items-center rounded-full bg-[#5865f2]/10 text-[#5865f2] transition hover:bg-[#5865f2] hover:text-white active:scale-90">
              <Dices size={17} />
            </button>
            <button onClick={doReset} title="Reset to default"
              className="grid h-9 w-9 place-items-center rounded-full bg-black/5 text-[#5c5e66] transition hover:bg-black/10 active:scale-90">
              <RotateCcw size={16} />
            </button>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-[#80848e] hover:bg-black/5">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* search */}
        <div className="shrink-0 px-5 pb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Dhoondo… (jaise: gulab, doodle, eid)"
            className="w-full rounded-xl bg-black/[0.04] px-3.5 py-2 text-sm text-[#2f3035] outline-none placeholder:text-[#80848e] focus:ring-2 focus:ring-[#5865f2]/30"
          />
        </div>

        {/* scrollable: wallpapers section + themes section */}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {/* ── SECTION 1: WALLPAPERS (one mixed grid) ── */}
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#80848e]">
            🖼️ Wallpapers <span className="ml-1 font-bold normal-case tracking-normal text-[#80848e]/70">{MIXED_WALLPAPERS.length} mixed designs</span>
          </p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {/* custom upload tile */}
            <button
              onClick={() => file.current?.click()}
              className="group relative flex aspect-[4/5] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border-2 border-dashed border-[#5865f2]/40 bg-[#5865f2]/[0.04] transition hover:border-[#5865f2] hover:bg-[#5865f2]/[0.08]"
            >
              <ImagePlus size={26} className="text-[#5865f2]" />
              <span className="px-1 text-center text-[10px] font-bold text-[#5865f2]">Apni photo lagao</span>
            </button>
            {getCustomWallpaper() && (
              <button
                onClick={() => setPreview({ id: "custom", name: "Apni Photo 📤", kind: "custom", bg: "" })}
                className={`relative aspect-[4/5] overflow-hidden rounded-2xl border-2 transition ${current === "custom" ? "border-[#5865f2]" : "border-black/10 hover:border-black/30 hover:shadow-md"}`}
                style={wallpaperTileStyle("custom")}
              >
                {current === "custom" && (
                  <span className="absolute inset-0 grid place-items-center bg-[#5865f2]/30"><Check size={20} className="text-white" /></span>
                )}
                <span className="absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/45 px-1 py-0.5 text-center text-[9px] font-bold text-white">Apni Photo</span>
              </button>
            )}
            {items.filter((w) => w.kind !== "custom").map((w) => {
              const active = current === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setPreview(w)}
                  title={w.name}
                  className={`group relative aspect-[4/5] overflow-hidden rounded-2xl border-2 transition hover:shadow-md ${active ? "border-[#5865f2] shadow-md" : "border-black/10 hover:border-black/30"}`}
                  style={wallpaperTileStyle(w.id)}
                >
                  {w.anim && (
                    <span className="absolute right-1 top-1 rounded-full bg-black/40 p-1"><Sparkles size={10} className="text-white" /></span>
                  )}
                  {active && (
                    <span className="absolute inset-0 grid place-items-center bg-[#5865f2]/30"><Check size={20} className="text-white drop-shadow" /></span>
                  )}
                  <span className="absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/45 px-1 py-0.5 text-center text-[9px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                    {w.name}
                  </span>
                </button>
              );
            })}
          </div>

          {items.length === 0 && (
            <div className="flex items-center justify-center p-8 text-sm text-[#80848e]">Kuch nahi mila</div>
          )}

          {/* ── SECTION 2: THEMES ── */}
          <p className="mb-2 mt-6 text-xs font-extrabold uppercase tracking-[0.08em] text-[#80848e]">
            ⚡ Themes <span className="ml-1 font-bold normal-case tracking-normal text-[#80848e]/70">{THEMES.length} AI designs</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            {THEMES.map((t) => (
              <ThemeCard key={t.id} theme={t} active={themeId === t.id} onSelect={() => selectTheme(t.id)} />
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-[#80848e]">
            Theme poori app ka rang badal deta hai — bubbles, header, sab kuch! ✨
          </p>
        </div>

        <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pickCustom(e.target.files?.[0])} />
      </div>

      {preview && (
        <PreviewModal wp={preview} chatId={chatId} chatName={chatName || "is chat"} onClose={() => setPreview(null)} />
      )}
    </>
  );
}

/* ─── chota trigger button (settings me use karo) ─── */
export function WallpaperButton({ chatId, chatName }: { chatId?: string; chatName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-[#5865f2]/10 px-3.5 py-2.5 text-sm font-bold text-[#5865f2] transition hover:bg-[#5865f2] hover:text-white active:scale-95"
      >
        <Upload size={15} /> Wallpapers & Themes
      </button>
      {open && <WallpaperPicker chatId={chatId} chatName={chatName} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ─── Chat header quick button (per-chat wallpaper) ─── */
export function ChatWallpaperBtn({ chatId, chatName }: { chatId?: string; chatName?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-[#5c5e66] transition hover:bg-black/5 hover:text-[#5865f2]"
        aria-label="Chat wallpaper"
        title="Is chat ka wallpaper badlo 🎨"
      >
        <ImagePlus size={20} />
      </button>
      {open && <WallpaperPicker chatId={chatId} chatName={chatName} onClose={() => setOpen(false)} />}
    </>
  );
}

/* ─── Chat background layers: wallpaper + tint (ChatView me use hota hai) ─── */
export function WallpaperLayers({ chatId }: { chatId: string | undefined }) {
  useWallpaperVersion(); // reactive: koi bhi wallpaper change ho to rerender
  const id = getChatWallpaper(chatId);
  const s = getSettings();
  const bg = wallpaperBg(id);
  const anim = wallpaperAnimClass(id);
  const tint = tintLayerStyle();
  // default (plain white) par koi layer nahi
  if (id === "m-white" && s.blur === 0 && !tint) return null;
  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${anim}`}
        style={{
          ...bg,
          opacity: s.opacity / 100,
          filter: s.blur > 0 ? `blur(${s.blur}px)` : undefined,
          transform: s.blur > 0 ? "scale(1.1)" : undefined,
        }}
      />
      {tint && (
        <div aria-hidden className="pointer-events-none absolute inset-0" style={tint} />
      )}
    </>
  );
}
