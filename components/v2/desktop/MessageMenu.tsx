'use client';

/**
 * MessageMenu — message par right-click / long-press ka premium menu.
 * Icon chips · grouped actions · smooth entrance · Esc se band.
 */

import { useEffect } from 'react';
import { Icon, ICONS, Popover } from './common';

export interface MenuAction {
  id: string;
  label: string;
  sub?: string;
  icon: string;
  /** chip ka rang (default: muted) */
  tint?: string;
  danger?: boolean;
  dividerAfter?: boolean;
}

interface Props {
  actions: MenuAction[];
  mine: boolean;
  onPick(id: string): void;
  onClose(): void;
}

export default function MessageMenu({ actions, mine, onPick, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Popover
      onClose={onClose}
      className={`${mine ? 'right-0' : 'left-0'} top-8 !min-w-[248px] !max-w-[280px] !py-2 !rounded-2xl overflow-hidden`}
    >
      {actions.map((a) => (
        <div key={a.id}>
          <button
            onClick={() => onPick(a.id)}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition group ${
              a.danger
                ? 'text-[#ea0038] hover:bg-[#ea0038]/[0.07]'
                : 'text-[var(--v2-text)] hover:bg-[var(--v2-hover)]'
            }`}
          >
            <span
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
              style={{
                background: a.danger ? 'rgba(234,0,56,.1)' : `${a.tint ?? 'var(--v2-muted)'}1a`,
                color: a.danger ? '#ea0038' : a.tint ?? 'var(--v2-muted)',
              }}
            >
              <Icon d={ICONS[a.icon as keyof typeof ICONS]} size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium leading-tight">{a.label}</span>
              {a.sub && (
                <span className="block text-[11.5px] text-[var(--v2-muted)] leading-tight mt-0.5">{a.sub}</span>
              )}
            </span>
          </button>
          {a.dividerAfter && <div className="mx-3.5 my-1 border-t border-[var(--v2-border)]" />}
        </div>
      ))}
    </Popover>
  );
}
