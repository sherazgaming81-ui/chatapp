'use client';

/**
 * DocumentPreview — WhatsApp style in-app document preview.
 * PDF: browser ka native viewer · DOC/DOCX/XLS/PPT: Office online viewer
 * · TXT/MD/CSV: text render · baqi: download card.
 */

import { useEffect, useState } from 'react';
import { Icon, ICONS } from './common';

interface Props {
  url: string;
  fileName: string;
  fileSize?: number;
  onClose(): void;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function fmtSize(b?: number): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf'];
const TEXT_EXTS = ['txt', 'md', 'csv', 'json', 'log'];

export default function DocumentPreview({ url, fileName, fileSize, onClose }: Props) {
  const ext = extOf(fileName);
  const [text, setText] = useState<string | null>(null);
  const [textErr, setTextErr] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!TEXT_EXTS.includes(ext)) return;
    let alive = true;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.text();
      })
      .then((t) => {
        if (alive) setText(t.slice(0, 60000));
      })
      .catch(() => {
        if (alive) setTextErr(true);
      });
    return () => {
      alive = false;
    };
  }, [url, ext]);

  const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-[v2fade_.15s_ease-out]" onClick={onClose} />
      <div className="relative bg-[var(--v2-panel)] text-[var(--v2-text)] rounded-2xl shadow-2xl border border-[var(--v2-border)] w-full max-w-[860px] h-[86vh] flex flex-col overflow-hidden animate-[v2pop_.18s_ease-out]">
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--v2-border)] shrink-0">
          <span className="w-10 h-10 rounded-xl bg-[#ff9f1c]/15 text-[#ff9f1c] flex items-center justify-center shrink-0">
            <Icon d={ICONS.file} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-medium truncate">{fileName}</p>
            <p className="text-[12px] text-[var(--v2-muted)]">
              {ext ? ext.toUpperCase() : 'File'}{fileSize ? ` · ${fmtSize(fileSize)}` : ''}
            </p>
          </div>
          <a
            href={url}
            download={fileName}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--v2-accent)] text-white text-[13.5px] font-medium hover:brightness-110 transition shrink-0"
          >
            <Icon d={ICONS.download} size={16} />
            Download
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[var(--v2-muted)] hover:bg-[var(--v2-hover)] transition shrink-0"
            aria-label="Band karein"
          >
            <Icon d={ICONS.x} size={20} />
          </button>
        </div>

        {/* body */}
        <div className="flex-1 min-h-0 bg-[var(--v2-panel2)]">
          {ext === 'pdf' && (
            <iframe src={url} title={fileName} className="w-full h-full border-0" />
          )}
          {OFFICE_EXTS.includes(ext) && (
            <iframe src={officeUrl} title={fileName} className="w-full h-full border-0 bg-white" />
          )}
          {TEXT_EXTS.includes(ext) && (
            <div className="h-full overflow-auto v2scroll p-5">
              {text === null && !textErr && (
                <p className="text-[13px] text-[var(--v2-muted)]">Load ho raha hai…</p>
              )}
              {textErr && (
                <p className="text-[13px] text-[var(--v2-muted)]">Preview nahi ho saka — download karke dekhein.</p>
              )}
              {text !== null && (
                <pre className="text-[13px] leading-relaxed text-[var(--v2-text)] whitespace-pre-wrap break-words font-mono">
                  {text}
                </pre>
              )}
            </div>
          )}
          {!['pdf', ...OFFICE_EXTS, ...TEXT_EXTS].includes(ext) && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <span className="w-16 h-16 rounded-2xl bg-[var(--v2-panel3)] flex items-center justify-center text-[var(--v2-muted)]">
                <Icon d={ICONS.file} size={30} />
              </span>
              <p className="text-[14.5px] font-medium">Is file ka preview available nahi</p>
              <p className="text-[13px] text-[var(--v2-muted)] max-w-[360px] leading-relaxed">
                App ke andar preview sirf PDF, Office documents aur text files ka hota hai.
                Download karke kholein.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
