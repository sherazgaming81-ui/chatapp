"use client";
// GIF library — GIPHY live API + curated CDN fallback.
// GIPHY API key — user ki key (public client-side key)
const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || "gOJtDcFabYgak7kMh1VTcXMpNz2VcEw7";
const GIPHY = "https://api.giphy.com/v1/gifs";

export interface GifItem {
  id: string;
  title: string;
  /** small preview for grids */
  preview: string;
  /** full-size gif */
  url: string;
}

export interface GifCategory {
  id: string;
  label: string;
  /** keywords used for GIPHY search + curated matching */
  query: string;
}

export const GIF_CATEGORIES: GifCategory[] = [
  { id: "trending", label: "🔥 Trending", query: "" },
  { id: "funny", label: "😂 Funny", query: "funny" },
  { id: "love", label: "❤️ Love", query: "love" },
  { id: "reaction", label: "🎭 Reactions", query: "reaction" },
  { id: "happy", label: "😊 Happy", query: "happy" },
  { id: "sad", label: "😢 Sad", query: "sad" },
  { id: "wow", label: "😲 Wow", query: "wow shocked" },
  { id: "hello", label: "👋 Hello", query: "hello hi" },
  { id: "good-morning", label: "🌅 Good Morning", query: "good morning" },
  { id: "good-night", label: "🌙 Good Night", query: "good night" },
  { id: "party", label: "🎉 Party", query: "party celebration" },
  { id: "thank-you", label: "🙏 Thank You", query: "thank you" },
  { id: "congratulations", label: "🎊 Congrats", query: "congratulations" },
  { id: "sorry", label: "😔 Sorry", query: "sorry" },
  { id: "dance", label: "💃 Dance", query: "dance" },
  { id: "cat", label: "🐱 Cats", query: "cat" },
  { id: "cricket", label: "🏏 Cricket", query: "cricket" },
  { id: "islamic", label: "🕌 Islamic", query: "ramadan eid mubarak" },
];

function toItem(id: string, title: string): GifItem {
  return {
    id,
    title,
    preview: `https://media.giphy.com/media/${id}/200.gif`,
    url: `https://media.giphy.com/media/${id}/giphy.gif`,
  };
}

function fromGiphyJson(d: any): GifItem[] {
  const arr = Array.isArray(d?.data) ? d.data : [];
  return arr
    .map((g: any) => {
      const id = String(g?.id || "");
      if (!id) return null;
      const fw = g?.images?.fixed_width?.url;
      const orig = g?.images?.original?.url;
      return {
        id,
        title: String(g?.title || "GIF"),
        preview: fw || `https://media.giphy.com/media/${id}/200.gif`,
        url: orig || `https://media.giphy.com/media/${id}/giphy.gif`,
      } as GifItem;
    })
    .filter(Boolean) as GifItem[];
}

// ---- live GIPHY (skipped forever once it fails) ----
let giphyDead = false;
async function giphyFetch(path: string, limit: number): Promise<GifItem[] | null> {
  if (giphyDead) return null;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${GIPHY}${path}&api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error("giphy " + r.status);
    const items = fromGiphyJson(await r.json());
    return items.length ? items : null;
  } catch {
    giphyDead = true; // don't hammer a dead key
    return null;
  }
}

// ---- curated fallback ----
function curatedSearch(query: string, limit: number): GifItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return curatedTrending(limit);
  const scored: { g: GifItem; s: number }[] = [];
  for (const cat of Object.keys(CURATED)) {
    const entries = CURATED[cat];
    for (const [id, title] of entries) {
      const t = title.toLowerCase();
      let s = 0;
      for (const w of words) if (t.includes(w)) s += 2;
      if (cat.includes(words[0]) || words.some((w) => cat.includes(w))) s += 1;
      if (s > 0) scored.push({ g: toItem(id, title), s });
    }
  }
  scored.sort((a, b) => b.s - a.s);
  const out: GifItem[] = [];
  const seen = new Set<string>();
  for (const { g } of scored) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    out.push(g);
    if (out.length >= limit) break;
  }
  return out;
}

function curatedTrending(limit: number): GifItem[] {
  // round-robin across categories so trending is a real mix
  const cats = Object.keys(CURATED);
  const out: GifItem[] = [];
  const seen = new Set<string>();
  let i = 0;
  while (out.length < limit && i < 200) {
    const cat = cats[i % cats.length];
    const entries = CURATED[cat];
    const e = entries[Math.floor(i / cats.length) % entries.length];
    if (e && !seen.has(e[0])) {
      seen.add(e[0]);
      out.push(toItem(e[0], e[1]));
    }
    i++;
  }
  return out;
}

function curatedCategory(cat: string, limit: number): GifItem[] {
  // islamic = ramadan + eid combined
  const src = cat === "islamic" ? [...(CURATED["ramadan"] || []), ...(CURATED["eid"] || [])] : CURATED[cat] || [];
  return src.slice(0, limit).map(([id, title]) => toItem(id, title));
}

// ---- simple in-memory cache ----
const cache = new Map<string, GifItem[]>();
function cached(key: string, make: () => GifItem[]): GifItem[] {
  const hit = cache.get(key);
  if (hit) return hit;
  const v = make();
  cache.set(key, v);
  if (cache.size > 60) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return v;
}

/** Live GIPHY search → curated fallback. */
export async function searchGifs(query: string, limit = 24): Promise<GifItem[]> {
  const q = query.trim();
  if (!q) return trendingGifs(limit);
  const key = "s:" + q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit.slice(0, limit);
  const live = await giphyFetch(`/search?q=${encodeURIComponent(q)}`, limit);
  const res = live ?? curatedSearch(q, limit);
  cache.set(key, res);
  return res.slice(0, limit);
}

/** Live GIPHY trending → curated mix fallback. */
export async function trendingGifs(limit = 24): Promise<GifItem[]> {
  const hit = cache.get("trending");
  if (hit) return hit.slice(0, limit);
  const live = await giphyFetch(`/trending?`, limit);
  const res = live ?? cached("trending", () => curatedTrending(60));
  cache.set("trending", res);
  return res.slice(0, limit);
}

/** Category GIFs. "trending" → trendingGifs. */
export async function categoryGifs(cat: string, limit = 24): Promise<GifItem[]> {
  if (cat === "trending") return trendingGifs(limit);
  const meta = GIF_CATEGORIES.find((c) => c.id === cat);
  const key = "c:" + cat;
  const hit = cache.get(key);
  if (hit) return hit.slice(0, limit);
  const live = meta?.query ? await giphyFetch(`/search?q=${encodeURIComponent(meta.query)}`, limit) : null;
  const res = live ?? curatedCategory(cat, limit);
  cache.set(key, res);
  return res.slice(0, limit);
}

// ---- recent GIFs (localStorage) ----
const RECENT_KEY = "chatsapp_recent_gifs";
const RECENT_MAX = 24;

export function getRecentGifs(): GifItem[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((g: any) => g?.url) : [];
  } catch {
    return [];
  }
}

export function addRecentGif(g: GifItem): void {
  try {
    if (typeof window === "undefined") return;
    const cur = getRecentGifs().filter((x) => x.id !== g.id);
    cur.unshift(g);
    localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
  } catch {}
}

export function clearRecentGifs(): void {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(RECENT_KEY);
  } catch {}
}

// Auto-generated curated GIF library (GIPHY CDN, verified working)
// Format per category: [gifId, title]
export const CURATED: Record<string, [string, string][]> = {
  "cat": [["tphCApwvdtC1VJabZ1","Bailando Ai Dance 2Banana1"], ["15UbO1LY4O2Fxw8gnI","Cat Sigma Jawline"], ["NAdEYIRFMCBhMGkXSq","Orange Mma Kitten"], ["GK7dGndK4kyOozR9Xk","Respectivecollective Dance Ai Kitty"], ["pY8jLmZw0ElqvVeRH4","Cats Memes Funny Cat"], ["Sp2uxjkB3iKWodMtBd","Extremeimprov Cat Kiss"], ["F2h2LVIfoLa4y76GdC","Simba Cat Fluffy Boss"], ["VkpfO6W4D7yB7vSjXy","No Wtf Black"], ["62bRBJV1ccA9nyLmKy","Crying Cat Thumbs Up Holding Back Tears"], ["T4EbQMTAUROJ3JPUVG","Igmiral Shreyhu Cat Serious"], ["jnKo5wjTKRM1FkuFfx","Meme Enjoying Cat"], ["UuzwffmvtBNGjYyEUe","Animal Kedi Elenceli"], ["gSQp32H82WETR5EFO6","Tounge Freaky Cat"], ["cbm0J4DEIqKHsKxYHA","Ai Cat Funny Meme Boxing"], ["LBb735fuQwRKAVzN23","Funny Meme Cursed Muhehehehe"], ["y4nk5bgwpWL6T5Ax9y","Animated Cat Meme Hi"], ["ytu2GUYbvhz7zShGwS","Muah Cat Kiss Lovely"], ["wr7oA0rSjnWuiLJOY5","Cat Meme Wilfrosty Mr Fresh"], ["QsomqbDcRm9xMFxJMu","Karbit Dafinazkr Take This Flower"], ["GTywSIhrVUo0p5gDJE","Cat Meowstars Sc"], ["WykUqckDqi95YIqtFZ","Cat Salam Salamualaikum Alaikum"], ["A0Zt7yuDULiy4ofmVD","Cat Happy Mkl"], ["MMquV2oInK40V86Q7g","Kitten Cute Cat On Throne"], ["vFKqnCdLPNOKc","Cat Lol"], ["lSDZ6ee0z486ny4c4N","Simonscat Funny Meme Haha"], ["LptvdvZLb3KLHJLc0W","Catsmovie Cats Movie Catsmovie"], ["TvcgN13kbra8RhpWtI","Dojacat"], ["WNGxiOtIJ9bR1Wikia","Morristhe9Livescat Morris The 9Lives Cat Approve"], ["FPjJAvmoFnclM97WQP","Infinitycat Infinity Cat Colleen Green Maybe Ill"], ["ETkTH9LIMjqrpCLHKf","Catstevens Harold And Maude Cat Stevens"], ["6tWdflf2d1ogBjv2wU","Natgeowild Nat Geo Natgeo Tv"], ["8DbyRxs5VfQ7f7EXX0","Pbskids Donkey Pbs Kids Hodie"]],
  "congratulations": [["ely3apij36BJhoZ234","Good Job Congratulations Otter"], ["AykC8cvMOWBOq7d52T","Congrats Stegosaurus Steggy"], ["8UawYSsIBtCJIOQEAl","Sendwishonline Congratulations Cards Sendwish"], ["Ef5auceg5gB9FNqYqP","Enchantedmedia Animation Celebrate Birthday"], ["jmqsrnIINOGG1lqKj9","Wegmans Congratulations Wegmans Wegmansfoodmarke"], ["g9582DNuQppxC","Hero0Fwar Karmawhore Rhyming"], ["BqOdoD5GDEO6k","Congratulations"], ["DYPP3JTXIvPT3CPGhE","Sendwishonline Congrats Great Job You Did It"], ["F7JHDDqWaSPaglz24x","Onesquigglyline Celebrate Congrats Congratulatio"], ["7jyUZqUSrpyWUm754m","Celebration Congratulations Bouquet"], ["TpNApZpyKgxlhYpXdv","Jwilsonpix So Happy For You Jess Wilson Remote P"], ["hv14mGOF3MY7wDKPkE","Greetpool Congrats Congratulations Gif"], ["ihef2mzZVbV4FygisP","Happy Superproudofyou Super Proud Of You"], ["879RsXB8GvEuY95LNl","Enchantedmedia Animation Celebrate Birthday"], ["Ov09jGgEThFKpxZ9eC","Sesamestreet Sesame Street Grover"], ["AIcu7gsqX0EVyAdrHl","Sendwishonline Congrats Congratulation Congro"], ["xT0xezQGU5xCDJuCPe","Congratulations Congrats"], ["J5Xr9k7qK5KGRi45vp","Appreciate Coworkers Co Workers"], ["AbM71atR2TJQq8c7vw","Onesquigglyline"], ["mzZbByY3c3eoqy9CaP","Fyiguys Happy Celebration Celebrate"], ["NbBJqE9xIoIeG0egGH","Peakedroofing Congrats Peaked Roofing Congratspe"], ["BPJmthQ3YRwD6QqcVD","Hbomax Hbomax The Great Gatsby 2013 Thegreatgats"], ["3o6fJ1BM7R2EBRDnxK","Congratulations Congrats"]],
  "cricket": [["11R5KYi6ZdP8Z2","Crickets"], ["13pYM0PkFN6drgMS3V","Ms Dhoni Rohit Sharma Nozwin"], ["Oa8bLAP2lOLdSFpgiR","Win Winner Bd Cricket Dance"], ["THIImhwN2fV2q8EOvq","Dodo Australia"], ["rKT1SHTskbdwD9jbud","World Cup 2026 T20"], ["Ru3CP6hc8NJJwSBxTw","Somersetcountycc Cricket Somerset Sccc"], ["jsTgk136sV71K","Highlight Shane Cricket"], ["eR5WccVCNS9lFMX724","Cutie Insect Bug Party"], ["h6Zm9Rxh3NSqA7Vftw","Homeofcricket London England Cricket"], ["zrS3WH7CMqtAA","Field Cricket Swagger"], ["TF6Jg1Mae68U743S8q","Cricket Treefrogs Twickenhamcc"], ["nn92TQlGnSWXnRGhxL","Cricket Abhishek Sharma"], ["dBK6RSwc8VBvG9t5yG","Rcbofficial Cricket Ipl Bengaluru"], ["qDfeKN1lCN6sE","Field Cricket Swagger"], ["sppXiaAA7ZJ5XetbSO","Amarillocollege"], ["X9ehybGUXWZWw","Catch Highlightgifs Cricket"], ["ff7o2Hmk4YhGWOCWop","Amazonminitv Cricket Sixer Amazon Mx Player"], ["LkSmv0KEK9H3nmNm0c","Gptv Cricket Grilo Silenc"], ["ULt1SjScVAJsGXEmTs","Allietheellie Ellie De Olifant The"], ["z6Noag8uBbDyuTGPGT","Aviradigitalstudios Soccer Baseball Cricket"], ["fsTQcL5JkgNdS","Disney Cricket Pinocchio"], ["NitUKhyVlDseQ","Michael Square"], ["kyQzdozM3ESnjLcPqo","Cricket Lifebuoy Dothelifebuoy"], ["y3m2O9swqsKNG","Stare Kevin Hart"], ["txYfk0eh28xbG0CCoZ","Homeofcricket Cup Stokes Ben"], ["xGae9vsuitlWOxL8gH","Kingfisherworld"], ["5xERKaiEBxkzNwogUB","Rajasthanroyals Moochu Singh Driving"]],
  "dance": [["ujTVMASREzuRbH6zy5","126Bpm Dancingatclub"], ["3UkqVq3F50bVCi9URl","Dance Cat Dancing Chinese Song"], ["PssxFbeKxKAESH1XVx","Dance Toy Story Woody"], ["14qb1Uhf40ndw4","Dance Crazy Gru"], ["tsMAPZ96MHPlvP6OtE","Dance T Twerking"], ["sUmfD5CnsTFyvnYGcd","Dance Rain Reels"], ["V7jkATiqn3mRie2LI2","Lunch Tre Instagram Shrek Viral"], ["RLcQGYmQU36d3FceiP","Workingtitlefilms Mr Bean Rowan Atkinson Beans H"], ["5xaOcLGvzHxDKjufnLW","Thegifys Gifys"], ["SGkufeMafyuBhIw796","Dance Monica"], ["LML5ldpTKLPelFtBfY","Dance Chika Kaguya"], ["WmkqburJqXziM","Dance Fresh Prince Of Bel Air Carlton"], ["EN07uCL8sMNj26GO2g","Dancing Dancingdog Gonryon"], ["GK7dGndK4kyOozR9Xk","Respectivecollective Dance Ai Kitty"], ["2LmgEyEwBQvtM8Le9M","Party Happydance Makemefeel"], ["l3vRlT2k2L35Cnn5C","Dance Donald"], ["1jacd4JEUM03KcdORi","Reaction Mood"], ["HIINnCqY3HpMYudYQn","Dancing With The Stars Guillermo Yacht Rock"], ["8m4R4pvViWtRzbloJ1","Dancing Kermit"], ["1TM8yYG2kMInpK69Rc","Trending Viral Bakerxr"], ["3ohhwfAa9rbXaZe86c","Dance Halloween Twerk"], ["SFJNNpfywYl3qYGk1E","Penguin Chicken C"], ["UZxzsNx1kpZZwTCSSp","Viral Dance Instagram Lunchtre Little Girl"], ["7sYgj8MHgrto9tZthQ","Dancegavindance"], ["iWlY7z5YYOtHeSMx5K","Just Dance Justdance Justdance2026 Jd26"], ["3ohc0ZorDPrDX46jIs","Mothermayidance"], ["DED9Io0FbQXCQq44NM","Chicagodancecrash Goodbye Goodnight Curtain Call"], ["ckqDWRvXTYUWEhPJqj","Nbcworldofdance Nbc Worldofdance"], ["VwLzSW0bPiuIuUQbcl","So You Think You Can Dance Sytycd Danceonfox Soy"], ["l4FGFnwyF6lKlnE1a","Art Glitch Abstract"], ["D5X7c2D9TbTu3eAvsD","Troyesivan"], ["vyfICe0OfKKMUvTx04","Panicatthedisco Panic At The Disco Sugar Soaker"], ["VTwjHm9xiFAFadh2Dh","Spinninrecords Kratex Tambdi Chaamdi"]],
  "eid": [["Sr5C0PlXI3cuTlpfYZ","Vitallifeuk Personal Sanitiser Personalitise"], ["l378zuYtIMtqd6ErS","Eid Mubarak"], ["a3dc1UPHpKtW","Celebration Lights"], ["1jCOs3HLZ3hFjQZz7z","Emiratesnbd Enbd Emiratesnbd Emirates Nbd"], ["9lbQWjpO6O3bM5Ng56","Emiratesnbd Enbd Emiratesnbd Emirates Nbd"], ["zsUVC7OfYL9eGLuadS","Anchor Kuih Anchorraya"], ["BYqgEHLjEGJlC","Eid Mubarak Happy"], ["4ly4YPaqVHryWrgmyI","Emiratesnbd Emiratesnbd Emirates Nbd Enbdeidalad"], ["xT9IghJhA2GcHj8aGs","Eid Mubarak"], ["Xu6XWL3KpsIrYvq6Qy","Emiratesnbd"], ["7DujUrX3lySxa","Eid Al Adha"], ["1AbxqMrsy8AEptW6Ae","Emiratesislamic Eid Al Adha Mubarak"], ["3l8fh2eueFBfqhDTo2","Surveysparrow Eid Mubarak Ramzan"], ["H72Gn45kBnACctpcev","Eid Mubarak Al Fitr Hanif Sanket"], ["1ZN5TyLURcjPx0BEwX","Intoaction Heysp Eid Alfitr Eid22"], ["jxfvxapAoXKuUmtcUH","Aleph Labs Eid Aleph Alephcelebrates"], ["YycNaG9z1cW8hS7isl","Emiratesnbd"], ["VJd1xmF06knGpOZ1j8","Eid Bangladeshi Jamat"], ["KxI13y9eWmmSJSrfom","Emiratesnbd"], ["uwIIaw9IUNWmc","Pictures Mubarak Status"], ["xUA7aYx7nPwzRy5G5a","Eid Mubarak Al Fitr Blessed"], ["3o7aCYn8LkMAHV3laE","Holiday Islam Eid"], ["xVMB0hPqqCWvMEh6BL","Islamicmuseumaustralia Eid Eidmubarak Islamicmus"], ["9NkQRpYSjqqac","Codes Friendster Tagged"], ["kEQKHu3wtUoCQbs0Xx","Why Question Eid"]],
  "funny": [["fHoqSTQTsgSbfUoiTw","Funny Fat Speakwithbody"], ["gKHGnB1ml0moQdjhEJ","Moodman Reaction Dog Zoom"], ["fUYhyT9IjftxrxJXcE","Moodman Funny Lol Laughing"], ["de9SDw6PGRsubN1o3X","Reaction Mood"], ["vgPptRu3quuHYFQ1GH","Islandtouchdance Punching Kicking Dont Mess With"], ["Rlwz4m0aHgXH13jyrE","Justviralnet Funny Cool Monkey"], ["SggILpMXO7Xt6","Sblobbery Clbarrr Idzz"], ["okfvUCpgArv3y","Funny Happy Excited"], ["8lgqAbycBjosxjfi9k","Moodman Funny Dog"], ["ZqlvCTNHpqrio","Laughing Despicable Me Minions"], ["WXB88TeARFVvi","Cat Funny"], ["GOeFqBsdplHseqWctY","Art Police Mrperak"], ["X7Bckr1JaJS1opWTzO","Apcgifs"], ["lv8qrl7TTuFj6QN3bM","Pinebill Cute Dog Puppy"], ["xqBpxjk7CXLtm","Funny Dance Weird"], ["5zorjbJswGMCaymnrI","Laugh Pig Gas"], ["nU0EccnuhJa5ofFr6v","Kokumiburger Funny Fun Good"], ["12PIT4DOj6Tgek","Happy Vintage Laughing"], ["CciM7ZRcjqY6P7HHdd","Cnstix"], ["BY0I4J5rnxd8k","Funny"], ["gj0QdZ9FgqGhOBNlFS","Lol Laugh Laughing"], ["13BwjdpxACoBPO","Weird Funny Odd"], ["as521kub4b68hW2JhK","Funny Dog Lol"], ["rgAd7jWyJyo8M","Cat Funny"], ["W3gBn2iBSrqQYyTX6x","Afv Dog Summer Dogs"], ["LnXBWuuRjqURQ1VxJj","Funnyordie"], ["eHiqA7HoUk4HhxJvvo","Funnyindian"], ["h1a0KjWi6ol9dgoV5g","Kindafunny Jumping Kinda Funny Andy Cortez"], ["RJ8Te743uKEGdPlgC2","Jefferiesshow"], ["dtCwmqGyYhqr6IB41W","Outmatchedfox Outmatched"], ["MUEEDRCACSU7Xq6HqV","Tennistv Hot Ice Heatwave"], ["pIjaQrJBqnGYOtyaLF","Revolttv Nfs No Funny Shxt 03 Greedo"], ["6NotAOjGYGRzgDkyYm","Viralhog Reachoutv1085732"], ["61Els1Hr43O6oy7iq9","Lebrajolie Lebra Jolie What Kinda"]],
  "good-morning": [["AVygNA1jP5jfiAPwcN","Cc Crazycat Bcandcc"], ["DMnQAyk56tfX0O436G","Yevbel Sunshine Sunrise Rise And Shine"], ["knrIbZDD4qfaKboUgI","Start New Day Buen Da"], ["M9BoF4CceHujsHxpXA","Veefriends Good Morning Gm Veefriends"], ["8eoyDtGnfC7kI","Love Good Romantic"], ["3hyAe7gBLdG80","Sun"], ["MWz9Dd3sETjoAhpQKS","Veefriends Good Morning Gm Veefriends"], ["klL4DXy3Gup1d57mI7","Sun Good Morning"], ["XWgADN66uIR1K","Good Pictures Pinterest"], ["cjJK7PYUl6g8NHa9yU","Good Morning My Friend A Lil Coffee For"], ["JoHCsfie23fag","Tired Morning Looney Tunes"], ["WL4tgBxNHUucaIh5BL","Dasvibes Good Morning Rise And Shine"], ["2bJWG8k0HAktq","Kristen Stewart Lol Celebs"], ["DUdLCTXRSgjNPuqwff","Good Morning Gm"], ["ZdNdNH9LehfMJOVnaP","Swerk"], ["HkGxrUHR0tRO32XCAs","Theecards Good Morning Happy Flowers"], ["u2nzxwnIho9fHBRdTZ","Sylterinselliebe Good Gm Bomdia"], ["SYxunpDev3y0w","Good Images Morning"], ["hXCGdsSC3MKuqZv59G","Morning Good Early"], ["Js7k1D3Jenq3MUp65Z","Morning Good Early"], ["DbBpB5CD2FJRwSmpx6","Veefriends Character Veefriends Series 2"], ["11MHmQ7Y5BgP6g","Good Pictures Morning"], ["ItK5THepoZHLWQXqav","Popjoyid Bunny Popjoy Bunnimeme"], ["jfzvC4r5b8JTlqx3H9","Berksbeans Mornings Morning Sunshine Berks Beans"], ["j3RXuSbpXER4hCeX5F","Wednesday Morning Monday Thrursday"], ["11s8zgtzOAep7mFUW8","Goodmorningamerica"], ["312rLBL2CYVICYQWZm","Mythical Gmm Rhettandlink Goodmythicalmorning"]],
  "good-night": [["eoa4dTj13g3Js8qSh3","Good Night Goodnight Sleep Well"], ["LNLySBhKvwXhzFb3MT","Ollie And Lou Night Nighty Nite"], ["IwXpyMicMBcx5P4wLB","Berksbeans Relax Goodnight Good Night"], ["Md43W2Q9mwNdO1ARzu","Swerk"], ["ZOwljDSMNr1rV76DMc","Studiosoriginals"], ["gtcw5pPccb2eK89eDc","Veefriends Veefriends Emu Enamoured"], ["4ROYBUekIzcchudOu0","Good Night Goodnight Sweet Dreams"], ["ayRF7VrgjtVrvneE5u","Ollie And Lou Good Night Goodnight"], ["sO2gMnpdsgP87YwfzE","Good Night Girlfriend Daisy"], ["DRIVkLoKs8Gpi8QpXH","Veefriends Gn Go To Sleep Chat"], ["OjmrBW4ZQbWjkq6RkC","Tired Sleepy Good Night"], ["ogf17Ahw5ihh6XstUW","Animation Good Night Sleeping Fox"], ["N8owdGWtewXAuR0CWq","Crazycat Sleepycat Bcandcc"], ["JMqAGatY64yq45mBBs","Mockofun Night Good Sweet Dreams"], ["t0Xqzzvk9majD9bdtl","Good Night"], ["GiZzkhK5bpTJn6y7ve","Good Night Buenos Noches Sleep Activated"], ["e5I0YiwNYkG5y","Good Night"], ["cMUpm2AAuRMpWahqgI","Bye Good Night Bed"], ["GPlc2OUqwNlU85TV8b","Happilo Good Night Goodnight Sweet Dreams"], ["hXTsVGndgr1oMC2F9t","Pastel Mountains Nissart"], ["zNhYGCtN69wPGcTwwX","Christian Peaceful Theartistilani"], ["5VW8fE6NwtLnWs1g0j","Veryluckyclover Miss You Missing Homesick"], ["r5tQ7yjGC0v7WlxdLO","Flannelgo Sleepy Cute Dog Flannelgo"], ["QSNAnnrIcuIcViEuS3","Unscreen Sleep Goodnight Good Night"]],
  "happy": [["3orieWKVD1LN9uoDaU","Season 5 The Simpsons 5X5"], ["Mjcv3Dg6irEG6Bb9In","Sendwishonline Happy Birthday"], ["dwI09ZWZ93gIt7uhQm","Sendwishonline Happy Birthday Cake Stars"], ["aQYR1p8saOQla","See Heavy"], ["As3pqYwhNl3EiKKMCf","Sendwishonline I Love You So Much"], ["ppSjX2iP9Ec1ExJRsV","Happy Dance Cartoon"], ["okfvUCpgArv3y","Funny Happy Excited"], ["9KLPmWoiiPZvmJKQ14","Happy Hands Paws"], ["23jEmjPf4RkR3gWizv","Happy Birthday Birthdays"], ["qdxDab2ZKCLq3qI6kO","Happy Dance Snoopy"], ["BWplyaNrHRjRvweNjS","Coopprix Happy Cute Sloth"], ["kPIrzoMdhZJisCre2S","Greetingsisland Happy Celebration"], ["cXblnKXr2BQOaYnTni","Theoffice The Office Tv Moroccan Christmas"], ["EjMxK3pUeAC1MN5W9H","Happy Day Days"], ["OTjlFt6m9KIPo4fJAI","Sendwishonline Love Heart 3D"], ["cDMYFhpEAnE9CkV6yS","Digitaldiscovery Happy Cute So"], ["PHiBDPfXs7EBjmxE3B","Love Happy Kisses"], ["CNNK7s0oINp0SyenZL","Happy Birthday Wishes Messages"], ["IcJ6n6VJNjRNS","Cat Dancing Happy"], ["kkGuCMkjMdH0s","Happy"], ["bpTL6wXRuMQpMIVduB","Cheer Squid Game Celebration"], ["fUQ4rhUZJYiQsas6WD","Muppetwiki Sesame Street Muppets Elmo"], ["CKzqGQ1GDMAl4HQifG","Happy Birthday Cake"], ["fPRwBcYd71Lox1v7p2","Mowillems Mo Willems Mowillems Williams"], ["52gv8CyJMggiNpj6I3","Happy Dance Nuts"], ["F3h8ekM8o0zvwVY0Ry","Bideninaugural Celebrate America Joe Biden"], ["uN4DFkbaAbvApuHVz1","Macmillankids Dogtown"], ["MC55LfpN6jkWLBfuoq","Mergui"], ["yTia08DBXk2xcisVe7","Bounce Tv Gross Ew Eww"]],
  "hello": [["UBjcywH1QTCUxBB75b","Pillsburyus Doughboy Pillsbury"], ["ASd0Ukj0y3qMM","The Simpsons Hello Hi"], ["Zwkxqa2c6C4avWnrq3","Tikiindia Animals Dogs Puppy"], ["6EDGSznQA5kVCa0DfD","Hi Door Elmo"], ["xT9IgG50Fb7Mi0prBC","Hello Hi Wave"], ["dzaUX7CAG0Ihi","Hello Hi"], ["28GHfhGFWpFgsQB4wR","Foxhomeent Hello Friday Mrs Doubtfire"], ["S2IfEQqgWc0AH4r6Al","Minions Despicableme Despicableme4 Despicablemem"], ["qGvmdlfJ0FtBSwxqA3","Hello Hi Wave"], ["fPcYh86JNFbMUfkd61","Veefriends Character Veefriends Jolly"], ["1in10D39NhoNq","Hello"], ["Cmr1OMJ2FN0B2","Hello"], ["LPFNd1AJBoYcVUExmE","Waving Lizard Hoppers"], ["TcQnZ7wN7HEDH4d4UM","1Huddleplay Hello Are You There 1Huddle"], ["z2UMlACEJBF8dx58Y4","Amandaceemedia Hello Knock Anyone Home"], ["vSid82Egm63bA8Zl2c","Hello Wave Skeleton"], ["CK0Eg2ymtfzTO2yVJD","Are You Dead Alive"], ["brsEO1JayBVja","Hello Waving Blue Bird"], ["eoVusT7Pi9ODe","Robin Williams Wassup"], ["2oyfwkRTgdfMW7FTHd","Biscuitfish Hello Anyone Anyonethere"], ["IThjAlJnD9WNO","Bear Hello Waving"], ["yHoUhVaafTmoF1TGnH","Peeweeherman Pee Wee Pee Wee Herman Peewee"], ["WX1Ur5LsSTVmW1jEqH","Hellomedia Deepfake Distressed"], ["jnKaY4LMTM4R1cMntk","Atthellolab Dascha Polanco Spilt Milk"], ["ItYvGef0uFuMIMAy6k","Beastieboys Beastie Boys Futterman"]],
  "love": [["t8xgPfC5oNIRMrNooe","Boyfriend Lover Bf"], ["MKuEHA4bHXUhwXhovI","Sap Love Sharing Sharinglove"], ["RB46T9ysjzDEs","Ldr"], ["RH7e0AYVpzSBeGDxF3","Heart Red Shape"], ["9wYm6EKAnaDPIjfHek","Allthecoffees Love Iloveyou Loveyou"], ["jGrsj9ce6lHBGjQYpg","Bichimao Bichimao Cutecats Bichi Mao"], ["Z21HJj2kz9uBG","Animation 2D"], ["0igHDNPGNJ7jU9xcEZ","Heart Sweetheart Sweety"], ["bSLJZSX04jrK8","Love Black And White Kiss"], ["PHiBDPfXs7EBjmxE3B","Love Happy Kisses"], ["paXjnIZYvglz2","Love Animated Heart"], ["R6gvnAxj2ISzJdbA63","Warnerbrosde"], ["TcXuk3AuJpekE","Love"], ["4N1wOi78ZGzSB6H7vK","Friends Sad Bury"], ["n9HfdJCqnh01e99KtB","Mockofun Love Heart Corazon"], ["HSCZMUa1ao17h7l5mg","Love Heart Red"], ["Zl7u48zLVFgLpRwq6f","Rose Rosa Rosw"], ["nk3zweDSf57PrKcyRP","Neighborlynotarynyc Love I You"], ["s6fnVyWTfM2nUKuMVY","Lindadurbesson Hug Couple Relationship"], ["4asRlBKdJaPeBahjcL","Linefriends Love Heart Conini"], ["OTjlFt6m9KIPo4fJAI","Sendwishonline Love Heart 3D"], ["FDh2DGsNR4d4TFv890","In Love Decordeco Cute Penguins"], ["LbC9yf16pIS74lXTDc","Poochofnyc Littlefreddietinkles Freddietinkles"], ["7jJgzTGMrwrnHDl9cw","Sendwishonline Love I You"], ["j0qLWsg1zE7xTW0pwm","Driven Lee Pace Corey Stoll Driven Movie"], ["Hm9zQZRc3kY82xj0ZQ","Loveislandusa"], ["vzetPyYkq9qHpo8yYr","Loveislandau Loveislandau"], ["Z98T4K4zUlAKEvM0Po","Lovetripparis Freeform Love Trip Paris Lovetripp"], ["AbZMp6oqhReM9PLUJl","Ringopeaceandlove Ringo Starr Ringostarr"], ["uw9aiTUH1VFCPsd8d8","Loveyourmind Jordan Chiles Love Your Mind"], ["HIBMHV1tQrRIV50mGv","Modernlovetv Modern Love Judgement Free Zone You"], ["tIGjcWaxuoaXtXjwI6","Famousinlove Drama Romance"], ["cM5pOZzypYnUXVzR0r","Fx Networks Love Story"], ["YO9kvJkrc1JJKDYOUk","Lovelifeonmax Anna Kendrick Love Life Lovelifeon"], ["ujm9brbzXi4A79PGYt","Hollywoodlovestory Party Viceland"], ["88mfOaMTq5SjJQoafr","Lovedeathrobots"], ["G2ifzBAZ3J1QXwHdXQ","Twloha"]],
  "party": [["blSTtZehjAZ8I","Dancing Dance Party Clubbing"], ["IwAZ6dvvvaTtdI8SD5","Theoffice The Office Tv Michaels Birthday"], ["61374X6M1XFHJmWYJG","Dog Model Victoriasecret"], ["EktbegF3J8QIo","Pokemon Pokmon Gif"], ["3EfgWHj0YIDrW","Dancing Party Minions"], ["2LmgEyEwBQvtM8Le9M","Party Happydance Makemefeel"], ["xUA7aT1vNqVWHPY1cA","Movie Comedy Wedding"], ["13Iu9mjLpXF0ek","Dancing Party Despicable Me"], ["w5eFyOHmkS8uc","Dancing Party"], ["f2jmSnFFSC3vnTNshV","Drunk Drinking Happy Hour"], ["s2qXK8wAvkHTO","Party Birthday Celebration"], ["26tPghhb310muUkEw","90S Retro Commercials"], ["atQF1zaSGq8s8","Dancing Nintendo Mario"], ["locytmihz2ZvhPBe7U","Universalmusicnl Mood Dansen Danst"], ["yoJC2GnSClbPOkV0eA","Excited Birthday Yeah"], ["5xaOcLGvzHxDKjufnLW","Thegifys Gifys"], ["59dqByqKDGGBUfGXw4","10Photos Stinky Mushy Tenphotos"], ["6KifWEyqZ1A3kw2P30","Toptalent Americas Got Talent Audition"], ["l0MYt5jPR6QX5pnqM","Party The Office Hard"], ["LUhUvH4BsfE9USnlPd","Tvland Women Tv Land"], ["vyxos9QyesGZalcdX6","Tiktok Disco Spinning Dance Guy"], ["zINs6k7lwfawSbLOIc","Happy Hip Hipdance"], ["3KC2jD2QcBOSc","Solarimpulse"], ["HloNK1z39EkEQcreIo","Hbo White Lotus The Thewhitelotus"], ["xT0xeu9BUb3Yh4Wrfy","Searchpartytbs Annoyed Elliott"], ["2bNe8g1Ba6WS2AqgSg","Halloweenparty"], ["jkHbgcVeDqlC1jpiq0","Blackparty Hotline Black Party"], ["Lr9qepE1ydlw6RaOVY","Partyoffivetv Freeform Party Of Five 5"], ["TOzgxpSBQuiB12tL3A","Partydown 306 Party Down 03X06"], ["R47lRZNFeDf03zNa3T","Puddlespityparty Pityparty Waterworld Kevincostn"], ["W2zlwgC88th824D6iZ","Vanityfair Hustlers"], ["DjrmSv4Ni5W7Tu2Dgx","Thedemocrats Democrats Dnc Dncgif"], ["1dJVc9DCW0YcBvytJg","Bacheloretteweekendcmt Cmt Bachelorette Bach Wee"], ["Uqmpz1vk9Orsl6LeiQ","Wta Ostapenko Jelena Penko"], ["aNS89vxpQI7Pk9PdDw","Cobra Starship Cobra Starship Party With You Par"]],
  "ramadan": [["yDO5MsGHxi4tutTE8z","Trt Network Trt 1"], ["ZENILFZuDh0C3C4GSq","Traveloka Ramadan Ramadhan Traveloka Dulu"], ["0OCnTgKUO6mkufLk3z","Ramadan Ramadankareem Ghazaraza"], ["3l8fh2eueFBfqhDTo2","Surveysparrow Eid Mubarak Ramzan"], ["mXexyl4GWNgrwGuiRs","Emiratesnbd Enbd Enbdramadan Emiratesnbd Ramadan"], ["XjY0At5b0k6QDbCfYn","Bankmuscat Muscat Bankmuscat Bank"], ["Bq9yn72PluhCK4yj74","Trt Network Trt 1 Din Ibadet"], ["vmUqqP9AbFhQO9yQtu","Trt Network Islam Muslim Trt 1"], ["1tnkMflHMbD1Gv7oH3","Umrah Omra Omraonair"], ["CJL3dDPaU5YiedfQFg","Launchgood"], ["96VNU17xaRwwGLs4yh","Trt Network Muslim Trt 1 Ibadet"], ["BL3iBpiKae7LeIcG28","Trt Network Ramadan Trt 1 Ramazan Sevinci"], ["VJd1xmF06knGpOZ1j8","Eid Bangladeshi Jamat"], ["lSDWlwWXJtMqLjH379","Dbsbanksg Eid Hariraya Dbsbank"], ["jLiyQNmgTAQEM","Thank You"], ["1ZN5TyLURcjPx0BEwX","Intoaction Heysp Eid Alfitr Eid22"], ["JspA4xuCUGZfzc5cbs","Emiratesnbd Enbd Emiratesnbd Emirates Nbd"], ["iqgc8925z7h9S","Card Send Option"], ["MHcZ7PDaub9F77AXbG","Telekommalaysia Ramadan 2026 Unifi"], ["4MWl3Uxpdw07EyLRE2","Evite Eid Ramadan"], ["11SOLHsvd3zFB7fuxq","Quran Ghazaraza Qoran"], ["w1MxOeBI9L0xypWWMa","Theecards Ramadan Kareem Theecards Greetings Ift"], ["W68oHIJUlt7WM","Picture Ramadan"], ["WtBiA8PT8QMqQ","I Love This Ramadan"], ["EeI9JngTX5d3kXW8Kl","Ramadan Ramadankareem Ghazaraza"]],
  "reaction": [["gKHGnB1ml0moQdjhEJ","Moodman Reaction Dog Zoom"], ["UpobWd0mSpRfO","Kiss American Psycho Movie"], ["8ac9tQi8GtuJaW8HBJ","Flight Flightreacts Ftc"], ["xkmNi280NkrcY","Realitytvgifs Reality Tv"], ["111ebonMs90YLu","Thumbs Up"], ["RrVzUOXldFe8M","Excited Yes Nicolas Cage"], ["dV2NxXKsLnyG39Mw23","Yandy Com Lingerie Yandy Yandycom"], ["YrD1PQldGsstG","Girl Mrw Door"], ["Qf1glkIPvRMlXOO1Pv","Reaction Abugif Abuabdulkareem"], ["sWBzg2D15WwQjHcxbt","Smirk Corgi Mimibarbar"], ["8qABb3dgjun8PdNirg","Reaction Mood"], ["fhdTI42Ls510Jzt85V","Brakenlabour Tongue Out Bosco Bears Jack Bergin"], ["IYjcAIri8C7f8LvLor","Crazy Surprise Thenseven"], ["xSM46ernAUN3y","Stoner Sees Isopropyl"], ["Fu3OjBQiCs3s0ZuLY3","Moodman Reaction"], ["gpXfKa9xLAR56","Cheezburger Applause"], ["GAtTF1kUyoMFx2QL7n","Orange Cat Tabby Chill Guy"], ["RvMsB2IktjOLbUo6bd","Instagram Insta Stangram"], ["meJN6qdG74lUKAJTQl","Dog Scared Mimibarbar"], ["Fu9EXNUgJBRBe","Reaction Kevin Hart Gif"], ["zuToboIbXRuNgXNqK2","Liproductionsstudio Anat His Princess From Nowhe"], ["PAs2yGkqu2zSmCx0UL","Reaction Cat Sora Brow"], ["UuzwffmvtBNGjYyEUe","Animal Kedi Elenceli"], ["zwp23i0bf9QPZZRVf5","Musicchoice Cody Johnson Guitar Dance Co Jo"], ["2xrdqamkdJhb5qeJbN","Houstonrockets Sport Basketball Rockets"], ["P9TfGpNFpOUWgM7VBz","Nbpa Shaq Nba All Star Nbpa Brotherhood Deli"], ["bPRp7y5gk2nIMktFZM","Nashvillesc Nashvillesc Nsc Shak Mohammed"], ["wvXt3ZLtw65p1lbFsW","Ufc Cigar Cigars Dana White"], ["t03Kewt9aVXEn8XKzV","Laclippers Dance Dg Darius Garland"], ["5vEV6GpUXQWMc3jrHY","Utahjazz Team Hype Cheer"], ["3sPmoWcrQ6Vfe84YZY","Wnba Happy Celebration High Five"], ["AFJf2hDenUwbgIpJf4","Miamiopen"], ["3tHWDhE1m8ihut3cqN","Nhlonnbcsports Nhl Jonathan Toews"], ["KYHCO8rI6djk4nK6LF","Nascar Connor Zilisch"], ["leLDEslvG4ek1vvSIB","Gatorade Soccer Celebration Assist"], ["CqT51GHKmZ73Qi6w3N","Jerseyshore Jersey Shore Family Vacation Jsfamil"], ["dWy77DWWTBQp0yImcG","Bacardi Halloween Rum"], ["dQbC2Nnniekzdqjady","Big3 Ice Cube"], ["so9bIuxK0Z9AsqI3lq","Mancity Football Manchester City Mcfc"], ["1k3um6F4CAjJ26cz5b","Desusandmero Chill"], ["fJ3I4lKTNy7YfLf2JK","Pbr"], ["IfMwBNFJAfwF7kLRYi","Newyorkredbulls"]],
  "sad": [["lGBecpB2dIMwt6ohfI","9Mc Smile Cat Sad So"], ["klu2KSBQwdYA","Sadness"], ["qQdL532ZANbjy","House Boyfriends"], ["TU76e2JHkPchG","Sad Crying Omfg"], ["10tIjpzIu8fe0","Inside Out Gif"], ["iJJ6E58EttmFqgLo96","Moodman"], ["Lz6971fkGSgCMOOncl","9Mc Cat Cry Us"], ["3oEjI80DSa1grNPTDq","Arrested Development Michael Cera George Bluth"], ["3JdZYEpHtsTXa","Sadness"], ["sLkIthus9lEwoe7PRx","Cat Pain Nub"], ["AzAa23iNkA5I6jQKmG","Bart Simpson Alone Aburrido"], ["RI8sVAn6lEyQZFpZfb","Veryluckyclover Crying Lonely Long Distance Rela"], ["q2qxiBO5prG9i","Sadness Inside Out"], ["d2lcHJTG5Tscg","Blackish Anthony Anderson Dre Johnson"], ["Ty9Sg8oHghPWg","Mrw Song Myself"], ["SrKbU4TRDgN8apkkES","Cat Sad Crying"], ["l22ysLe54hZP0wubek","Moodman Mood"], ["Qw1wF6hnNRYixpdgmH","Digitelco Digi Digilah Digigifs"], ["13t22jOjxpkAN2","Depression"], ["P53TSsopKicrm","Reaction Sad Crying"], ["fhLgA6nJec3Cw","Sad Kid Pouting"], ["lR3pWtb80Hz22UjrYj","Dog Puppy Malaengs"], ["HYWRlXalYJzaxfCPFa","Heart Iraq Alisami"], ["ISOckXUybVfQ4","Spongebob Squarepants Alone Lonely"], ["KOQ58GXlVDfU8ln8oF","Carlossadness Carlos Sadness Vidaperfecta La Vid"], ["y2cdntK3OQDwSEjnGe","Sadnuggie Devil Sad Nuggie"], ["hDzdxLmztT45Ymqsxi","Savannahconleymusic Tired Savannah Conley Being "], ["0e9FBqZvnKpH0iosoR","Littlemix Little Mix Me"], ["9iPdTSVu3LkddQCYT5","Neonrated Miles Teller Adam Driver Paper Tiger"], ["1KItO4ia3fcmDiCO7y","Ajrbrothers Ajr Blue Man Group"]],
  "sorry": [["fV8iuSEwLQ6005diSh","Sorry"], ["MW36NXIPuLhgyXhbQt","Pray Ronaldo Euro"], ["7zzjU4ToWpasY36ab4","Apcgifs"], ["L5WQjD4p8IpO0","Funny Reaction Dog"], ["dloQF2APiklC5aVvzQ","Forgive Forgiveness Windpress"], ["mWLjaAzWxeSSAK5irk","Oddbeatz"], ["LuGOqWBBW7T6nmmrfI","Hamster Doll Nissart"], ["d7fTn7iSd2ivS","Sorry Reaction"], ["zGhBJErZ0qKq6PYVIt","Pipedpie Oops Nervous Stuart Little"], ["XFKzlu9HyVplrbi3Qg","Im Sorry I Apologize So"], ["RWUqVYucDBD4A","Friends Sorry Joey Tribbiani"], ["TZoMsVsuCs5ji","Images Sorry"], ["XYEEvoX0Ub69ZgN9ai","Comedybar Please Pleading Pwease"], ["RM0FFEcOLBzEjtrbCK","Puppy Corgi Lazy"], ["uGs3nvw76BfzPWnSv6","My Apologies Sorry Cat Apolocheese"], ["m1am76VwLHNe6kOoYM","Flowers Roses Pink"], ["10OeXl1jcdvEHa0SJh","Bellsandwishes Sorry For Your Loss Condolences"], ["xT0xeGSim7Mdkc2Wru","Sorry Alan The Hangover"], ["5Gb6pmAu8o0Ba","Kitten"], ["3ohc1ffY03hnhRUyUU","Sorry Shame My Bad"], ["9JLOGsEfPjpR1179HE","Thefactoryvideo Reaction Emotions Tf"], ["lIHeeyTeNGjIt7ByYp","Sendwishonline Sorry Swo Sendwishonline"], ["cm5SlcQJ9yqSR6vfpx","Sorryforyourloss Facebook Watch Sorry For Your L"], ["yNibLXbTjGrxlCgU0D","Sorry2Botheryou Art Movie"]],
  "thank-you": [["i21tixUQEE7TEqwmYa","Theoffice Nbc The Office Tv"], ["g0kLgAN4t54RK154oA","Sendwishonline Thank You Thanks Thankyou"], ["L9M6fl68whAPxtg1sC","Eriehomegirl Amanda Kish Amandakish Eeriehomegir"], ["6KWdAGUThUgW2DptUa","Yellowcabpizzaofficial Yellow Cab Pizza"], ["xIJLgO6rizUJi","Alice In Wonderland Thank You"], ["pbSt1gcLrGvlJMdKji","Yevbel Nature Beach Waves"], ["MF9wHplBBbqwYiTTEk","Thank You Thanks Thankyou"], ["L9Q2rzzBHrfv4a1y4h","Thanks Thankyou"], ["BYoRqTmcgzHcL9TCy1","Thank You Thanks Thumbs Up"], ["aLYyJdZzzzzbx541JM","Thank You Thanks Thankyou"], ["E8rJEUMGs9cyWEtNXT","Moodman Thank You Funny"], ["a3IWyhkEC0p32","Thank You Cute"], ["R6gvnAxj2ISzJdbA63","Warnerbrosde"], ["fWfowxJtHySJ0SGCgN","Skytv Thank You Love Youre The Best"], ["wU4D0FflO5gfwfbPDN","Reaction Sticker Uzbek"], ["QmETYSzVOztxgZg3sT","Thanks Ladydrawstheblues Lady Draws The Blues"], ["26gsjCZpPolPr3sBy","Latenightseth Thanks Thank You"], ["uWlpPGquhGZNFzY90z","Moodman Thank You Funny"], ["mS2DjCw9ec0ytUXoGG","Thank You Thankyou Jashywrites"], ["igB2Th9e4nW6s","Thank You I Dont Know This Task Is Difficult"], ["3osxYdXvsGw6wT5lIY","Thanks"], ["k6InIfcm2hTFMhQeaW","Sendwishonline Thank You Thanks Thankyou"], ["Qsgkg9uX3u4Q8gqC6f","Echilibrultau Reactions Memes Emotion"], ["yDpFRI246xNLzNoaCm","Thank You Ty Tysm"], ["B1RRcwyrqcridnrPHP","Thankyouskateco Grizzlygang Tech Deck Techdeck"], ["taXVhxMA7xpTZYR93x","Arianagrande Ariana Grande Yes And"]],
  "wow": [["oYtVHSxngR3lC","Mfw Everything Reddit"], ["b8RfbQFaOs1rO10ren","Theoffice"], ["vKHKDIdvxvN7vTAEOM","Theoffice The Office Tv Episode 818"], ["M33UV4NDvkTHa","Ever Flawless Meryl"], ["xfu59Ydps8y6gLl5V3","Citihandlowy Wow Eyes Citihandlowy"], ["8DUxtTxFntY7lpJnzy","Hbomax Hbomax Satcthemovie Sex And The City Movi"], ["WuGSL4LFUMQU","Oooh"], ["dnMwfGJPdsqYEbmrD5","Wow Omg Amazing"], ["Gf4w1G89709lMQlKzO","Amc Tv Amc Networks Fearfest"], ["jrutBd1N7ZhsINAPzs","Wow Amazing Jake"], ["PUBxelwT57jsQ","Shocked Surprised Cats"], ["QUENDfi6DEMLzQ0CKt","Justin Word Oh Really Wow"], ["aWPGuTlDqq2yc","Celebrity Reshuffle"], ["kxei1ibnxITFUvvtJU","Productions Deferlantes No What Nooooo"], ["3oz8xPIblfyMdZwM8w","Wow Omg Gigi Hadid"], ["zKBwU2TSfixfz70pJG","Trurebelsdistro Shocked Thewire Weebay"], ["mJFW5AnlPMvkaolNYj","Hellosawyer Love Happy Fun"], ["lxxOGaDRk4f7R5TkBd","Strappedus Speed Ishowspeed I Show"], ["l3q2K5jinAlChoCLS","Mashable"], ["vQqeT3AYg8S5O","Gets Smart Question"], ["26ufdipQqU2lhNA4g","Producthunt Mind Blown Blow Your"], ["e8kZWeeku0pmdWViJj","Usouthflorida"]],
};
/**
 * UI-friendly wrapper used by GifPicker — accepts a full GifCategory object
 * or a plain category id string.
 */
export async function fetchCategoryGifs(c: GifCategory | string, limit = 24): Promise<GifItem[]> {
  const id = typeof c === "string" ? c : c.id;
  return categoryGifs(id, limit);
}
