'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { tapHaptic } from '../shared/haptics';

type Tool = 'none' | 'crop' | 'text' | 'doodle';

interface StrokeOp { kind: 'stroke'; points: { x: number; y: number }[]; color: string; wFrac: number }
interface TextOp { kind: 'text'; x: number; y: number; text: string; color: string; sizeFrac: number }
type Op = StrokeOp | TextOp;

const PALETTE = ['#ffffff', '#111111', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#0a84ff', '#ff2d92'];
const BRUSHES = [
  { id: 's', wFrac: 0.006, label: 'Patla' },
  { id: 'm', wFrac: 0.012, label: 'Darmiyana' },
  { id: 'l', wFrac: 0.022, label: 'Mota' },
];
const RATIOS: { id: string; label: string; r: number | null }[] = [
  { id: 'free', label: 'Free', r: null },
  { id: '11', label: '1:1', r: 1 },
  { id: '43', label: '4:3', r: 4 / 3 },
  { id: '34', label: '3:4', r: 3 / 4 },
  { id: '169', label: '16:9', r: 16 / 9 },
];

/** Rotated image ko capped resolution par canvas me render karein */
function renderBase(img: HTMLImageElement, rotation: number): HTMLCanvasElement {
  const rot = ((rotation % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const w = swap ? nh : nw, h = swap ? nw : nh;
  const scale = Math.min(1, 1600 / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d')!;
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, (-nw * scale) / 2, (-nh * scale) / 2, nw * scale, nh * scale);
  return c;
}

/**
 * PhotoEditor — WhatsApp-style photo editor: crop (ratio + pan), rotate,
 * text, doodle, undo, caption. Bhejne se pehle photo taiyaar karein.
 */
export default function PhotoEditor({
  file,
  initialCaption = '',
  onClose,
  onSend,
}: {
  file: File;
  initialCaption?: string;
  onClose: () => void;
  onSend: (file: File, caption: string) => void;
}) {
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [tool, setTool] = useState<Tool>('none');
  const [ratioId, setRatioId] = useState('free');
  const [pan, setPan] = useState({ x: 0.5, y: 0.5 });
  const [ops, setOps] = useState<Op[]>([]);
  const [color, setColor] = useState('#ffffff');
  const [brush, setBrush] = useState(BRUSHES[1]);
  const [caption, setCaption] = useState(initialCaption);
  const [sending, setSending] = useState(false);
  const [pendingText, setPendingText] = useState<{ x: number; y: number; v: string } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const dragRef = useRef<null | { kind: 'stroke'; pts: { x: number; y: number }[] } | { kind: 'pan'; sx: number; sy: number; ox: number; oy: number } | { kind: 'text'; idx: number; dx: number; dy: number }>(null);

  // image load + rotate
  useEffect(() => {
    let alive = true;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      setBase(renderBase(img, rotation));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { if (alive) onClose(); };
    img.src = url;
    return () => { alive = false; URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, rotation]);

  // stage measure
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStage({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setStage({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const cw = base?.width || 1, ch = base?.height || 1;
  const dScale = Math.min(stage.w / cw || 0, stage.h / ch || 0);
  const dw = Math.max(1, Math.floor(cw * dScale)), dh = Math.max(1, Math.floor(ch * dScale));

  const ratio = RATIOS.find((r) => r.id === ratioId)?.r ?? null;
  const crop = (() => {
    if (!ratio) return { x: 0, y: 0, w: cw, h: ch };
    let w = cw, h = cw / ratio;
    if (h > ch) { h = ch; w = ch * ratio; }
    const sx = cw - w, sy = ch - h;
    return { x: pan.x * sx, y: pan.y * sy, w, h };
  })();

  const toLocal = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * cw, y: ((clientY - r.top) / r.height) * ch };
  };

  const undo = () => { setOps((o) => o.slice(0, -1)); tapHaptic(); };
  const rotate = () => { setRotation((r) => (r + 90) % 360); setOps([]); setPan({ x: 0.5, y: 0.5 }); tapHaptic(); };

  const onSvgDown = (e: React.PointerEvent) => {
    if (!base) return;
    const p = toLocal(e.clientX, e.clientY);
    if (tool === 'doodle') {
      dragRef.current = { kind: 'stroke', pts: [p] };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (tool === 'crop' && ratio) {
      dragRef.current = { kind: 'pan', sx: p.x, sy: p.y, ox: pan.x, oy: pan.y };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } else if (tool === 'text') {
      setPendingText({ x: p.x, y: p.y, v: '' });
    }
  };
  const onSvgMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const p = toLocal(e.clientX, e.clientY);
    if (d.kind === 'stroke') {
      d.pts.push(p);
      setOps((o) => {
        const live: StrokeOp = { kind: 'stroke', points: d.pts, color, wFrac: brush.wFrac };
        // live stroke ko aakhri op ki tarah dikhayein
        const rest = o.filter((x) => !(x as StrokeOp & { __live?: boolean }).__live);
        return [...rest, Object.assign(live, { __live: true })];
      });
    } else if (d.kind === 'pan') {
      const sx = cw - crop.w || 1, sy = ch - crop.h || 1;
      setPan({
        x: Math.min(1, Math.max(0, d.ox + (p.x - d.sx) / sx)),
        y: Math.min(1, Math.max(0, d.oy + (p.y - d.sy) / sy)),
      });
    } else if (d.kind === 'text') {
      setOps((o) => o.map((op, i) => (i === d.idx && op.kind === 'text' ? { ...op, x: p.x - d.dx, y: p.y - d.dy } : op)));
    }
  };
  const onSvgUp = () => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d?.kind === 'stroke') {
      setOps((o) => {
        const clean = o.map((x) => { const { __live, ...rest } = x as StrokeOp & { __live?: boolean }; void __live; return rest as Op; });
        const last = clean[clean.length - 1];
        if (last && last.kind === 'stroke' && last.points.length >= 1) return clean;
        return clean.slice(0, -1);
      });
      tapHaptic();
    }
  };

  const startTextDrag = (e: React.PointerEvent, idx: number) => {
    if (tool === 'doodle') return;
    e.stopPropagation();
    const p = toLocal(e.clientX, e.clientY);
    const op = ops[idx] as TextOp;
    dragRef.current = { kind: 'text', idx, dx: p.x - op.x, dy: p.y - op.y };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const confirmText = () => {
    if (pendingText && pendingText.v.trim()) {
      setOps((o) => [...o, { kind: 'text', x: pendingText.x, y: pendingText.y, text: pendingText.v.trim(), color, sizeFrac: 0.055 }]);
      tapHaptic();
    }
    setPendingText(null);
  };

  const doSend = useCallback(() => {
    if (!base || sending) return;
    setSending(true);
    try {
      const out = document.createElement('canvas');
      out.width = Math.round(crop.w); out.height = Math.round(crop.h);
      const ctx = out.getContext('2d')!;
      ctx.drawImage(base, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);
      // strokes + texts (base coords -> crop coords)
      for (const op of ops) {
        if (op.kind === 'stroke') {
          if (op.points.length === 0) continue;
          ctx.strokeStyle = op.color;
          ctx.lineWidth = Math.max(1, op.wFrac * cw);
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath();
          op.points.forEach((p, i) => {
            const x = p.x - crop.x, y = p.y - crop.y;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.stroke();
        } else {
          const fs = op.sizeFrac * cw;
          ctx.font = `600 ${fs}px system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = Math.max(1, fs * 0.12);
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.fillStyle = op.color;
          const x = op.x - crop.x, y = op.y - crop.y;
          ctx.strokeText(op.text, x, y);
          ctx.fillText(op.text, x, y);
        }
      }
      out.toBlob((blob) => {
        setSending(false);
        if (!blob) { onClose(); return; }
        onSend(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }), caption.trim());
      }, 'image/jpeg', 0.9);
    } catch {
      setSending(false);
      onClose();
    }
  }, [base, crop, ops, cw, caption, sending, onSend, onClose]);

  const toolBtn = (id: Tool, label: string, icon: React.ReactNode) => (
    <button
      onClick={() => { setTool((t) => (t === id ? 'none' : id)); setPendingText(null); tapHaptic(); }}
      className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[64px] transition-colors ${tool === id ? 'bg-[var(--mv2-accent)] text-white' : 'text-white/70 active:bg-white/10'}`}
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-black flex flex-col mv2-fade-anim select-none">
      {/* top bar */}
      <div className="flex items-center justify-between px-2 pt-3 pb-2 mv2-safe-top">
        <button onClick={onClose} aria-label="Band karein" className="w-11 h-11 flex items-center justify-center text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={undo} disabled={ops.length === 0} aria-label="Undo" className="w-11 h-11 flex items-center justify-center text-white disabled:opacity-30">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 5L3 10l5 5M3 10h11a6 6 0 0 1 0 12h-2" /></svg>
          </button>
          <button onClick={rotate} aria-label="Ghumayein" className="w-11 h-11 flex items-center justify-center text-white">
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 3v4h-4" /></svg>
          </button>
          <button
            onClick={doSend} disabled={sending || !base} aria-label="Bhejein"
            className="ml-1 h-11 px-6 rounded-full bg-[var(--mv2-accent)] text-white font-semibold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {sending ? '...' : 'Bhejein ✓'}
          </button>
        </div>
      </div>

      {/* stage */}
      <div ref={stageRef} className="flex-1 min-h-0 flex items-center justify-center px-3 relative">
        {!base ? (
          <p className="text-white/60 text-[14px]">Photo taiyaar ho rahi hai...</p>
        ) : (
          <div className="relative" style={{ width: dw, height: dh }}>
            <canvas
              ref={(c) => { if (c && base && (c.width !== base.width || c.height !== base.height)) { c.width = base.width; c.height = base.height; c.getContext('2d')!.drawImage(base, 0, 0); } }}
              className="w-full h-full block rounded-sm"
            />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${cw} ${ch}`}
              className="absolute inset-0 w-full h-full touch-none"
              style={{ cursor: tool === 'doodle' ? 'crosshair' : tool === 'crop' ? 'move' : tool === 'text' ? 'text' : 'default' }}
              onPointerDown={onSvgDown}
              onPointerMove={onSvgMove}
              onPointerUp={onSvgUp}
              onPointerCancel={onSvgUp}
            >
              {/* crop dim + frame */}
              {tool === 'crop' && ratio && (
                <g>
                  <rect x={0} y={0} width={cw} height={crop.y} fill="black" opacity="0.55" />
                  <rect x={0} y={crop.y + crop.h} width={cw} height={ch - crop.y - crop.h} fill="black" opacity="0.55" />
                  <rect x={0} y={crop.y} width={crop.x} height={crop.h} fill="black" opacity="0.55" />
                  <rect x={crop.x + crop.w} y={crop.y} width={cw - crop.x - crop.w} height={crop.h} fill="black" opacity="0.55" />
                  <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="white" strokeWidth={2.5} />
                  {[1 / 3, 2 / 3].map((f) => (
                    <g key={f} stroke="white" strokeWidth={1} opacity="0.5">
                      <line x1={crop.x + crop.w * f} y1={crop.y} x2={crop.x + crop.w * f} y2={crop.y + crop.h} />
                      <line x1={crop.x} y1={crop.y + crop.h * f} x2={crop.x + crop.w} y2={crop.y + crop.h * f} />
                    </g>
                  ))}
                </g>
              )}
              {/* strokes */}
              {ops.map((op, i) =>
                op.kind === 'stroke' && op.points.length > 0 ? (
                  <polyline
                    key={i}
                    points={op.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={op.color}
                    strokeWidth={Math.max(1, op.wFrac * cw)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: 'none' }}
                  />
                ) : op.kind === 'text' ? (
                  <text
                    key={i}
                    x={op.x}
                    y={op.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={op.sizeFrac * cw}
                    fontWeight={600}
                    fill={op.color}
                    stroke="rgba(0,0,0,0.45)"
                    strokeWidth={Math.max(1, op.sizeFrac * cw * 0.12)}
                    paintOrder="stroke"
                    fontFamily="system-ui, sans-serif"
                    onPointerDown={(e) => startTextDrag(e, i)}
                    style={{ cursor: tool === 'doodle' ? 'default' : 'move', userSelect: 'none' }}
                  >
                    {op.text}
                  </text>
                ) : null
              )}
            </svg>
            {/* pending text input */}
            {pendingText && (
              <div
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1 bg-black/70 rounded-full pl-3 pr-1 py-1 border border-white/25"
                style={{ left: `${(pendingText.x / cw) * 100}%`, top: `${(pendingText.y / ch) * 100}%` }}
              >
                <input
                  autoFocus
                  value={pendingText.v}
                  onChange={(e) => setPendingText({ ...pendingText, v: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmText(); if (e.key === 'Escape') setPendingText(null); }}
                  placeholder="Likhein..."
                  maxLength={60}
                  className="bg-transparent outline-none text-white text-[15px] w-36"
                  style={{ color }}
                />
                <button onClick={confirmText} className="w-8 h-8 rounded-full bg-[var(--mv2-accent)] text-white flex items-center justify-center text-[15px]">✓</button>
                <button onClick={() => setPendingText(null)} className="w-8 h-8 rounded-full text-white/70 flex items-center justify-center">✕</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* caption */}
      <div className="px-4 pb-1">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Caption likhein..."
          maxLength={200}
          className="w-full h-11 px-4 rounded-full bg-white/10 text-white placeholder:text-white/45 outline-none text-[14px]"
        />
      </div>

      {/* tool controls */}
      {tool === 'crop' && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 overflow-x-auto mv2-no-scrollbar">
          {RATIOS.map((r) => (
            <button
              key={r.id}
              onClick={() => { setRatioId(r.id); setPan({ x: 0.5, y: 0.5 }); tapHaptic(); }}
              className={`px-4 h-9 rounded-full text-[13px] font-medium whitespace-nowrap ${ratioId === r.id ? 'bg-white text-black' : 'bg-white/10 text-white/75'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {(tool === 'doodle' || tool === 'text') && (
        <div className="flex items-center justify-center gap-2.5 px-4 py-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); tapHaptic(); }}
              aria-label={c}
              className={`w-8 h-8 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-white/20'}`}
              style={{ background: c }}
            />
          ))}
          {tool === 'doodle' && (
            <span className="flex gap-1 ml-1">
              {BRUSHES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { setBrush(b); tapHaptic(); }}
                  aria-label={b.label}
                  className={`w-9 h-9 rounded-full flex items-center justify-center ${brush.id === b.id ? 'bg-white/25' : ''}`}
                >
                  <span className="rounded-full bg-white" style={{ width: 6 + BRUSHES.indexOf(b) * 5, height: 6 + BRUSHES.indexOf(b) * 5 }} />
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      {/* tool bar */}
      <div className="flex items-center justify-center gap-1 px-4 pt-1 pb-4 mv2-safe-bottom">
        {toolBtn('crop', 'Crop', (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2v16a2 2 0 0 0 2 2h16M2 6h16a2 2 0 0 1 2 2v16" /></svg>
        ))}
        {toolBtn('text', 'Text', (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 6V4h14v2M12 4v16M9 20h6" /></svg>
        ))}
        {toolBtn('doodle', 'Doodle', (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20c2-1 3-2 4-4L19 5l-3-3L5 13c-2 1-3 2-4 4l-1 4 4-1z" /><path d="M13 8l3 3" /></svg>
        ))}
      </div>
      {tool === 'crop' && ratio && (
        <p className="text-center text-white/50 text-[12px] pb-3 -mt-2 mv2-safe-bottom">Photo ko drag karke crop adjust karein</p>
      )}
    </div>
  );
}
