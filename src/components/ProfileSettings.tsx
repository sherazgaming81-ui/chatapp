"use client";
import { useRef, useState } from "react";
import { X, Camera, LogOut, Check } from "lucide-react";
import { getState, useStore, toast, update } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/lib/db";
import { Avatar } from "@/components/ui";

async function resizePhoto(file: File): Promise<string> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const max = 512;
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * sc);
  cv.height = Math.round(img.height * sc);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  return cv.toDataURL("image/jpeg", 0.85);
}

export default function ProfileSettings({ onClose }: { onClose: () => void }) {
  const meId = useStore((s) => s.me);
  const me = useStore((s) => s.members.find((m) => m.id === s.me));
  const [name, setName] = useState(me?.name || "");
  const [about, setAbout] = useState(me?.about || "");
  const [photo, setPhoto] = useState<string | undefined>(me?.avatar);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    try { setPhoto(await resizePhoto(f)); }
    catch { toast("Photo nahi khuli", "Doosri try karo"); }
  };

  const save = async () => {
    const nm = name.trim();
    if (!nm) { toast("Naam khaali nahi ho sakta", ""); return; }
    setSaving(true);
    try {
      await supabase().from("profiles").update({ display_name: nm, about: about.trim(), photo_url: photo || "" }).eq("id", meId);
    } catch { /* offline — local still updates */ }
    update({ members: getState().members.map((m) => (m.id === meId ? { ...m, name: nm, about: about.trim(), avatar: photo } : m)) });
    setSaving(false);
    toast("Profile save ho gaya", "");
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="pop-in fixed left-1/2 top-1/2 z-50 w-[340px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-white p-5 soft-shadow">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold tracking-tight text-[#2f3035]">Profile settings</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-[#80848e] hover:bg-black/5"><X size={18} /></button>
        </div>

        <div className="mb-4 flex justify-center">
          <button onClick={() => file.current?.click()} className="group relative" title="Photo badlo">
            <Avatar m={{ id: meId, name: name || "?", avatar: photo, online: true }} size={84} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
              <Camera size={22} className="text-white" />
            </span>
          </button>
          <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>

        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">Naam</label>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Aapka naam" className="field mb-3 w-full px-3 py-2.5 text-[15px]" />

        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#80848e]">About</label>
        <textarea value={about} onChange={(e) => setAbout(e.target.value)} maxLength={120} rows={2} placeholder="Apne baare me kuch…" className="field mb-4 w-full resize-none px-3 py-2.5 text-[15px]" />

        <button onClick={save} disabled={saving} className="btn btn-blurple flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] disabled:opacity-60">
          <Check size={17} /> {saving ? "Save ho raha…" : "Save karo"}
        </button>
        <button onClick={() => signOut()} className="btn mt-2 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm text-[#ed4245] hover:bg-[#ed4245]/10">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </>
  );
}
