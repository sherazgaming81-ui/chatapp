"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Partner one-tap posting page — PUBLIC (ChatsApp login NAHI chahiye)
// ═══════════════════════════════════════════════════════════════════════════
// Owner CRM se partner ko signed link bhejta hai:
//   /threads/connect?c=<contactId>&s=<signature>
// Page par partner ki AAJ ki ready-made posts aati hain. Har post par:
//   "Threads par lagao" → Threads ka official intent link khulta hai
//   (composer pehle se bhara hua) → partner sirf Post dabata hai →
//   wapas aakar "Ho gaya ✓" mark kar deta hai.
// Koi OAuth, koi Meta app, koi token partner ke liye NAHI — one-tap model.
// Data /api/partners/posts se ata hai (server signature verify karta hai).
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";

interface PartnerPost {
  id: string;
  platform: string;
  body: string;
  scheduled_at: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="thin-scroll min-h-0 w-full flex-1 overflow-y-auto p-4">
      <div className="mx-auto w-full max-w-xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4f8cff]">Symbiote Systems</p>
        {children}
      </div>
    </div>
  );
}

function PartnerPosts() {
  const params = useSearchParams();
  const c = params.get("c") || "";
  const s = params.get("s") || "";

  const [state, setState] = useState<"loading" | "invalid" | "error" | "ready">("loading");
  const [name, setName] = useState("");
  const [posts, setPosts] = useState<PartnerPost[]>([]);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const [markingId, setMarkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!c || !s) { setState("invalid"); return; }
    try {
      const r = await fetch(`/api/partners/posts?c=${encodeURIComponent(c)}&s=${encodeURIComponent(s)}`);
      const j: any = await r.json().catch(() => null);
      if (r.status === 401 || j?.error === "invalid_link") { setState("invalid"); return; }
      if (!r.ok || !j?.ok) { setState("error"); return; }
      setName(j.partner?.name || "");
      setPosts(j.posts || []);
      setState("ready");
    } catch {
      setState("error");
    }
  }, [c, s]);

  useEffect(() => { load(); }, [load]);

  const markDone = async (post: PartnerPost) => {
    setMarkingId(post.id);
    try {
      const r = await fetch("/api/partners/mark-posted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, c, s }),
      });
      const j: any = await r.json().catch(() => null);
      if (r.ok && j?.ok) {
        setDoneIds((prev) => new Set(prev).add(post.id));
      }
    } catch { /* neeche button dobara try ho sakta hai */ }
    setMarkingId(null);
  };

  if (state === "loading") {
    return (
      <Shell>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8]">Posts aa rahi hain…</h1>
        <p className="mt-2 text-sm text-[#b6bcc7]">Thora intezar karein.</p>
      </Shell>
    );
  }

  if (state === "invalid") {
    return (
      <Shell>
        <div className="rounded-2xl border border-white/10 bg-[#111114] p-6 soft-shadow">
          <h1 className="text-xl font-extrabold tracking-tight text-[#f4f6f8]">Link ghalat hai</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
            Ye link ghalat ya purana lag raha hai. Symbiote Systems se dobara naya link mang lein — wahi link kaam karega jo aap ko bheja gaya tha.
          </p>
        </div>
      </Shell>
    );
  }

  if (state === "error") {
    return (
      <Shell>
        <div className="rounded-2xl border border-white/10 bg-[#111114] p-6 soft-shadow">
          <h1 className="text-xl font-extrabold tracking-tight text-[#f4f6f8]">Thora intezar karein</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
            Posts abhi nahi aa saki. Kuch dair baad yehi link dobara kholein, ya Symbiote Systems ko bata dein.
          </p>
          <button onClick={load} className="btn btn-blurple mt-4 px-4 py-2 text-sm">Dobara try karein</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8] sm:text-2xl">
        {name ? `${name} — ` : ""}Aaj ki posts
      </h1>
      <p className="mt-2 rounded-xl border border-[#4f8cff]/30 bg-[#4f8cff]/10 px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#8dbcff]">
        Button dabao, Threads khulega (post pehle se likhi hogi) — sirf <b>Post</b> dabana hai. Phir wapas aakar <b>“Ho gaya ✓”</b> dabao.
      </p>

      {posts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-[#111114] p-6 soft-shadow">
          <p className="text-sm leading-relaxed text-[#b6bcc7]">
            Aaj ke liye koi post tayyar nahi hai. Jab Symbiote Systems nayi post queue karega, wo yahan aa jayegi — yehi link kal dobara khol lein.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3 pb-6">
          {posts.map((post) => {
            const done = doneIds.has(post.id);
            return (
              <div
                key={post.id}
                className={`rounded-2xl border p-5 soft-shadow transition ${done ? "border-[#23a55a]/40 bg-[#23a55a]/[0.06] opacity-70" : "border-white/10 bg-[#111114]"}`}
              >
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#f4f6f8]">{post.body}</p>
                {done ? (
                  <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#23a55a]/15 px-3 py-2.5 text-sm font-bold text-[#4ade80]">
                    <Check size={16} /> Posted ✓ — shukriya!
                  </p>
                ) : (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    {post.platform === "threads" ? (
                      <a
                        href={`https://www.threads.net/intent/post?text=${encodeURIComponent(post.body)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-blurple flex flex-1 items-center justify-center gap-2 px-4 py-3 text-[15px] font-bold"
                      >
                        Threads par lagao <ExternalLink size={16} />
                      </a>
                    ) : (
                      <p className="flex flex-1 items-center rounded-lg bg-white/[0.06] px-3 py-2.5 text-[13px] font-semibold text-[#b6bcc7]">
                        Ye {post.platform} post hai — is ke liye Symbiote Systems se rabta karein.
                      </p>
                    )}
                    <button
                      onClick={() => markDone(post)}
                      disabled={markingId === post.id}
                      className="btn btn-ghost flex items-center justify-center gap-1.5 px-4 py-3 text-[15px] font-bold text-[#4ade80] disabled:opacity-60"
                    >
                      <Check size={16} /> {markingId === post.id ? "Ho raha…" : "Ho gaya ✓"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="pb-4 text-center text-xs text-[#8b93a1]">
        Ye page sirf aap ke liye hai — link kisi aur ko na bhejein.
      </p>
    </Shell>
  );
}

export default function PartnerThreadsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 w-full flex-1 items-center justify-center p-4">
          <p className="text-sm text-[#8b93a1]">Posts aa rahi hain…</p>
        </div>
      }
    >
      <PartnerPosts />
    </Suspense>
  );
}
