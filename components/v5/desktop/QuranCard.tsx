'use client';

/**
 * QuranCard — rozana ek ayat, Urdu tarjume ke saath.
 * Din ke hisab se rotate (day-of-year % 30). Pehle api.alquran.cloud se
 * live (quran-uthmani + ur.jalandhry) lane ki koshish, fail ho to built-in list.
 */

import { useEffect, useState } from 'react';
import { Icon, ICONS } from './common';

interface Ayah {
  ref: string; // "2:255"
  arabic: string;
  urdu: string;
}

const AYAHS: Ayah[] = [
  { ref: '2:255', arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ', urdu: 'Allah ke siwa koi mabood nahi, wo zinda aur qaim rehne wala hai. Use na oongh aati hai na neend.' },
  { ref: '94:6', arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', urdu: 'Beshak mushkil ke saath aasani hai.' },
  { ref: '39:53', arabic: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا', urdu: 'Allah ki rehmat se na-umeed na ho. Beshak Allah sab gunah bakhsh deta hai.' },
  { ref: '2:152', arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ', urdu: 'Tum mujhe yaad karo, main tumhein yaad karunga. Mera shukr karo aur na-shukri na karo.' },
  { ref: '2:286', arabic: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', urdu: 'Allah kisi jaan par uski taqat se zyada bojh nahi dalta.' },
  { ref: '13:28', arabic: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ', urdu: 'Sun lo! Allah ke zikr se dilon ko itminan milta hai.' },
  { ref: '2:153', arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ', urdu: 'Aye iman walo! Sabr aur namaz se madad mango.' },
  { ref: '65:3', arabic: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ', urdu: 'Jo Allah par tawakkul kare, Allah uske liye kafi hai.' },
  { ref: '3:139', arabic: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ', urdu: 'Himmat na haro aur gham na karo, tum hi ghalib rahoge.' },
  { ref: '20:114', arabic: 'رَّبِّ زِدْنِي عِلْمًا', urdu: 'Aye mere Rab! Mere ilm me izafa farma.' },
  { ref: '55:13', arabic: 'فَبِأَيِّ آلَاءِ رَبِّكُمَا تُكَذِّبَانِ', urdu: 'Tum apne Rab ki kaun kaun si nematon ko jhutlaoge?' },
  { ref: '93:3', arabic: 'مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ', urdu: 'Tumhare Rab ne tumhein chhora nahi aur na wo naraz hua.' },
  { ref: '93:5', arabic: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ', urdu: 'Anqareeb tumhara Rab tumhein itna dega ke tum raazi ho jaoge.' },
  { ref: '94:5', arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', urdu: 'Pas beshak mushkil ke saath aasani hai.' },
  { ref: '40:60', arabic: 'وَقَالَ رَبُّكُمُ ادْعُونِي أَسْتَجِبْ لَكُمْ', urdu: 'Tumhare Rab ne farmaya: mujhe pukaro, main tumhari dua qabool karunga.' },
  { ref: '2:186', arabic: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ', urdu: 'Jab mere bande mere baare me poochein to keh do ke main qareeb hun.' },
  { ref: '8:2', arabic: 'إِنَّمَا الْمُؤْمِنُونَ الَّذِينَ إِذَا ذُكِرَ اللَّهُ وَجِلَتْ قُلُوبُهُمْ', urdu: 'Momin to wo hain ke jab Allah ka zikr ho to unke dil kaanp uthein.' },
  { ref: '29:69', arabic: 'وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا', urdu: 'Jo hamare raaste me koshish karein, hum unhein apne raaste zaroor dikhayenge.' },
  { ref: '7:56', arabic: 'إِنَّ رَحْمَتَ اللَّهِ قَرِيبٌ مِّنَ الْمُحْسِنِينَ', urdu: 'Beshak Allah ki rehmat neki karne walon ke qareeb hai.' },
  { ref: '16:97', arabic: 'مَنْ عَمِلَ صَالِحًا مِّن ذَكَرٍ أَوْ أُنثَىٰ وَهُوَ مُؤْمِنٌ فَلَنُحْيِيَنَّهُ حَيَاةً طَيِّبَةً', urdu: 'Jo neki kare, mard ho ya aurat, aur momin ho — hum use pakiza zindagi denge.' },
  { ref: '3:160', arabic: 'إِن يَنصُرْكُمُ اللَّهُ فَلَا غَالِبَ لَكُمْ', urdu: 'Agar Allah tumhari madad kare to tum par koi ghalib nahi aa sakta.' },
  { ref: '9:51', arabic: 'قُل لَّن يُصِيبَنَا إِلَّا مَا كَتَبَ اللَّهُ لَنَا', urdu: 'Keh do: humein sirf wohi pahunchega jo Allah ne hamare liye likh diya.' },
  { ref: '14:7', arabic: 'لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ', urdu: 'Agar tum shukr karoge to main tumhein aur zyada dunga.' },
  { ref: '24:35', arabic: 'اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ', urdu: 'Allah aasmanon aur zameen ka noor hai.' },
  { ref: '112:1-2', arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ . اللَّهُ الصَّمَدُ', urdu: 'Keh do: Wo Allah hai, ek hai. Allah beniyaz hai.' },
  { ref: '1:2', arabic: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', urdu: 'Sab tareef Allah ke liye hai jo tamam jahanon ka Rab hai.' },
  { ref: '2:261', arabic: 'مَّثَلُ الَّذِينَ يُنفِقُونَ أَمْوَالَهُمْ فِي سَبِيلِ اللَّهِ كَمَثَلِ حَبَّةٍ أَنبَتَتْ سَبْعَ سَنَابِلَ', urdu: 'Allah ke raaste me kharch karne walon ki misaal ek dane jaisi hai jisse saat baaliyan ugen.' },
  { ref: '4:110', arabic: 'وَمَن يَعْمَلْ سُوءًا أَوْ يَظْلِمْ نَفْسَهُ ثُمَّ يَسْتَغْفِرِ اللَّهَ يَجِدِ اللَّهَ غَفُورًا رَّحِيمًا', urdu: 'Jo bura kare ya apni jaan par zulm kare phir Allah se bakhshish mange, wo Allah ko bakhshne wala meherban payega.' },
  { ref: '5:8', arabic: 'يَا أَيُّهَا الَّذِينَ آمَنُوا كُونُوا قَوَّامِينَ لِلَّهِ شُهَدَاءَ بِالْقِسْطِ', urdu: 'Aye iman walo! Allah ke liye insaf par qaim rehne wale gawah bano.' },
  { ref: '17:23', arabic: 'وَقَضَىٰ رَبُّكَ أَلَّا تَعْبُدُوا إِلَّا إِيَّاهُ وَبِالْوَالِدَيْنِ إِحْسَانًا', urdu: 'Tumhare Rab ne faisla kiya ke uske siwa kisi ki ibadat na karo aur walidain ke saath ehsan karo.' },
];

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export default function QuranCard() {
  const idx = dayOfYear() % AYAHS.length;
  const fallback = AYAHS[idx];
  const [ayah, setAyah] = useState<Ayah>(fallback);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${fallback.ref}/editions/quran-uthmani,ur.jalandhry`);
        const json = await res.json();
        const arr = json?.data;
        if (on && Array.isArray(arr) && arr.length >= 2) {
          const ar = arr.find((e: { edition?: { language?: string } }) => e.edition?.language === 'ar');
          const ur = arr.find((e: { edition?: { language?: string } }) => e.edition?.language === 'ur');
          if (ar?.text && ur?.text) {
            setAyah({ ref: fallback.ref, arabic: String(ar.text), urdu: String(ur.text) });
            setLive(true);
          }
        }
      } catch {}
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <div className="relative bg-[#111b21] border border-[#222d34] rounded-2xl overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#00a884] via-[#ffd447] to-[#00a884]" />
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[#00a884]/15 text-[#00a884] flex items-center justify-center">
            <Icon d={ICONS.star} size={19} />
          </span>
          <div>
            <h3 className="text-[15px] font-medium text-[#e9edef]">Aaj ki Ayat</h3>
            <p className="text-[11.5px] text-[#8696a0]">Surah {ayah.ref}{live ? ' · live' : ''}</p>
          </div>
        </div>
        <span className="text-[10.5px] text-[#8696a0] border border-[#222d34] rounded-full px-2 py-1">#{idx + 1}/30</span>
      </div>
      <p dir="rtl" lang="ar" className="px-6 pt-3 pb-2 text-right text-[19px] leading-[2.1] text-[#e9edef] font-medium">
        {ayah.arabic}
      </p>
      <p dir="rtl" lang="ur" className="px-6 pb-1 text-right text-[14px] leading-[1.9] text-[#aebac1]">
        {ayah.urdu}
      </p>
      <p className="px-5 pb-4 pt-1 text-[11.5px] text-[#8696a0]">Rozana nayi ayat · Urdu tarjume ke saath</p>
    </div>
  );
}
