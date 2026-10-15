// Deen content + calculations (offline, no backend needed).
export const DEFAULT_LOC = { lat: 24.8607, lng: 67.0011, name: "Karachi" };
const rad = Math.PI / 180, deg = 180 / Math.PI;
const sin = (d: number) => Math.sin(d * rad), cos = (d: number) => Math.cos(d * rad), tan = (d: number) => Math.tan(d * rad);
const fixA = (a: number) => ((a % 360) + 360) % 360, fixH = (h: number) => ((h % 24) + 24) % 24;

function julian(y: number, m: number, d: number) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPos(jd: number) {
  const D = jd - 2451545.0, g = fixA(357.529 + 0.98560028 * D), q = fixA(280.459 + 0.98564736 * D);
  const L = fixA(q + 1.915 * sin(g) + 0.02 * sin(2 * g)), e = 23.439 - 0.00000036 * D;
  const RA = fixH((Math.atan2(cos(e) * sin(L), cos(L)) * deg) / 15);
  return { decl: Math.asin(sin(e) * sin(L)) * deg, eq: q / 15 - RA };
}

export type PrayerKey = "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
export const PRAYER_NAMES: Record<PrayerKey, string> = { fajr: "Fajr", sunrise: "Tulu-e-Aftab", dhuhr: "Zuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };

export function prayerTimes(date: Date, lat: number, lng: number): Record<PrayerKey, Date> {
  const tz = -date.getTimezoneOffset() / 60;
  const jd0 = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / 360;
  const mid = (t: number) => fixH(12 - sunPos(jd0 + t).eq);
  const ang = (a: number, t: number, ccw: boolean) => {
    const { decl } = sunPos(jd0 + t);
    const v = (-sin(a) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
    const h = (Math.acos(Math.max(-1, Math.min(1, v))) * deg) / 15;
    return mid(t) + (ccw ? -h : h);
  };
  const asr = (f: number, t: number) => {
    const { decl } = sunPos(jd0 + t);
    const a = -Math.atan(1 / (f + tan(Math.abs(lat - decl)))) * deg;
    return ang(a, t, false);
  };
  const adj = (h: number) => h + tz - lng / 15;
  const raw: Record<PrayerKey, number> = {
    fajr: adj(ang(18, 5 / 24, true)), sunrise: adj(ang(0.833, 6 / 24, true)), dhuhr: adj(mid(0.5) + 1 / 60),
    asr: adj(asr(2, 13 / 24)), maghrib: adj(ang(0.833, 18 / 24, false)), isha: adj(ang(18, 18 / 24, false)),
  };
  const out = {} as Record<PrayerKey, Date>;
  (Object.keys(raw) as PrayerKey[]).forEach((k) => {
    const h = fixH(raw[k]);
    const d = new Date(date); d.setHours(0, 0, 0, 0);
    d.setMinutes(Math.round(h * 60));
    out[k] = d;
  });
  return out;
}

export function nextPrayer(lat: number, lng: number, now = new Date()) {
  const keys: PrayerKey[] = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const t = prayerTimes(now, lat, lng);
  for (const k of keys) if (t[k] > now) return { key: k, at: t[k] };
  const tm = new Date(now.getTime() + 864e5);
  return { key: "fajr" as PrayerKey, at: prayerTimes(tm, lat, lng).fajr };
}

export function qiblaBearing(lat: number, lng: number) {
  const k = { lat: 21.4225, lng: 39.8262 }, dl = (k.lng - lng) * rad;
  const y = Math.sin(dl), x = Math.cos(lat * rad) * Math.tan(k.lat * rad) - Math.sin(lat * rad) * Math.cos(dl);
  return fixA(Math.atan2(y, x) * deg);
}
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi-ul-Awwal", "Rabi-us-Saani", "Jumada-ul-Awwal", "Jumada-us-Saani", "Rajab", "Shaban", "Ramadan", "Shawwal", "Zil-Qaad", "Zil-Hijjah"];
export function hijri(date = new Date()) {
  try {
    const p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
    const g = (t: string) => parseInt(p.find((x) => x.type === t)?.value ?? "1", 10);
    return { d: g("day"), m: g("month"), y: g("year"), name: HIJRI_MONTHS[g("month") - 1] };
  } catch { return { d: 1, m: 1, y: 1447, name: "Muharram" }; }
}
export function moonInfo(date = new Date()) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const age = (((date.getTime() - ref) / 864e5) % syn + syn) % syn;
  const phase = age / syn, illum = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
  const names = ["Naya Chaand", "Hilal (barhta)", "Pehli Tarbeeya", "Barhta Gibbous", "Poora Chaand", "Ghatta Gibbous", "Aakhri Tarbeeya", "Ghatta Hilal"];
  return { age, phase, illum, name: names[Math.floor(((phase + 1 / 16) % 1) * 8)], toNew: syn - age };
}

export function ramadanInfo(cfg: { mode: "auto" | "on" | "off"; start: string }, now = new Date()) {
  if (cfg.mode === "off") return { active: false, day: 0, left: 0 };
  if (cfg.mode === "on") {
    const s = new Date(cfg.start + "T00:00:00");
    const day = Math.floor((now.getTime() - s.getTime()) / 864e5) + 1;
    return { active: day >= 1 && day <= 30, day, left: 30 - day };
  }
  const h = hijri(now);
  return { active: h.m === 9, day: h.m === 9 ? h.d : 0, left: h.m === 9 ? 30 - h.d : 0 };
}
export function isEidDay(now = new Date()) {
  const h = hijri(now);
  return (h.m === 10 && h.d <= 3) || (h.m === 12 && h.d >= 10 && h.d <= 13);
}

// ───────── Quran ─────────
const SN = "Al-Fatiha:7:Shuruaat,Al-Baqarah:286:Gaay,Aal-Imran:200:Imran ka khandan,An-Nisa:176:Auratein,Al-Maidah:120:Dastarkhwan,Al-Anam:165:Chaupaaye,Al-Araf:206:Bulandiyan,Al-Anfal:75:Maal-e-ghaneemat,At-Tawbah:129:Toba,Yunus:109:Yunus,Hud:123:Hud,Yusuf:111:Yusuf,Ar-Rad:43:Garaj,Ibrahim:52:Ibrahim,Al-Hijr:99:Hijr,An-Nahl:128:Shehad ki makkhi,Al-Isra:111:Raat ka safar,Al-Kahf:110:Ghaar,Maryam:98:Maryam,Ta-Ha:135:Ta-Ha,Al-Anbiya:112:Anbiya,Al-Hajj:78:Hajj,Al-Muminun:118:Imaan wale,An-Nur:64:Noor,Al-Furqan:77:Furqan,Ash-Shuara:227:Shayar,An-Naml:93:Cheenti,Al-Qasas:88:Qissay,Al-Ankabut:69:Makrri,Ar-Rum:60:Room,Luqman:34:Luqman,As-Sajdah:30:Sajda,Al-Ahzab:73:Lashkar,Saba:54:Saba,Fatir:45:Paida karne wala,Ya-Sin:83:Ya-Sin,As-Saffat:182:Saf bandhne wale,Sad:88:Sad,Az-Zumar:75:Giroh,Ghafir:85:Bakhshne wala,Fussilat:54:Tafseel,Ash-Shura:53:Mashwara,Az-Zukhruf:89:Zeenat,Ad-Dukhan:59:Dhuan,Al-Jathiyah:37:Ghutnon par,Al-Ahqaf:35:Retile teelay,Muhammad:38:Muhammad,Al-Fath:29:Fatah,Al-Hujurat:18:Kamray,Qaf:45:Qaf,Adh-Dhariyat:60:Udane wali hawayein,At-Tur:49:Koh-e-Toor,An-Najm:62:Sitara,Al-Qamar:55:Chaand,Ar-Rahman:78:Bohat Mehrban,Al-Waqiah:96:Waqia,Al-Hadid:29:Loha,Al-Mujadila:22:Bahes,Al-Hashr:24:Hashr,Al-Mumtahanah:13:Imtihan,As-Saff:14:Saf,Al-Jumuah:11:Jummah,Al-Munafiqun:11:Munafiq,At-Taghabun:18:Nuqsan,At-Talaq:12:Talaq,At-Tahrim:12:Haram karna,Al-Mulk:30:Badshahi,Al-Qalam:52:Qalam,Al-Haqqah:52:Yaqeeni,Al-Maarij:44:Seedhiyan,Nuh:28:Nuh,Al-Jinn:28:Jinn,Al-Muzzammil:20:Chadar wale,Al-Muddaththir:56:Kambal wale,Al-Qiyamah:40:Qayamat,Al-Insan:31:Insan,Al-Mursalat:50:Bheje gaye,An-Naba:40:Khabar,An-Naziat:46:Khainchne wale,Abasa:42:Bhaun chadhayi,At-Takwir:29:Lapetna,Al-Infitar:19:Phatna,Al-Mutaffifin:36:Kam tolne wale,Al-Inshiqaq:25:Phat jana,Al-Buruj:22:Burj,At-Tariq:17:Raat ka aane wala,Al-Ala:19:Sab se Buland,Al-Ghashiyah:26:Dhaanp lene wali,Al-Fajr:30:Subah,Al-Balad:20:Shehar,Ash-Shams:15:Sooraj,Al-Layl:21:Raat,Ad-Duha:11:Chaasht,Ash-Sharh:8:Seena kholna,At-Tin:8:Anjeer,Al-Alaq:19:Jama hua khoon,Al-Qadr:5:Shab-e-Qadr,Al-Bayyinah:8:Roshan daleel,Az-Zalzalah:8:Zalzala,Al-Adiyat:11:Daurte ghoray,Al-Qariah:11:Khatkhatane wali,At-Takathur:8:Zyada ki hawas,Al-Asr:3:Zamana,Al-Humazah:9:Ghaibat karne wala,Al-Fil:5:Haathi,Quraysh:4:Quraish,Al-Maun:7:Chhoti cheezein,Al-Kawthar:3:Kausar,Al-Kafirun:6:Inkaar karne wale,An-Nasr:3:Madad,Al-Masad:5:Rassi,Al-Ikhlas:4:Ikhlas,Al-Falaq:5:Subah ka rab,An-Nas:6:Insaan";
export const SURAHS = SN.split(",").map((s, i) => { const [name, ayahs, meaning] = s.split(":"); return { n: i + 1, name, ayahs: +ayahs, meaning }; });

export const QURAN_LOCAL: Record<number, { ar: string[]; ur: string[] }> = {
  1: { ar: ["بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَـٰلَمِينَ", "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ", "مَـٰلِكِ يَوْمِ ٱلدِّينِ", "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ", "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ", "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ ٱلْمَغْضُوبِ عَلَيْهِمْ وَلَا ٱلضَّآلِّينَ"],
    ur: ["Allah ke naam se jo bada mehrban nihayat rahm karne wala hai", "Sab tareefein Allah ke liye hain jo saare jahano ka rab hai", "Bada mehrban, nihayat rahm karne wala", "Insaaf ke din (qayamat) ka malik", "Hum sirf teri hi ibadat karte hain aur sirf tujh hi se madad maangte hain", "Hamein seedhe raste par chala", "Un logon ke raste par jin par tune inaam kiya, un ke nahi jin par ghazab hua aur na gumrahon ke"] },
  103: { ar: ["وَٱلْعَصْرِ", "إِنَّ ٱلْإِنسَـٰنَ لَفِى خُسْرٍ", "إِلَّا ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّـٰلِحَـٰتِ وَتَوَاصَوْا۟ بِٱلْحَقِّ وَتَوَاصَوْا۟ بِٱلصَّبْرِ"], ur: ["Zamane ki qasam", "Beshak insaan ghaate me hai", "Siwaye un ke jo imaan laye, nek amal kiye, ek dusre ko haq ki aur sabr ki talqeen karte rahe"] },
  108: { ar: ["إِنَّآ أَعْطَيْنَـٰكَ ٱلْكَوْثَرَ", "فَصَلِّ لِرَبِّكَ وَٱنْحَرْ", "إِنَّ شَانِئَكَ هُوَ ٱلْأَبْتَرُ"], ur: ["Beshak hum ne aap ko Kausar ata ki", "Pas apne rab ke liye namaz padhein aur qurbani karein", "Beshak aap ka dushman hi be-nishan hai"] },
  109: { ar: ["قُلْ يَـٰٓأَيُّهَا ٱلْكَـٰفِرُونَ", "لَآ أَعْبُدُ مَا تَعْبُدُونَ", "وَلَآ أَنتُمْ عَـٰبِدُونَ مَآ أَعْبُدُ", "وَلَآ أَنَا۠ عَابِدٌ مَّا عَبَدتُّمْ", "وَلَآ أَنتُمْ عَـٰبِدُونَ مَآ أَعْبُدُ", "لَكُمْ دِينُكُمْ وَلِىَ دِينِ"], ur: ["Kah dijiye: aye inkaar karne walo", "Main us ki ibadat nahi karta jis ki tum karte ho", "Aur na tum us ki ibadat karne wale ho jis ki main karta hoon", "Aur na main un ki ibadat karunga jin ki tum ne ki", "Aur na tum us ki ibadat karoge jis ki main karta hoon", "Tumhare liye tumhara deen, mere liye mera deen"] },
  110: { ar: ["إِذَا جَآءَ نَصْرُ ٱللَّهِ وَٱلْفَتْحُ", "وَرَأَيْتَ ٱلنَّاسَ يَدْخُلُونَ فِى دِينِ ٱللَّهِ أَفْوَاجًا", "فَسَبِّحْ بِحَمْدِ رَبِّكَ وَٱسْتَغْفِرْهُ ۚ إِنَّهُۥ كَانَ تَوَّابًۢا"], ur: ["Jab Allah ki madad aur fatah aa jaye", "Aur aap logon ko Allah ke deen me fauj dar fauj dakhil hote dekhein", "To apne rab ki hamd ke saath tasbeeh karein aur us se maafi maangein, beshak wo bada toba qubool karne wala hai"] },
  112: { ar: ["قُلْ هُوَ ٱللَّهُ أَحَدٌ", "ٱللَّهُ ٱلصَّمَدُ", "لَمْ يَلِدْ وَلَمْ يُولَدْ", "وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌۢ"], ur: ["Kah dijiye: wo Allah ek hai", "Allah be-niyaz hai", "Na us ki koi aulad hai na wo kisi ki aulad", "Aur koi us ka hamsar nahi"] },
  113: { ar: ["قُلْ أَعُوذُ بِرَبِّ ٱلْفَلَقِ", "مِن شَرِّ مَا خَلَقَ", "وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ", "وَمِن شَرِّ ٱلنَّفَّـٰثَـٰتِ فِى ٱلْعُقَدِ", "وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ"], ur: ["Kah dijiye: main subah ke rab ki panah me aata hoon", "Har us cheez ke shar se jo us ne paida ki", "Aur andheri raat ke shar se jab wo chha jaye", "Aur girhon me phoonkne walon ke shar se", "Aur hasad karne wale ke shar se jab wo hasad kare"] },
  114: { ar: ["قُلْ أَعُوذُ بِرَبِّ ٱلنَّاسِ", "مَلِكِ ٱلنَّاسِ", "إِلَـٰهِ ٱلنَّاسِ", "مِن شَرِّ ٱلْوَسْوَاسِ ٱلْخَنَّاسِ", "ٱلَّذِى يُوَسْوِسُ فِى صُدُورِ ٱلنَّاسِ", "مِنَ ٱلْجِنَّةِ وَٱلنَّاسِ"], ur: ["Kah dijiye: main insaano ke rab ki panah me aata hoon", "Insaano ke badshah ki", "Insaano ke ma'bood ki", "Waswasa dalne wale peechhe hat jane wale ke shar se", "Jo insaano ke seeno me waswase dalta hai", "Chahe jinn me se ho ya insaan me se"] },
};

export const DUAS: { id: string; time: "subah" | "shaam" | "dono"; title: string; ar: string; rom: string; tr: string; src: string }[] = [
  { id: "d1", time: "subah", title: "Subah ki dua", ar: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ", rom: "Asbahna wa asbahal mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la shareeka lah", tr: "Hum ne subah ki aur saari badshahi Allah ki hai, tamam tareefein Allah ke liye hain, Allah ke siwa koi ma'bood nahi, wo akela hai us ka koi shareek nahi.", src: "Sahih Muslim" },
  { id: "d2", time: "shaam", title: "Shaam ki dua", ar: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ وَالْحَمْدُ لِلَّهِ لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ", rom: "Amsayna wa amsal mulku lillah, walhamdu lillah, la ilaha illallahu wahdahu la shareeka lah", tr: "Hum ne shaam ki aur saari badshahi Allah ki hai, tamam tareefein Allah ke liye hain, wo akela hai us ka koi shareek nahi.", src: "Sahih Muslim" },
  { id: "d3", time: "dono", title: "Sayyid-ul-Istighfar", ar: "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَهَ إِلَّا أَنْتَ خَلَقْتَنِي وَأَنَا عَبْدُكَ وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ", rom: "Allahumma anta rabbi la ilaha illa anta, khalaqtani wa ana abduka wa ana ala ahdika wa wa'dika mastata'tu", tr: "Aye Allah! Tu mera rab hai, tere siwa koi ma'bood nahi, tu ne mujhe paida kiya, main tera banda hoon aur apni taqat bhar tere ahd par qaim hoon.", src: "Sahih Bukhari" },
  { id: "d4", time: "dono", title: "Har buraai se hifazat", ar: "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ", rom: "Bismillahilladhi la yadurru ma'asmihi shay'un fil ardi wa la fis-sama'i wa huwas samee'ul aleem", tr: "Allah ke naam se jis ke naam ke saath zameen o aasman me koi cheez nuqsan nahi pohnchati, wo sunne wala jaanne wala hai. (3 baar)", src: "Abu Dawud, Tirmidhi" },
  { id: "d5", time: "subah", title: "Din ki shuruaat", ar: "اللَّهُمَّ بِكَ أَصْبَحْنَا وَبِكَ أَمْسَيْنَا وَبِكَ نَحْيَا وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ", rom: "Allahumma bika asbahna wa bika amsayna wa bika nahya wa bika namutu wa ilaykan nushoor", tr: "Aye Allah! Tere hi naam se hum ne subah ki, tere hi naam se shaam ki, tere hi naam se jeete hain aur marte hain aur tere hi taraf uthna hai.", src: "Tirmidhi" },
  { id: "d6", time: "shaam", title: "Shaam ki panah", ar: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ", rom: "A'udhu bikalimatillahit tammati min sharri ma khalaq", tr: "Main Allah ke mukammal kalimaat ki panah maangta hoon har us cheez ke shar se jo us ne paida ki. (3 baar)", src: "Sahih Muslim" },
  { id: "d7", time: "dono", title: "Sehat aur aafiyat", ar: "اللَّهُمَّ عَافِنِي فِي بَدَنِي اللَّهُمَّ عَافِنِي فِي سَمْعِي اللَّهُمَّ عَافِنِي فِي بَصَرِي", rom: "Allahumma afini fi badani, Allahumma afini fi sam'i, Allahumma afini fi basari", tr: "Aye Allah! Mere jism ko aafiyat de, meri sama'at ko aafiyat de, meri baseerat ko aafiyat de. (3 baar)", src: "Abu Dawud" },
  { id: "d8", time: "subah", title: "Ilm aur rizq ki dua", ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا طَيِّبًا وَعَمَلًا مُتَقَبَّلًا", rom: "Allahumma inni as'aluka ilman nafi'a, wa rizqan tayyiba, wa amalan mutaqabbala", tr: "Aye Allah! Main tujh se faida mand ilm, pakeeza rizq aur maqbool amal ka sawal karta hoon.", src: "Ibn Majah" },
];

export const TASBEEH_PRESETS = [
  { id: "t1", name: "SubhanAllah", ar: "سُبْحَانَ ٱللَّهِ", target: 33 },
  { id: "t2", name: "Alhamdulillah", ar: "ٱلْحَمْدُ لِلَّهِ", target: 33 },
  { id: "t3", name: "Allahu Akbar", ar: "ٱللَّهُ أَكْبَرُ", target: 34 },
  { id: "t4", name: "Astaghfirullah", ar: "أَسْتَغْفِرُ ٱللَّهَ", target: 100 },
  { id: "t5", name: "Durood Shareef", ar: "ٱللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ", target: 100 },
];

export const GUIDE = {
  umrah: [
    { t: "Niyyat aur Ihram", d: "Miqat par ghusl karein, ihram ki do chadrein pehnein (aurtein saada libas) aur 2 rakat nafl padh kar Umrah ki niyyat karein: 'Labbaika Umratan'. Talbiya ka wird shuru karein.", i: "shirt" },
    { t: "Talbiya", d: "Labbaik Allahumma Labbaik, Labbaika la shareeka laka Labbaik, innal hamda wan ni'mata laka wal mulk, la shareeka lak. Haram me dakhil hone tak baar baar padhte rahein.", i: "mic" },
    { t: "Tawaf (7 chakkar)", d: "Hajr-e-Aswad se shuru karein, Kaaba ko baayen haath par rakhte hue 7 chakkar lagayein. Mard pehle 3 chakkar me ramal karein aur idtiba rakhein.", i: "refresh" },
    { t: "Maqam-e-Ibrahim par 2 rakat", d: "Tawaf ke baad Maqam-e-Ibrahim ke peeche (ya jahan jagah mile) 2 rakat padhein. Phir Zamzam piyein.", i: "droplet" },
    { t: "Sa'i (Safa–Marwa)", d: "Safa se shuru karke Marwa tak 7 chakkar (Safa→Marwa = 1). Do sabz nishanon ke darmiyan mard halki daud lagayein.", i: "footprints" },
    { t: "Halq ya Qasr", d: "Mard sar ke baal mundwayein (afzal) ya katrwayein, aurtein ungli ke pore ke barabar baal katein. Umrah mukammal!", i: "scissors" },
  ],
  hajj: [
    { t: "8 Zil-Hijjah: Mina", d: "Ihram baandhein, niyyat-e-Hajj karein aur Mina jayen. Zuhr, Asr, Maghrib, Isha aur Fajr wahan padhein.", i: "tent" },
    { t: "9 Zil-Hijjah: Arafat", d: "Hajj ka sab se bada rukn — Wuquf-e-Arafah. Zawal se ghuroob tak dua, istighfar aur dhikr me guzaren. Zuhr–Asr jama karke padhein.", i: "sun" },
    { t: "Raat: Muzdalifah", d: "Maghrib ke baad Muzdalifah pohnchein, Maghrib–Isha jama karke padhein, kankariyan (jamarat ke liye) chunein aur khule aasman tale raat guzaren.", i: "moon" },
    { t: "10 Zil-Hijjah: Jamrat-ul-Aqaba", d: "Bade shaitan ko 7 kankariyan maarein. Phir qurbani karein, halq/qasr karein aur ihram kholein.", i: "target" },
    { t: "Tawaf-e-Ziyarat", d: "Makkah jakar Tawaf-e-Ziyarat (farz) aur Hajj ki Sa'i karein.", i: "refresh" },
    { t: "11–12 Zil-Hijjah: Rami", d: "Mina me raat guzaren, teeno jamarat (chhota, darmiyani, bada) ko 7-7 kankariyan maarein.", i: "target" },
    { t: "Tawaf-e-Wida", d: "Makkah chhodne se pehle aakhri Tawaf (Tawaf-e-Wida) karein. Allah Hajj-e-Mabroor naseeb farmaye. Ameen.", i: "heart" },
  ],
};

export const QUIZ: { q: string; o: string[]; a: number }[] = [
  { q: "Islam ke kitne arkaan hain?", o: ["3", "4", "5", "6"], a: 2 },
  { q: "Quran ki sab se lambi surah kaun si hai?", o: ["Al-Baqarah", "Aal-Imran", "An-Nisa", "Yusuf"], a: 0 },
  { q: "Pehli wahi kis surah ki aayat se shuru hui?", o: ["Al-Fatiha", "Al-Alaq", "Al-Muddaththir", "Al-Ikhlas"], a: 1 },
  { q: "Roze kis mahine me farz hain?", o: ["Rajab", "Shaban", "Ramadan", "Shawwal"], a: 2 },
  { q: "Hazrat Muhammad ﷺ ki wiladat kis shehar me hui?", o: ["Madina", "Makkah", "Taif", "Quds"], a: 1 },
  { q: "Din me kitni farz namazein hain?", o: ["3", "4", "5", "6"], a: 2 },
  { q: "Quran me kitne paaray (juz) hain?", o: ["20", "25", "30", "40"], a: 2 },
  { q: "Kaunsi surah 'Qalb-ul-Quran' kehlati hai?", o: ["Ya-Sin", "Al-Kahf", "Ar-Rahman", "Al-Mulk"], a: 0 },
  { q: "Hijrat kis shehar ki taraf hui?", o: ["Taif", "Habsha", "Madina", "Sham"], a: 2 },
  { q: "Pehle khalifa-e-rashid kaun the?", o: ["Hz Umar", "Hz Abu Bakr", "Hz Usman", "Hz Ali"], a: 1 },
];
export const PAHELIS = [
  { q: "Main bina pairon ke chalta hoon, bina muh ke bolta hoon, har roz tumhe jagata hoon. Main kaun?", a: ["ghari", "clock", "alarm"], hint: "Waqt batata hoon" },
  { q: "Jitna zyada nikaalo, utna bada hota jaun. Main kya hoon?", a: ["gaddha", "gadha", "hole", "khadda"], hint: "Zameen me hota hai" },
  { q: "Meri ek aankh hai magar dekh nahi sakti. Main kya hoon?", a: ["sui", "needle", "soi"], hint: "Darzi ke paas milti hai" },
  { q: "Ghar me raat ko aati hai, subah chali jati hai, par kisi ko nazar nahi aati. Kya?", a: ["neend", "sleep"], hint: "Aankhein band, dimaagh aaram me" },
  { q: "Paani se paida hota hoon aur paani se hi mar jata hoon. Main kaun?", a: ["baraf", "ice", "barf"], hint: "Thanda thanda" },
];
