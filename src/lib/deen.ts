// Deen calculations — pure logic, no backend needed (adapted from claude-frontend).
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
export const PRAYER_ORDER: PrayerKey[] = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

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

export const HIJRI_MONTHS = ["Muharram", "Safar", "Rabi-ul-Awwal", "Rabi-us-Saani", "Jumada-ul-Awwal", "Jumada-us-Saani", "Rajab", "Shaban", "Ramadan", "Shawwal", "Zil-Qaad", "Zil-Hijjah"];
export function hijri(date = new Date()) {
  try {
    const p = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" }).formatToParts(date);
    const g = (t: string) => parseInt(p.find((x) => x.type === t)?.value ?? "1", 10);
    return { d: g("day"), m: g("month"), y: g("year"), name: HIJRI_MONTHS[g("month") - 1] };
  } catch { return { d: 1, m: 1, y: 1447, name: "Muharram" }; }
}

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
