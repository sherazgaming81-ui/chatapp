'use client';

/**
 * HadeesCard — rozana ek hadees, Urdu tarjume ke saath.
 * Built-in 30 hadees, day-of-year % 30 se rotate.
 */

import { useState } from 'react';
import { Icon, ICONS } from './common';

interface Hadees {
  arabic: string;
  urdu: string;
  source: string;
}

const HADEES: Hadees[] = [
  { arabic: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ', urdu: 'Amaal ka daromadar niyyaton par hai.', source: 'Bukhari' },
  { arabic: 'لَا يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لِأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ', urdu: 'Tum me se koi momin nahi ho sakta jab tak apne bhai ke liye wohi pasand na kare jo apne liye pasand karta hai.', source: 'Bukhari, Muslim' },
  { arabic: 'خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ', urdu: 'Tum me se behtareen wo hai jo Quran seekhe aur sikhaye.', source: 'Bukhari' },
  { arabic: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ', urdu: 'Muslim wo hai jiski zaban aur haath se doosre Muslim mehfooz rahein.', source: 'Bukhari, Muslim' },
  { arabic: 'الطُّهُورُ شَطْرُ الْإِيمَانِ', urdu: 'Paakizgi (wuzu) aadha iman hai.', source: 'Muslim' },
  { arabic: 'جُعِلَتْ قُرَّةُ عَيْنِي فِي الصَّلَاةِ', urdu: 'Namaz meri aankhon ki thandak banayi gayi hai.', source: 'Nasai' },
  { arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ', urdu: 'Jo Allah aur aakhirat par iman rakhta hai, use chahiye ke achhi baat kahe ya khamosh rahe.', source: 'Bukhari, Muslim' },
  { arabic: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ فَلْيُكْرِمْ ضَيْفَهُ', urdu: 'Jo Allah aur aakhirat par iman rakhta hai wo apne mehman ki izzat kare.', source: 'Bukhari, Muslim' },
  { arabic: 'الرَّاحِمُونَ يَرْحَمُهُمُ الرَّحْمَنُ', urdu: 'Rahm karne walon par Rahman rahm karta hai.', source: 'Tirmidhi' },
  { arabic: 'كُنْ فِي الدُّنْيَا كَأَنَّكَ غَرِيبٌ أَوْ عَابِرُ سَبِيلٍ', urdu: 'Duniya me aise raho jaise musafir ya raah chalne wala.', source: 'Bukhari' },
  { arabic: 'عَجَبًا لِأَمْرِ الْمُؤْمِنِ، إِنَّ أَمْرَهُ كُلَّهُ خَيْرٌ', urdu: 'Momin ka muamla ajeeb hai — uske har kaam me uske liye khair hai.', source: 'Muslim' },
  { arabic: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ', urdu: 'Taqatwar wo nahi jo kushti me jeete; taqatwar wo hai jo gusse me apne nafs par qabu paye.', source: 'Bukhari, Muslim' },
  { arabic: 'إِنَّ اللَّهَ لَا يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ، وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ', urdu: 'Allah tumhari suraton aur maalon ko nahi dekhta, wo tumhare dilon aur aamaal ko dekhta hai.', source: 'Muslim' },
  { arabic: 'مَنْ حَمَلَ عَلَيْنَا السِّلَاحَ فَلَيْسَ مِنَّا', urdu: 'Jis ne hum par hathiyar uthaya wo hum me se nahi.', source: 'Bukhari, Muslim' },
  { arabic: 'الصَّبْرُ ضِيَاءٌ', urdu: 'Sabr roshni hai.', source: 'Muslim' },
  { arabic: 'الدُّعَاءُ مُخُّ الْعِبَادَةِ', urdu: 'Dua ibadat ka maghaz hai.', source: 'Tirmidhi' },
  { arabic: 'مَنْ لَمْ يَدَعْ قَوْلَ الزُّورِ وَالْعَمَلَ بِهِ فَلَيْسَ لِلَّهِ حَاجَةٌ فِي أَنْ يَدَعَ طَعَامَهُ وَشَرَابَهُ', urdu: 'Jis ne jhoot bolna aur us par amal na chhora, Allah ko uske khana-peena chhorne ki koi hajat nahi.', source: 'Bukhari' },
  { arabic: 'الصِّيَامُ جُنَّةٌ', urdu: 'Roza dhaal hai.', source: 'Bukhari, Muslim' },
  { arabic: 'خَيْرُكُمْ خَيْرُكُمْ لِأَهْلِهِ', urdu: 'Tum me se behtar wo hai jo apne ghar walon ke liye behtar ho.', source: 'Tirmidhi' },
  { arabic: 'رِضَا الرَّبِّ فِي رِضَا الْوَالِدِ', urdu: 'Rab ki khushi walid ki khushi me hai.', source: 'Tirmidhi' },
  { arabic: 'مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ', urdu: 'Jo ilm ke liye raasta ikhtiyar kare, Allah uske liye jannat ka raasta aasan kar deta hai.', source: 'Muslim' },
  { arabic: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ', urdu: 'Ilm hasil karna har Muslim par farz hai.', source: 'Ibn Majah' },
  { arabic: 'الصَّدَقَةُ تُطْفِئُ الْخَطِيئَةَ كَمَا يُطْفِئُ الْمَاءُ النَّارَ', urdu: 'Sadqa gunahon ko aise mita deta hai jaise pani aag ko bujha deta hai.', source: 'Tirmidhi' },
  { arabic: 'أَفْضَلُ الذِّكْرِ لَا إِلَهَ إِلَّا اللَّهُ', urdu: 'Sab se afzal zikr "La ilaha illallah" hai.', source: 'Tirmidhi' },
  { arabic: 'مَنْ صَلَّى الصُّبْحَ فَهُوَ فِي ذِمَّةِ اللَّهِ', urdu: 'Jis ne Fajr ki namaz padhi wo Allah ki hifazat me hai.', source: 'Muslim' },
  { arabic: 'الصَّلَوَاتُ الْخَمْسُ وَالْجُمُعَةُ إِلَى الْجُمُعَةِ كَفَّارَةٌ لِمَا بَيْنَهُنَّ', urdu: 'Paanch namazein aur ek Juma se doosre Juma tak darmiyani gunahon ka kaffara hain.', source: 'Muslim' },
  { arabic: 'مَنْ غَدَا إِلَى الْمَسْجِدِ أَوْ رَاحَ أَعَدَّ اللَّهُ لَهُ نُزُلًا فِي الْجَنَّةِ', urdu: 'Jo subah ya sham masjid jaye, Allah uske liye jannat me mehmani tayyar karta hai.', source: 'Bukhari, Muslim' },
  { arabic: 'الْمُؤْمِنُ مِرْآةُ الْمُؤْمِنِ', urdu: 'Momin momin ka aaina hai.', source: 'Abu Dawud' },
  { arabic: 'مَا مِنْ شَيْءٍ أَثْقَلُ فِي الْمِيزَانِ مِنْ حُسْنِ الْخُلُقِ', urdu: 'Achhe akhlaq se badhkar mizan me koi cheez bhari nahi hogi.', source: 'Tirmidhi' },
  { arabic: 'بَلِّغُوا عَنِّي وَلَوْ آيَةً', urdu: 'Meri taraf se pahunchado, chahe ek ayat hi ho.', source: 'Bukhari' },
];

function dayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

export default function HadeesCard() {
  const [idx] = useState(() => dayOfYear() % HADEES.length);
  const h = HADEES[idx];

  return (
    <div className="relative bg-[#111b21] border border-[#222d34] rounded-2xl overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#7f66ff] via-[#00a884] to-[#7f66ff]" />
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-[#7f66ff]/15 text-[#ab9df2] flex items-center justify-center">
            <Icon d={ICONS.chat} size={19} />
          </span>
          <div>
            <h3 className="text-[15px] font-medium text-[#e9edef]">Aaj ki Hadees</h3>
            <p className="text-[11.5px] text-[#8696a0]">{h.source}</p>
          </div>
        </div>
        <span className="text-[10.5px] text-[#8696a0] border border-[#222d34] rounded-full px-2 py-1">#{idx + 1}/30</span>
      </div>
      <p dir="rtl" lang="ar" className="px-6 pt-3 pb-2 text-right text-[18px] leading-[2] text-[#e9edef] font-medium">
        {h.arabic}
      </p>
      <p dir="rtl" lang="ur" className="px-6 pb-1 text-right text-[14px] leading-[1.9] text-[#aebac1]">
        {h.urdu}
      </p>
      <p className="px-5 pb-4 pt-1 text-[11.5px] text-[#8696a0]">Rozana nayi hadees · Urdu tarjume ke saath</p>
    </div>
  );
}
