"use client";
// Phase 6 — F12 Profile Setup Wizard. First login par: Naam → Photo → About.
import { useRef, useState } from "react";
import { Camera, Check, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function ProfileWizard({ onDone }: { onDone: () => void }) {
  const meId = getState().me;
  const me = getState().members.find((m) => m.id === meId);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(me?.name && me.name !== "Member" ? me.name : "");
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
    const nm = name.trim() || me?.name || "Member";
    setSaving(true);
    try {
      await supabase().from("profiles").update({ display_name: nm, about: about.trim(), photo_url: photo || "" }).eq("id", meId);
    } catch { /* offline — local still updates */ }
    update({ members: getState().members.map((m) => (m.id === meId ? { ...m, name: nm, about: about.trim(), avatar: photo } : m)) });
    setSaving(false);
    onDone();
  };

  const canNext = step === 0 ? name.trim().length >= 2 : true;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#f4f5fa] px-5">
      <div className="pop-in w-full max-w-md rounded-3xl bg-white p-7 soft-shadow sm:p-9">
        {/* progress */}
        <div className="mb-6 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#5865f2]" : "bg-black/10"}`} />
          ))}
        </div>

        {step === 0 && (
          <div>
            <p className="text-3xl">👋</p>
            <h2 className="mt-3 text-2xl font-extrabold text-[#2f3035]">Aapka naam?</h2>
            <p className="mt-1 text-sm text-[#80848e]">Dost aapko isi naam se pehchanenge</p>
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={32}
              placeholder="Jaise: Muhammad Ahmed" autoFocus
              className="field mt-5 w-full px-4 py-3.5 text-lg"
            />
          </div>
        )}

        {step === 1 && (
          <div className="text-center">
            <p className="text-3xl">📸</p>
            <h2 className="mt-3 text-2xl font-extrabold text-[#2f3035]">Profile photo</h2>
            <p className="mt-1 text-sm text-[#80848e]">Apni pehchan lagao (optional)</p>
            <button onClick={() => file.current?.click()} className="group relative mx-auto mt-6 block" title="Photo lagao">
              <Avatar m={{ id: meId, name: name || "?", avatar: photo, online: true }} size={110} />
              <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
                <Camera size={28} className="text-white" />
              </span>
            </button>
            <input ref={file} hidden type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            <p className="mt-3 text-xs text-[#80848e]">Tap karke photo chuno</p>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-3xl">✍️</p>
            <h2 className="mt-3 text-2xl font-extrabold text-[#2f3035]">Apne baare me</h2>
            <p className="mt-1 text-sm text-[#80848e]">Ek line apne baare me (optional)</p>
            <textarea
              value={about} onChange={(e) => setAbout(e.target.value)} maxLength={120} rows={3}
              placeholder="Jaise: Madrasa-e-Tahfeez-ul-Quran ka talib-e-ilm 🌙"
              className="field mt-5 w-full resize-none px-4 py-3.5 text-[15px]"
            />
          </div>
        )}

        {/* nav */}
        <div className="mt-8 flex items-center gap-3">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10 text-[#5c5e66]" aria-label="Pichla">
              <ChevronLeft size={22} />
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={() => canNext && setStep((s) => s + 1)}
              disabled={!canNext}
              className="btn btn-blurple flex flex-1 items-center justify-center gap-2 px-6 py-3.5 disabled:opacity-40"
            >
              Aage <ChevronRight size={18} />
            </button>
          ) : (
            <button onClick={save} disabled={saving} className="btn btn-blurple flex flex-1 items-center justify-center gap-2 px-6 py-3.5 disabled:opacity-60">
              <Check size={18} /> {saving ? "Save ho raha…" : "Mukammal karo 🎉"}
            </button>
          )}
        </div>
        {step === 0 && <p className="mt-3 text-center text-xs text-[#80848e]">Kam se kam 2 harf likho</p>}
      </div>
    </div>
  );
}
