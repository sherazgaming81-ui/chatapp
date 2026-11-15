"use client";
// Minimal first-login setup — sirf naam + photo. Koi steps, koi celebration nahi.
import { useRef, useState } from "react";
import { Camera, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getState, update, toast } from "@/lib/store";
import { Avatar } from "@/components/ui";

async function resizePhoto(file: File, max = 512): Promise<string> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * sc);
  cv.height = Math.round(img.height * sc);
  cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  return cv.toDataURL("image/jpeg", 0.85);
}

export default function ProfileSetup({ onDone }: { onDone: () => void }) {
  const meId = getState().me;
  const me = getState().members.find((m) => m.id === meId);
  const [name, setName] = useState(me?.name && me.name !== "Member" ? me.name : "");
  const [photo, setPhoto] = useState<string | undefined>(me?.avatar);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const pick = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    try { setPhoto(await resizePhoto(f)); }
    catch { toast("Couldn't open photo", "Try another one"); }
  };

  const save = async () => {
    const nm = name.trim();
    if (nm.length < 2) { toast("Enter your name", "At least 2 characters"); return; }
    setSaving(true);
    try {
      await supabase().from("profiles").update({ display_name: nm, photo_url: photo || "" }).eq("id", meId);
    } catch { /* offline — local still updates */ }
    update({ members: getState().members.map((m) => (m.id === meId ? { ...m, name: nm, avatar: photo } : m)) });
    setSaving(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-5">
      <div className="pop-in w-full max-w-sm rounded-2xl border border-white/10 bg-[#111114] p-6 soft-shadow">
        <h2 className="text-lg font-extrabold text-[#f4f6f8]">Complete your profile</h2>
        <p className="mt-0.5 text-sm text-[#8b93a1]">Just your name and photo.</p>
        <div className="mb-4 mt-5 flex justify-center">
          <button onClick={() => file.current?.click()} className="group relative" title="Change photo">
            <Avatar m={{ id: meId, name: name || "?", avatar: photo, online: true }} size={84} />
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
              <Camera size={22} className="text-white" />
            </span>
          </button>
          <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </div>
        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.06em] text-[#8b93a1]">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={32}
          placeholder="Your name"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          className="field mb-4 w-full px-3 py-2.5 text-[15px]"
        />
        <button onClick={save} disabled={saving} className="btn btn-blurple flex w-full items-center justify-center gap-2 px-4 py-3 text-[15px] disabled:opacity-60">
          <Check size={17} /> {saving ? "Saving…" : "Save and get started"}
        </button>
      </div>
    </div>
  );
}
