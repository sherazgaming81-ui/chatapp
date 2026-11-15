"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Partner one-tap posting page — PUBLIC (no ChatsApp login needed)
// ═══════════════════════════════════════════════════════════════════════════
// The owner sends the partner a signed link:
//   /threads/connect?c=<contactId>&s=<signature>
// The page lists the partner's ready posts for today. On each post:
//   "Post on Threads" → opens the official Threads intent link (composer
//   pre-filled) → the partner just presses Post → comes back and taps
//   "Mark as Posted ✓".
// No OAuth, no Meta app, no token for partners — the one-tap model.
// Data comes from /api/partners/posts (server verifies the signature).
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
    } catch { /* the button can simply be tried again */ }
    setMarkingId(null);
  };

  if (state === "loading") {
    return (
      <Shell>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8]">Loading your posts…</h1>
        <div className="mt-4 space-y-3" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-[#27334D] bg-[#141C2B] p-5">
              <div className="skel h-4 w-full" />
              <div className="skel mt-2 h-4 w-2/3" />
              <div className="skel mt-4 h-11 w-full !rounded-lg" />
            </div>
          ))}
        </div>
      </Shell>
    );
  }

  if (state === "invalid") {
    return (
      <Shell>
        <div className="rounded-2xl border border-[#27334D] bg-[#141C2B] p-6 soft-shadow">
          <h1 className="text-xl font-extrabold tracking-tight text-[#f4f6f8]">This link isn't valid</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
            This link looks incorrect or outdated. Please ask Symbiote Systems for a fresh link — only the exact link sent to you will work.
          </p>
        </div>
      </Shell>
    );
  }

  if (state === "error") {
    return (
      <Shell>
        <div className="rounded-2xl border border-[#27334D] bg-[#141C2B] p-6 soft-shadow">
          <h1 className="text-xl font-extrabold tracking-tight text-[#f4f6f8]">Please try again shortly</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
            Your posts couldn't be loaded right now. Please open the same link again in a little while, or let Symbiote Systems know.
          </p>
          <button onClick={load} className="btn btn-blurple mt-4 px-4 py-2 text-sm">Try again</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8] sm:text-2xl">
        {name ? `${name} — ` : ""}Today's Posts
      </h1>
      <p className="mt-2 rounded-xl border border-[#4f8cff]/30 bg-[#4f8cff]/10 px-4 py-3 text-[13px] font-semibold leading-relaxed text-[#8dbcff]">
        Tap the button, Threads will open with your post ready — just press <b>Post</b>. Then come back here and tap <b>"Mark as Posted ✓"</b>.
      </p>

      {posts.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-[#27334D] bg-[#141C2B] p-6 soft-shadow">
          <p className="text-sm leading-relaxed text-[#b6bcc7]">
            No posts are ready for today. When Symbiote Systems queues a new post for you, it will appear here — just open this same link again tomorrow.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3 pb-6">
          {posts.map((post) => {
            const done = doneIds.has(post.id);
            return (
              <div
                key={post.id}
                className={`rounded-2xl border p-5 soft-shadow transition ${done ? "border-[#23a55a]/40 bg-[#23a55a]/[0.06] opacity-70" : "border-[#27334D] bg-[#141C2B]"}`}
              >
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#f4f6f8]">{post.body}</p>
                {done ? (
                  <p className="mt-4 flex items-center gap-2 rounded-lg bg-[#23a55a]/15 px-3 py-2.5 text-sm font-bold text-[#4ade80]">
                    <Check size={16} /> Posted ✓ — thank you!
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
                        Post on Threads <ExternalLink size={16} />
                      </a>
                    ) : (
                      <p className="flex flex-1 items-center rounded-lg bg-white/[0.06] px-3 py-2.5 text-[13px] font-semibold text-[#b6bcc7]">
                        This is a {post.platform} post — please contact Symbiote Systems for this one.
                      </p>
                    )}
                    <button
                      onClick={() => markDone(post)}
                      disabled={markingId === post.id}
                      className="btn btn-ghost flex items-center justify-center gap-1.5 px-4 py-3 text-[15px] font-bold text-[#4ade80] disabled:opacity-60"
                    >
                      <Check size={16} /> {markingId === post.id ? "Marking…" : "Mark as Posted ✓"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <p className="pb-4 text-center text-xs text-[#93A0B4]">
        This page is private to you — please don't share the link with anyone else.
      </p>
    </Shell>
  );
}

export default function PartnerThreadsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-0 w-full flex-1 items-center justify-center p-4">
          <p className="text-sm text-[#93A0B4]">Loading your posts…</p>
        </div>
      }
    >
      <PartnerPosts />
    </Suspense>
  );
}
