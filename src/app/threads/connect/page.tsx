// ═══════════════════════════════════════════════════════════════════════════
// Partner Threads connect page — PUBLIC (ChatsApp login NAHI chahiye)
// ═══════════════════════════════════════════════════════════════════════════
// Owner CRM se partner ko signed link bhejta hai:
//   /threads/connect?c=<contactId>&s=<signature>
// Ye page signature verify karke partner ko salaam karke "Connect Threads"
// button deti hai — button seedha Threads (Meta) ki official login screen
// par le jata hai. Permission milte hi account us partner ke naam par
// save ho jata hai aur us ki posts usi account se jati hain.
import { verifyPartnerLink } from "@/lib/partnerLink";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111114] p-6 soft-shadow sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4f8cff]">Symbiote Systems</p>
        {children}
      </div>
    </div>
  );
}

export default async function PartnerThreadsConnectPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; s?: string; done?: string; error?: string }>;
}) {
  const { c, s, done, error } = await searchParams;

  if (!c || !s || !verifyPartnerLink(c, s)) {
    return (
      <Shell>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8]">Link ghalat hai</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
          Ye connect link ghalat ya purana lag raha hai. Symbiote Systems se dobara naya link mang lein — wahi link kaam karega jo aap ko bheja gaya tha.
        </p>
      </Shell>
    );
  }

  let contactName: string | null = null;
  let connectedUsername: string | null = null;
  let serverOk = true;
  try {
    const admin = supabaseAdmin();
    const { data: contact } = await admin.from("crm_contacts").select("name").eq("id", c).maybeSingle();
    contactName = contact?.name || null;
    if (!contactName) {
      return (
        <Shell>
          <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8]">Link ghalat hai</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
            Is link ke sath koi partner record nahi mila. Symbiote Systems se dobara naya link mang lein.
          </p>
        </Shell>
      );
    }
    const { data: acc } = await admin
      .from("social_accounts")
      .select("username")
      .eq("platform", "threads")
      .eq("crm_contact_id", c)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    connectedUsername = acc?.username || null;
  } catch {
    serverOk = false;
  }

  if (!serverOk) {
    return (
      <Shell>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8]">Thora intezar karein</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
          Server abhi tayyar nahi hai. Kuch dair baad yehi link dobara kholein, ya Symbiote Systems ko bata dein.
        </p>
      </Shell>
    );
  }

  if (done === "1") {
    return (
      <Shell>
        <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8]">Ho gaya! 🎉</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
          {contactName} — aap ka Threads account connect ho gaya hai
          {connectedUsername ? <> (<span className="font-bold text-[#f4f6f8]">@{connectedUsername}</span>)</> : null}.
          Ab Symbiote Systems aap ke liye jo posts queue karega, wo aap ke isi account se publish hongi. Aap ye page band kar sakte hain.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-2 text-xl font-extrabold tracking-tight text-[#f4f6f8]">
        Assalam-o-Alaikum {contactName}!
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[#b6bcc7]">
        Apna <span className="font-bold text-[#f4f6f8]">Threads account</span> connect karein — Symbiote Systems ki posting ke liye.
        Neeche wala button Threads ki official screen par le jayega, wahan login karke <span className="font-bold text-[#f4f6f8]">Allow</span> kar dein. Bas itna hi kaam hai.
      </p>
      {connectedUsername && (
        <p className="mt-3 rounded-lg bg-[#23a55a]/15 px-3 py-2 text-[13px] font-bold text-[#4ade80]">
          ● @{connectedUsername} pehle se connected hai — account badalna ho to neeche se dobara connect kar lein.
        </p>
      )}
      {error === "not_configured" && (
        <p className="mt-3 rounded-lg bg-[#f5a623]/15 px-3 py-2 text-[13px] font-bold text-[#fbbf24]">
          Server par Threads abhi configure nahi hua — Symbiote Systems ko bata dein, phir yehi link dobara kholein.
        </p>
      )}
      {error === "error" && (
        <p className="mt-3 rounded-lg bg-[#ed4245]/15 px-3 py-2 text-[13px] font-bold text-[#ff8589]">
          Connect nahi hua — dobara try karein. Threads login ke doran Allow lazmi dabana hai.
        </p>
      )}
      <a href={`/api/threads/connect?c=${encodeURIComponent(c)}&s=${encodeURIComponent(s)}`} className="btn btn-blurple mt-5 flex w-full items-center justify-center px-4 py-3 text-[15px] font-bold">
        Connect Threads
      </a>
      <p className="mt-3 text-center text-xs leading-relaxed text-[#8b93a1]">
        Aap ka password hamare paas kabhi nahi ata — connection Meta ki official permission se banta hai, aur aap jab chahein Threads settings se hata sakte hain.
      </p>
    </Shell>
  );
}
