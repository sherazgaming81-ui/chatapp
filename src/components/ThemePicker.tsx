"use client";
// AI Theme Picker — 13 AI-generated themes + Classic. Live previews!
// PER-CHAT themes: har chat ka apna theme, Supabase realtime se sab ko sync.
import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Dices, Palette, Search, Sparkles, Star, Trophy, X, RotateCcw, SlidersHorizontal } from "lucide-react";
import { THEMES, getTheme, type Theme } from "@/lib/themes";
import {
  getChatThemeId, setChatTheme, loadChatTheme, useChatThemeVersion, themeCssVars,
  trackThemeUsage, getThemeUsage, getPopularThemeIds,
} from "@/lib/chatTheme";
import {
  getThemeOfTheDay, getEffectivePalette, getBubbleOverride, setBubbleOverride,
  resetBubbleOverride, hasBubbleOverride, useThemePrefsVersion, type BubbleOverride,
} from "@/lib/themePrefs";
import {
  useThemeMetaVersion, getFavThemes, isFavTheme, toggleFavTheme,
  getRecentThemes, pushRecentTheme,
} from "@/lib/themeMeta";
import { toast, getState } from "@/lib/store";

export function ThemeCard({ theme, active, onSelect, usage }: { theme: Theme; active: boolean; onSelect: () => void; usage?: number }) {
  useThemePrefsVersion();
  useThemeMetaVersion();
  const fav = isFavTheme(theme.id);
  // Feature 15 🌈 — active theme par bubble overrides preview me bhi dikhao
  const p = active ? getEffectivePalette(theme.id) : theme.palette;
  const previewBg = theme.previewBg || p.bgGradient;
  return (
    <button
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98] ${
        active ? "shadow-lg" : "border-black/10 hover:border-black/20"
      }`}
      style={active ? { borderColor: p.accent } : undefined}
    >
      {/* Preview — mini chat mockup with theme's real styling */}
      <div className="relative h-32 p-2.5" style={{ background: previewBg }}>
        {/* mini header */}
        <div
          className="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5"
          style={{
            background: p.header,
            border: `1px solid ${p.border}`,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            className="h-5 w-5 rounded-full"
            style={{ background: p.accent, boxShadow: `0 0 8px ${p.glow || p.accent}` }}
          />
          <div>
            <div
              className="text-[10px] font-bold leading-none"
              style={{
                color: p.textPrimary,
                fontFamily: theme.fontFamily || "inherit",
                fontStyle: theme.bubbleFontStyle || "normal",
              }}
            >
              Madrasa Group
            </div>
            <div className="text-[8px] leading-none mt-0.5" style={{ color: p.textMuted }}>
              5 online
            </div>
          </div>
        </div>
        {/* own bubble */}
        <div className="flex justify-end">
          <div
            className="mb-1.5 max-w-[70%] px-2 py-1"
            style={{
              background: p.bubbleOwn,
              borderRadius: p.bubbleOwnRadius || "12px 4px 12px 12px",
              border: p.bubbleOwnBorder || "none",
              boxShadow: p.bubbleOwnShadow || "none",
            }}
          >
            <div
              className="text-[9px] leading-tight"
              style={{
                color: p.bubbleOwnText,
                fontFamily: theme.fontFamily || "inherit",
                fontStyle: theme.bubbleFontStyle || "normal",
                fontWeight: 600,
              }}
            >
              Ye theme kamaal hai! 🔥
            </div>
          </div>
        </div>
        {/* other bubble */}
        <div className="flex justify-start">
          <div
            className="max-w-[60%] px-2 py-1"
            style={{
              background: p.bubbleOther,
              borderRadius: p.bubbleOtherRadius || "4px 12px 12px 12px",
              border: p.bubbleOtherBorder || "none",
              boxShadow: p.bubbleOtherShadow || "none",
            }}
          >
            <div
              className="text-[9px] leading-tight"
              style={{
                color: p.bubbleOtherText,
                fontFamily: theme.fontFamily || "inherit",
                fontStyle: theme.bubbleFontStyle || "normal",
                fontWeight: 600,
              }}
            >
              Mashallah! 🕌
            </div>
          </div>
        </div>
        {/* usage badge — Feature 16 📊 */}
        {usage != null && usage > 0 && (
          <div
            className="absolute bottom-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            title={`${usage} dafa lagaya`}
          >
            🔥 {usage}x
          </div>
        )}
        {/* active check */}
        {active && (
          <div
            className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-white shadow"
            style={{ background: p.accent }}
          >
            <Check size={14} strokeWidth={3} />
          </div>
        )}
        {/* tag badge */}
        {theme.tag && (
          <div
            className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-bold tracking-wide"
            style={{ background: "rgba(0,0,0,0.5)", color: "#fff", backdropFilter: "blur(4px)" }}
          >
            {theme.tag}
          </div>
        )}
      </div>
      {/* Info */}
      <div className="px-3 py-2.5" style={{ background: p.surface }}>
        <div className="flex items-center gap-1.5">
          <span className="text-base">{theme.emoji}</span>
          <span
            className="text-[13px] font-bold"
            style={{
              color: p.textPrimary,
              fontFamily: theme.fontFamily || "inherit",
            }}
          >
            {theme.name}
          </span>
          {theme.urdu && (
            <span className="text-[11px]" style={{ color: p.textMuted }}>
              {theme.urdu}
            </span>
          )}
          {/* ⭐ Favorite toggle */}
          <span
            role="button"
            aria-label={fav ? "Unfavorite" : "Favorite"}
            title={fav ? "Favorite se hatao" : "Favorite banao ⭐"}
            onClick={(e) => {
              e.stopPropagation();
              const next = toggleFavTheme(theme.id);
              toast(
                next.includes(theme.id) ? `⭐ ${theme.name} favorite!` : `⭐ ${theme.name} hata diya`,
                next.includes(theme.id) ? "Favorites me sab se upar milegi" : ""
              );
            }}
            className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full transition hover:bg-black/10 active:scale-90"
          >
            <Star
              size={15}
              className={fav ? "fill-amber-400 text-amber-400" : "text-[#80848e]"}
            />
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug" style={{ color: p.textMuted }}>
          {theme.tagline}
        </p>
      </div>
    </button>
  );
}

/* ─── Feature 15 🌈 — Bubble color customize panel (active theme ke liye) ─── */
function CustomizePanel({ themeId }: { themeId: string }) {
  useThemePrefsVersion();
  const theme = getTheme(themeId);
  const p = theme.palette;
  const ov = getBubbleOverride(themeId);
  const [open, setOpen] = useState(false);

  const rows: { key: keyof BubbleOverride; label: string; fallback: string }[] = [
    { key: "own", label: "Mera bubble", fallback: p.bubbleOwn },
    { key: "ownText", label: "Mera text", fallback: p.bubbleOwnText },
    { key: "other", label: "Uska bubble", fallback: p.bubbleOther },
    { key: "otherText", label: "Uska text", fallback: p.bubbleOtherText },
  ];

  // hex na ho (gradient waghera) to color input ke liye safe default
  const toHex = (v: string, fb: string) =>
    /^#[0-9a-fA-F]{6}$/.test(v) ? v : /^#[0-9a-fA-F]{6}$/.test(fb) ? fb : "#5865f2";

  return (
    <div className="mt-2 rounded-2xl border border-black/10 bg-black/[0.02] p-2.5 text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-1 py-1 text-[13px] font-bold text-[#2f3035]"
      >
        <SlidersHorizontal size={15} className="text-[#5865f2]" />
        🎨 Bubble colors customize karo
        {hasBubbleOverride(themeId) && (
          <span className="rounded-full bg-[#5865f2]/10 px-2 py-0.5 text-[10px] font-bold text-[#5865f2]">
            custom!
          </span>
        )}
        <span className="ml-auto text-[11px] text-[#80848e]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-2">
          <div className="grid grid-cols-2 gap-2">
            {rows.map((r) => (
              <label key={r.key} className="flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm">
                <input
                  type="color"
                  value={toHex(ov[r.key] || "", r.fallback)}
                  onChange={(e) => setBubbleOverride(themeId, { [r.key]: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded-lg border border-black/10 bg-transparent p-0.5"
                />
                <span className="text-[11px] font-bold text-[#5c5e66]">{r.label}</span>
              </label>
            ))}
          </div>
          {/* live preview */}
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl p-2" style={{ background: theme.previewBg || p.bgGradient }}>
            <span
              className="max-w-[45%] truncate px-2.5 py-1.5 text-[11px] font-semibold"
              style={{
                background: ov.other || p.bubbleOther,
                color: ov.otherText || p.bubbleOtherText,
                borderRadius: p.bubbleOtherRadius || "4px 12px 12px 12px",
              }}
            >
              Salam! 👋
            </span>
            <span
              className="max-w-[45%] truncate px-2.5 py-1.5 text-[11px] font-semibold"
              style={{
                background: ov.own || p.bubbleOwn,
                color: ov.ownText || p.bubbleOwnText,
                borderRadius: p.bubbleOwnRadius || "12px 4px 12px 12px",
              }}
            >
              Walaikum Salam! 🔥
            </span>
          </div>
          <button
            onClick={() => { resetBubbleOverride(themeId); toast("Reset ho gaya! ✨", `${theme.emoji} ${theme.name} wapas original`); }}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-black/[0.04] py-2 text-[12px] font-bold text-[#5c5e66] transition hover:bg-black/[0.07] active:scale-[0.98]"
          >
            <RotateCcw size={13} /> Original wapas lao
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Per-chat theme picker (chatId required) ─── */
export default function ThemePicker({ chatId, chatName, isDM, onClose }: { chatId?: string; chatName?: string; isDM?: boolean; onClose?: () => void }) {
  useChatThemeVersion();
  useThemeMetaVersion();
  const current = getChatThemeId(chatId);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  // Chat khulne par theme load karo (DM: local only, Group: Supabase)
  useEffect(() => {
    if (chatId) loadChatTheme(chatId);
  }, [chatId]);

  const select = async (id: string, silent?: boolean) => {
    if (!chatId || saving || id === current) return;
    setSaving(true);
    const ok = await setChatTheme(chatId, id);
    setSaving(false);
    const t = getTheme(id);
    trackThemeUsage(id); // Feature 16 📊 — har theme apply par count
    pushRecentTheme(id); // 🕐 recents me track karo
    if (silent) return;
    if (isDM) toast(`${t.emoji} ${t.name} lag gaya!`, "Sirf tumhe dikhega ✨");
    else if (ok) {
      toast(`${t.emoji} ${t.name} lag gaya!`, "Sab members ko foran dikhega ✨");
      // Feature 17 🔔 — group me system message: sab ko pata chale
      try {
        const s = getState();
        const myName = s.members.find((m: any) => m.id === s.me)?.name || "Owner";
        const { postSystem } = await import("@/lib/db");
        await postSystem(chatId, `🎨 ${myName} ne theme badal di: ${t.emoji} ${t.name} ✨`);
      } catch { /* ignore */ }
    }
    else toast(`${t.emoji} ${t.name} lag gaya!`, "Is device par save hua ✨");
  };

  /* 🎲 Random theme — 13 AI themes me se (default nahi) */
  const randomTheme = async () => {
    const pool = THEMES.filter((t) => t.id !== "default" && t.id !== current);
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    await select(pick.id, true);
    const t = getTheme(pick.id);
    if (isDM) toast(`🎲 Random theme: ${t.emoji} ${t.name}!`, "Sirf tumhe dikhega ✨");
    else toast(`🎲 Random theme: ${t.emoji} ${t.name}!`, "Sab members ko foran dikhega ✨");
  };

  const activeTheme = getTheme(current);
  const usage = getThemeUsage();
  const popularIds = getPopularThemeIds(6);
  const favIds = getFavThemes();
  const recentIds = getRecentThemes();

  /* 🔍 Search — naam + urdu naam se filter */
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? THEMES.filter((t) => t.name.toLowerCase().includes(q) || (t.urdu || "").includes(query.trim()) || (t.tagline || "").toLowerCase().includes(q)) : THEMES),
    [q, query]
  );
  const showSections = !q;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500">
          <Sparkles size={18} className="text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-[#2f3035]">Chat Themes 🎨</h3>
          <p className="truncate text-[11px] text-[#80848e]">
            {chatName ? `${chatName} ke liye` : `${THEMES.length} themes`} — {isDM ? "sirf tumhe dikhega!" : "sab ko foran dikhega!"}
          </p>
        </div>
        {/* 🎲 Random */}
        <button
          onClick={randomTheme}
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow transition hover:scale-105 active:scale-95"
          aria-label="Random theme"
          title="🎲 Random theme!"
        >
          <Dices size={17} />
        </button>
        {onClose && (
          <button onClick={onClose} className="rounded-full p-1.5 text-[#5c5e66] hover:bg-black/5" aria-label="Band">
            <X size={18} />
          </button>
        )}
      </div>

      {/* 🔍 Search */}
      <div className="shrink-0 px-4 pt-3">
        <div className="flex items-center gap-2 rounded-xl bg-black/[0.04] px-3 py-2">
          <Search size={15} className="shrink-0 text-[#80848e]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Theme dhoondo… (jaise: sakura, lime)"
            className="w-full bg-transparent text-[13px] text-[#2f3035] outline-none placeholder:text-[#80848e]"
          />
          {query && (
            <button onClick={() => setQuery("")} className="shrink-0 rounded-full p-0.5 text-[#80848e] hover:bg-black/10" aria-label="Saaf">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Feature 10 🏆 — Theme of the Day (deterministic, roz aik) */}
      {(() => {
        const tod = getThemeOfTheDay();
        const tp = tod.palette;
        return (
          <button
            onClick={() => select(tod.id)}
            className="mx-4 mt-3 flex shrink-0 items-center gap-3 overflow-hidden rounded-2xl border-2 border-amber-400/60 p-2.5 text-left shadow-sm transition hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: tod.previewBg || tp.bgGradient }}
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-black/30 text-xl backdrop-blur-sm">
              🏆
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: tp.textMuted }}>
                Aaj ki theme
              </p>
              <p className="truncate text-[14px] font-bold" style={{ color: tp.textPrimary, fontFamily: tod.fontFamily || "inherit" }}>
                {tod.emoji} {tod.name}
              </p>
              <p className="truncate text-[11px]" style={{ color: tp.textMuted }}>
                {current === tod.id ? "✓ Lagayi hui hai!" : "Tap karo — foran lagao! ✨"}
              </p>
            </div>
            <Trophy size={20} className="shrink-0 text-amber-400" />
          </button>
        );
      })()}

      {/* Feature 16 📊 — Popular section (sab se zyada use hui themes) */}
      {popularIds.length > 0 && (
        <div className="shrink-0 border-b border-black/10 px-4 pb-3 pt-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">
            📊 Popular — tumhari favorite
          </p>
          <div className="thin-scroll flex gap-3 overflow-x-auto pb-1">
            {popularIds.map((pid) => {
              const pt = getTheme(pid);
              if (!pt) return null;
              return (
                <div key={pid} className="w-36 shrink-0">
                  <ThemeCard theme={pt} active={current === pid} onSelect={() => select(pid)} usage={usage[pid] || 0} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ⭐ Favorites — sab se upar */}
      {showSections && favIds.length > 0 && (
        <div className="shrink-0 border-b border-black/10 px-4 pb-3 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">
            <Star size={13} className="fill-amber-400 text-amber-400" /> Favorites
          </p>
          <div className="thin-scroll flex gap-3 overflow-x-auto pb-1">
            {favIds.map((fid) => {
              const ft = getTheme(fid);
              if (!ft) return null;
              return (
                <div key={fid} className="w-36 shrink-0">
                  <ThemeCard theme={ft} active={current === fid} onSelect={() => select(fid)} usage={usage[fid] || 0} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 🕐 Recent — haal me use ki hui */}
      {showSections && recentIds.length > 0 && (
        <div className="shrink-0 border-b border-black/10 px-4 pb-3 pt-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">
            <Clock size={13} className="text-[#5865f2]" /> Recent
          </p>
          <div className="thin-scroll flex gap-3 overflow-x-auto pb-1">
            {recentIds.map((rid) => {
              const rt = getTheme(rid);
              if (!rt) return null;
              return (
                <div key={rid} className="w-36 shrink-0">
                  <ThemeCard theme={rt} active={current === rid} onSelect={() => select(rid)} usage={usage[rid] || 0} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="thin-scroll grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <p className="col-span-2 py-8 text-center text-[13px] text-[#80848e]">
            🔍 "{query}" ke liye koi theme nahi mili
          </p>
        ) : (
          filtered.map((t) => (
            <ThemeCard key={t.id} theme={t} active={current === t.id} onSelect={() => select(t.id)} usage={usage[t.id] || 0} />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-black/5 px-4 py-2.5 text-center">
        <p className="text-[11px] text-[#80848e]">
          {activeTheme?.emoji} <b>{activeTheme?.name}</b> active hai{saving ? " — save ho raha…" : ""}
        </p>
        {/* Feature 15 🌈 — bubble colors */}
        <CustomizePanel themeId={current} />
        {onClose && (
          <button
            onClick={onClose}
            className="mt-1.5 rounded-full bg-[#5865f2] px-6 py-1.5 text-[13px] font-bold text-white transition hover:bg-[#4752c4] active:scale-95"
          >
            Ho gaya!
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Chat header button: theme picker kholo (group: owner-only, DM: dono) ─── */
export function ChatThemeBtn({ chatId, chatName, isDM }: { chatId?: string; chatName?: string; isDM?: boolean }) {
  const [open, setOpen] = useState(false);
  useChatThemeVersion();
  const themeId = getChatThemeId(chatId);
  const theme = getTheme(themeId);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-[#5c5e66] transition hover:bg-black/5 hover:text-[#5865f2]"
        aria-label="Chat theme"
        title={`Theme: ${theme.name} 🎨`}
      >
        <Palette size={20} />
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <ThemePicker chatId={chatId} chatName={chatName} isDM={isDM} onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Chat background layers: theme ka full visual (wallpaper ki jagah) ─── */
export function ThemeLayers({ chatId }: { chatId: string | undefined }) {
  useChatThemeVersion();
  const themeId = getChatThemeId(chatId);
  const theme = getTheme(themeId);
  // Default theme par koi layer nahi (plain app bg)
  if (themeId === "default") return null;
  const bg = theme.previewBg || theme.palette.bgGradient;
  return (
    <div
      aria-hidden
      className="chat-bg pointer-events-none absolute inset-0"
      style={{ background: bg }}
    />
  );
}

/** Chat container ke liye theme vars + data attribute */
export function useChatThemeAttrs(chatId: string | undefined) {
  useChatThemeVersion();
  useThemePrefsVersion(); // Feature 15 🌈 — bubble overrides badalne par foran update
  const themeId = getChatThemeId(chatId);
  return {
    "data-chat-theme": themeId,
    style: themeCssVars(themeId) as React.CSSProperties,
  };
}

// Re-export for settings
export { Palette };
