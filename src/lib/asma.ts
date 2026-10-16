/**
 * Asma-ul-Husna — Allah ke 99 naam.
 * Standard Tirmidhi order (wahi order jo Atif Aslam recite karte hain:
 * Allah, Ar-Rahman, Ar-Rahim, ... As-Saboor).
 * Arabic: standard mashhoor spellings. Meaning: Hinglish (Roman Urdu).
 */
export interface AsmaName {
  ar: string;
  tr: string;
  meaning: string;
}

export const ASMA_UL_HUSNA: AsmaName[] = [
  { ar: "اللَّهُ", tr: "Allah", meaning: "Sab se aala naam, ibadat ke laiq" },
  { ar: "الرَّحْمَنُ", tr: "Ar-Rahman", meaning: "Behad rehem karne wala" },
  { ar: "الرَّحِيمُ", tr: "Ar-Rahim", meaning: "Nihayat meherban" },
  { ar: "الْمَلِكُ", tr: "Al-Malik", meaning: "Kainat ka badshah" },
  { ar: "الْقُدُّوسُ", tr: "Al-Quddus", meaning: "Har aib se paak" },
  { ar: "السَّلاَمُ", tr: "As-Salam", meaning: "Salamti dene wala" },
  { ar: "الْمُؤْمِنُ", tr: "Al-Mu'min", meaning: "Aman dene wala" },
  { ar: "الْمُهَيْمِنُ", tr: "Al-Muhaymin", meaning: "Nigahban, muhafiz" },
  { ar: "الْعَزِيزُ", tr: "Al-Aziz", meaning: "Ghalib, izzat wala" },
  { ar: "الْجَبَّارُ", tr: "Al-Jabbar", meaning: "Zabardast taqat wala" },
  { ar: "الْمُتَكَبِّرُ", tr: "Al-Mutakabbir", meaning: "Buzurg, kibriyai wala" },
  { ar: "الْخَالِقُ", tr: "Al-Khaliq", meaning: "Paida karne wala" },
  { ar: "الْبَارِئُ", tr: "Al-Bari", meaning: "Be-misaal banane wala" },
  { ar: "الْمُصَوِّرُ", tr: "Al-Musawwir", meaning: "Sooratein banane wala" },
  { ar: "الْغَفَّارُ", tr: "Al-Ghaffar", meaning: "Bar bar bakhshne wala" },
  { ar: "الْقَهَّارُ", tr: "Al-Qahhar", meaning: "Sab par ghalib" },
  { ar: "الْوَهَّابُ", tr: "Al-Wahhab", meaning: "Be-hisab dene wala" },
  { ar: "الرَّزَّاقُ", tr: "Ar-Razzaq", meaning: "Rizq dene wala" },
  { ar: "الْفَتَّاحُ", tr: "Al-Fattah", meaning: "Fateh, mushkil kusha" },
  { ar: "اَلْعَلِيْمُ", tr: "Al-Alim", meaning: "Sab kuch janne wala" },
  { ar: "الْقَابِضُ", tr: "Al-Qabid", meaning: "Rizq tang karne wala" },
  { ar: "الْبَاسِطُ", tr: "Al-Basit", meaning: "Rizq kushada karne wala" },
  { ar: "الْخَافِضُ", tr: "Al-Khafid", meaning: "Past karne wala" },
  { ar: "الرَّافِعُ", tr: "Ar-Rafi", meaning: "Buland karne wala" },
  { ar: "الْمُعِزُّ", tr: "Al-Mu'izz", meaning: "Izzat dene wala" },
  { ar: "الْمُذِلُّ", tr: "Al-Muzill", meaning: "Zillat dene wala" },
  { ar: "السَّمِيعُ", tr: "As-Sami", meaning: "Sab sunne wala" },
  { ar: "الْبَصِيرُ", tr: "Al-Basir", meaning: "Sab dekhne wala" },
  { ar: "الْحَكَمُ", tr: "Al-Hakam", meaning: "Faisla karne wala" },
  { ar: "الْعَدْلُ", tr: "Al-Adl", meaning: "Poora insaf karne wala" },
  { ar: "اللَّطِيفُ", tr: "Al-Latif", meaning: "Narm, bareek been" },
  { ar: "الْخَبِيرُ", tr: "Al-Khabir", meaning: "Har khabar rakhne wala" },
  { ar: "الْحَلِيمُ", tr: "Al-Halim", meaning: "Burdbbar, hilam wala" },
  { ar: "الْعَظِيمُ", tr: "Al-Azim", meaning: "Sab se azeem" },
  { ar: "الْغَفُورُ", tr: "Al-Ghafoor", meaning: "Bakhshne wala" },
  { ar: "الشَّكُورُ", tr: "Ash-Shakoor", meaning: "Qadar karne wala" },
  { ar: "الْعَلِيُّ", tr: "Al-Aliyy", meaning: "Buland martaba wala" },
  { ar: "الْكَبِيرُ", tr: "Al-Kabir", meaning: "Sab se bara" },
  { ar: "الْحَفِيظُ", tr: "Al-Hafiz", meaning: "Hifazat karne wala" },
  { ar: "الْمُقِيتُ", tr: "Al-Muqit", meaning: "Rozi pohanchane wala" },
  { ar: "الْحَسِيبُ", tr: "Al-Hasib", meaning: "Hisab lene wala" },
  { ar: "الْجَلِيلُ", tr: "Al-Jalil", meaning: "Jalal wala" },
  { ar: "الْكَرِيمُ", tr: "Al-Karim", meaning: "Karam karne wala" },
  { ar: "الرَّقِيبُ", tr: "Ar-Raqib", meaning: "Nigrani karne wala" },
  { ar: "الْمُجِيبُ", tr: "Al-Mujib", meaning: "Dua qabool karne wala" },
  { ar: "الْوَاسِعُ", tr: "Al-Wasi", meaning: "Wasee, sab ko gherne wala" },
  { ar: "الْحَكِيمُ", tr: "Al-Hakim", meaning: "Hikmat wala" },
  { ar: "الْوَدُودُ", tr: "Al-Wadud", meaning: "Mohabbat karne wala" },
  { ar: "الْمَجِيدُ", tr: "Al-Majeed", meaning: "Buzurg, shan wala" },
  { ar: "الْبَاعِثُ", tr: "Al-Ba'ith", meaning: "Qayamat me uthane wala" },
  { ar: "الشَّهِيدُ", tr: "Ash-Shahid", meaning: "Hazir, gawah" },
  { ar: "الْحَقُّ", tr: "Al-Haqq", meaning: "Haq, sach" },
  { ar: "الْوَكِيلُ", tr: "Al-Wakil", meaning: "Kaam banane wala" },
  { ar: "الْقَوِيُّ", tr: "Al-Qawiyy", meaning: "Taqatwar" },
  { ar: "الْمَتِينُ", tr: "Al-Matin", meaning: "Mazboot, na-tutne wala" },
  { ar: "الْوَلِيُّ", tr: "Al-Waliyy", meaning: "Dost, madadgar" },
  { ar: "الْحَمِيدُ", tr: "Al-Hamid", meaning: "Tareef ke laiq" },
  { ar: "الْمُحْصِيُّ", tr: "Al-Muhsi", meaning: "Gin-ti karne wala" },
  { ar: "الْمُبْدِئُ", tr: "Al-Mubdi", meaning: "Pehli bar paida karne wala" },
  { ar: "الْمُعِيدُ", tr: "Al-Mu'id", meaning: "Dobara paida karne wala" },
  { ar: "الْمُحْيِي", tr: "Al-Muhyi", meaning: "Zindagi dene wala" },
  { ar: "الْمُمِيتُ", tr: "Al-Mumit", meaning: "Maut dene wala" },
  { ar: "الْحَيُّ", tr: "Al-Hayy", meaning: "Hamesha zinda" },
  { ar: "الْقَيُّومُ", tr: "Al-Qayyum", meaning: "Sab ko qaim rakhne wala" },
  { ar: "الْوَاجِدُ", tr: "Al-Wajid", meaning: "Sab kuch pane wala" },
  { ar: "الْمَاجِدُ", tr: "Al-Majid", meaning: "Buzurg, izzat wala" },
  { ar: "الْوَاحِدُ", tr: "Al-Wahid", meaning: "Akela, yagana" },
  { ar: "الصَّمَدُ", tr: "As-Samad", meaning: "Be-niyaz, hajat rawa" },
  { ar: "الْقَادِرُ", tr: "Al-Qadir", meaning: "Qudrat wala" },
  { ar: "الْمُقْتَدِرُ", tr: "Al-Muqtadir", meaning: "Kamil qudrat wala" },
  { ar: "الْمُقَدِّمُ", tr: "Al-Muqaddim", meaning: "Aage karne wala" },
  { ar: "الْمُؤَخِّرُ", tr: "Al-Mu'akhkhir", meaning: "Peechhe karne wala" },
  { ar: "الأَوَّلُ", tr: "Al-Awwal", meaning: "Sab se pehle" },
  { ar: "الآخِرُ", tr: "Al-Akhir", meaning: "Sab se aakhir" },
  { ar: "الظَّاهِرُ", tr: "Az-Zahir", meaning: "Zahir, wazeh" },
  { ar: "الْبَاطِنُ", tr: "Al-Batin", meaning: "Posheeda, chhupa" },
  { ar: "الْوَالِي", tr: "Al-Wali", meaning: "Hakim, sarparast" },
  { ar: "الْمُتَعَالِي", tr: "Al-Muta'ali", meaning: "Buland, bartar" },
  { ar: "الْبَرُّ", tr: "Al-Barr", meaning: "Neki karne wala" },
  { ar: "التَّوَّابُ", tr: "At-Tawwab", meaning: "Tauba qabool karne wala" },
  { ar: "الْمُنْتَقِمُ", tr: "Al-Muntaqim", meaning: "Badla lene wala" },
  { ar: "العَفُوُّ", tr: "Al-Afuww", meaning: "Maaf karne wala" },
  { ar: "الرَّؤُوفُ", tr: "Ar-Ra'uf", meaning: "Nihayat shafqat wala" },
  { ar: "مَالِكُ الْمُلْكِ", tr: "Malik-ul-Mulk", meaning: "Saltanat ka malik" },
  { ar: "ذُوالْجَلاَلِ وَالإكْرَامِ", tr: "Dhul-Jalali wal-Ikram", meaning: "Jalal aur ikram wala" },
  { ar: "الْمُقْسِطُ", tr: "Al-Muqsit", meaning: "Insaf qaim karne wala" },
  { ar: "الْجَامِعُ", tr: "Al-Jami", meaning: "Jama karne wala" },
  { ar: "الْغَنِيُّ", tr: "Al-Ghaniyy", meaning: "Be-niyaz, ghani" },
  { ar: "الْمُغْنِيُّ", tr: "Al-Mughni", meaning: "Ghani karne wala" },
  { ar: "اَلْمَانِعُ", tr: "Al-Mani", meaning: "Rokne wala" },
  { ar: "الضَّارَّ", tr: "Ad-Darr", meaning: "Nuqsan dene wala" },
  { ar: "النَّافِعُ", tr: "An-Nafi", meaning: "Nafa dene wala" },
  { ar: "النُّورُ", tr: "An-Noor", meaning: "Noor, roshni" },
  { ar: "الْهَادِي", tr: "Al-Hadi", meaning: "Hidayat dene wala" },
  { ar: "الْبَدِيعُ", tr: "Al-Badi", meaning: "Be-misaal paida karne wala" },
  { ar: "اَلْبَاقِي", tr: "Al-Baqi", meaning: "Hamesha rehne wala" },
  { ar: "الْوَارِثُ", tr: "Al-Warith", meaning: "Waris, sab ka malik" },
  { ar: "الرَّشِيدُ", tr: "Ar-Rashid", meaning: "Seedhi rah dikhane wala" },
  { ar: "الصَّبُورُ", tr: "As-Saboor", meaning: "Sabr karne wala" },
];

/** Audio + sync data (generated from real analysis of the Atif Aslam recording). */
export const ASMA_AUDIO_URL = "/audio/asma-ul-husna.mp3";
export const ASMA_TIMESTAMPS_URL = "/audio/asma-timestamps.json";

export interface AsmaTimestamp {
  i: number;
  t: number;
}

/** Load the 99 timestamps (start seconds per name, in order). */
export async function loadAsmaTimestamps(): Promise<AsmaTimestamp[]> {
  const res = await fetch(ASMA_TIMESTAMPS_URL);
  const data = await res.json();
  return data.timestamps as AsmaTimestamp[];
}
