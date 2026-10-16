"use client";
// Premium Theme Picker — live preview cards, Claude-level polish!
import { useState } from "react";
import { Check, Palette } from "lucide-react";
import { THEMES, getStoredThemeId, setStoredThemeId, applyTheme, type Theme } from "@/lib/themes";

function ThemeCard({ theme, active, onSelect }: { theme: Theme; active: boolean; onSelect: () => void }) {
  const p = theme.palette;
  return (
    <button
      onClick={onSelect}
      className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] ${
        active ? "border-current shadow-lg" : "border-black/10 hover:border-black/20"
      }`}
      style={active ? { borderColor: p.accent } : undefined}
    >
      {/* Preview — mini chat mockup */}
      <div className="relative h-28 p-2.5" style={{ background: p.bgGradient }}>
        {/* mini header */}
        <div className="mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1" style={{ background: p.header }}>
          <div className="h-4 w-4 rounded-full" style={{ background: p.accent }} />
          <div className="h-2 w-16 rounded-full" style={{ background: p.textMuted, opacity: 0.4 }} />
        </div>
        {/* mini bubbles */}
        <div className="flex justify-end">
          <div className="mb-1.5 max-w-[70%] rounded-lg rounded-br-sm px-2 py-1" style={{ background: p.bubbleOwn }}>
            <div className="h-1.5 w-14 rounded-full" style={{ background: p.bubbleOwnText, opacity: 0.35 }} />
          </div>
        </div>
        <div className="flex justify-start">
          <div className="max-w-[60%] rounded-lg rounded-bl-sm px-2 py-1" style={{ background: p.bubbleOther, border: `1px solid ${p.border}` }}>
            <div className="h-1.5 w-10 rounded-full" style={{ background: p.bubbleOtherText, opacity: 0.35 }} />
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
      </div>
      {/* Info */}
      <div className="bg-white px-3 py-2.5 dark:bg-black/20" style={{ background: p.surface }}>
        <div className="flex items-center gap-1.5">
          <span className="text-base">{theme.emoji}</span>
          <span className="text-[13px] font-bold" style={{ color: p.textPrimary }}>{theme.name}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px]" style={{ color: p.textMuted }}>{theme.tagline}</p>
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-black/10 px-4 py-3">
        <Palette size={18} className="text-[#5865f2]" />
        <div>
          <h3 className="text-sm font-bold text-[#2f3035]">Themes</h3>
          <p className="text-[11px] text-[#80848e]">Apni pasand ka look chuno ✨</p>
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
          {THEMES.find((t) => t.id === current)?.emoji} {THEMES.find((t) => t.id === current)?.name} active hai
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
