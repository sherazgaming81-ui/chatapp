"use client";
// AI Theme Picker — 13 AI-generated themes + Classic. Live previews!
import { useState } from "react";
import { Check, Palette, Sparkles } from "lucide-react";
import { THEMES, getStoredThemeId, setStoredThemeId, applyTheme, type Theme } from "@/lib/themes";

function ThemeCard({ theme, active, onSelect }: { theme: Theme; active: boolean; onSelect: () => void }) {
  const p = theme.palette;
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
            boxShadow: (p as any).headerShadow || undefined,
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
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug" style={{ color: p.textMuted }}>
          {theme.tagline}
        </p>
      </div>
    </button>
  );
}

export default function ThemePicker({ onClose }: { onClose?: () => void }) {
  const [current, setCurrent] = useState(getStoredThemeId());

  const select = (id: string) => {
    setCurrent(id);
    setStoredThemeId(id);
    applyTheme(id);
  };

  const activeTheme = THEMES.find((t) => t.id === current);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500">
          <Sparkles size={18} className="text-white" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[#2f3035]">AI Themes ⚡</h3>
          <p className="text-[11px] text-[#80848e]">
            {THEMES.length} themes — Claude, DeepSeek & ChatGPT designs!
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="thin-scroll grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-4">
        {THEMES.map((t) => (
          <ThemeCard key={t.id} theme={t} active={current === t.id} onSelect={() => select(t.id)} />
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-black/5 px-4 py-2.5 text-center">
        <p className="text-[11px] text-[#80848e]">
          {activeTheme?.emoji} <b>{activeTheme?.name}</b> active hai
        </p>
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

// Re-export for settings
export { Palette };
