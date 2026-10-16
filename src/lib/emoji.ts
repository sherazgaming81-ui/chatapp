// B8 — compact built-in emoji dataset for the custom picker
export interface EmojiCat { id: string; name: string; icon: string; emojis: string[] }

export const EMOJI_CATS: EmojiCat[] = [
  { id: "smileys", name: "Smileys", icon: "😀", emojis: "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 😐 😐 🙄 😏 😬 😴 🤤 😪 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 😤 😡 😠 🤬 😈 👿 💀 ☠️".split(" ") },
  { id: "people", name: "Log", icon: "👋", emojis: "👋 🤚 🖐️ ✋ 🖖 👌 🤌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 💪 🦾 🖐️ ✍️ 💅 🤳 💋 👄 🦷 👅 👂 🦻 👃 👣 👀 👁️ 🧠 🫀 🫁 🦷 🦴 👤 👥 🗣️ 👶 👧 🧒 👦 👩 🧑 👨 👩‍🦱 🧑‍🦱 👨‍🦱 👩‍🦰 🧑‍🦰 👱‍♀️ 👱 🧓 👴 👵 🙍‍♂️ 🙍‍♀️ 🙎‍♂️ 🙎‍♀️ 🙅‍♂️ 🙅‍♀️ 🙆‍♂️ 🙆‍♀️ 💁‍♂️ 💁‍♀️ 🙋‍♂️ 🙋‍♀️ 🧏‍♂️ 🧏‍♀️ 🙇‍♂️ 🙇‍♀️ 🤦‍♂️ 🤦‍♀️ 🤷‍♂️ 🤷‍♀️ 🧑‍⚕️ 👨‍⚕️ 👩‍⚕️ 🧑‍🎓 👨‍🎓 👩‍🎓 🧑‍🏫 👨‍🏫 👩‍🏫 🧑‍🌾 👨‍🌾 👩‍🌾 👮‍♂️ 👮‍♀️ 💂 🕵️ 👷 👳‍♂️ 👳‍♀️ 🧕 🤶 🎅 🦸 🦹 🧙 🧚 🧛 🧜 🧞 🧟".split(" ") },
  { id: "nature", name: "Qudrat", icon: "🌙", emojis: "🌙 🌚 🌝 🌞 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 🌪️ 🌫️ 🌈 ☔ 💧 💦 🌊 🌅 🌄 🌠 🌌 🌃 🏙️ 🌇 🌆 🏞️ 🌋 🗻 🏔️ ⛰️ 🏕️ 🏖️ 🏝️ 🏜️ 🏛️ 🕌 🕍 ⛪ 🕋 🌳 🌲 🌴 🌱 🌿 ☘️ 🍀 🎍 🎋 🍃 🍂 🍁 🌾 🌺 🌸 🌼 🌻 🌞 🌷 🌱 🪴 🌵 🌾 🍄 🌰 🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦄 🐝 🦋 🐌 🐞 🐢 🐍 🦎 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦦 🦥 🐁 🐀 🐿️ 🦔".split(" ") },
  { id: "food", name: "Khana", icon: "🍕", emojis: "🍕 🍔 🍟 🌭 🍿 🧂 🥓 🥚 🍳 🧇 🥞 🧈 🍞 🥐 🥖 🫓 🥨 🧀 🥗 🥙 🫔 🌮 🌯 🫕 🥘 🍲 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️ 🥢 🍱 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘 🌰 🍞".split(" ") },
  { id: "activity", name: "Khel", icon: "⚽", emojis: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩".split(" ") },
  { id: "travel", name: "Safar", icon: "🚗", emojis: "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🪂 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🪝 ⛽ 🚧 🚏 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏚️ 🏢 🏣 🏤 🏥 🏦 🏨 🏩 🏪 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 🕋 ⛩️ 🛤️ 🛣️ 🗾 🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁".split(" ") },
  { id: "objects", name: "Cheezein", icon: "💡", emojis: "💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 🪪 💰 💳 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳️ 💊 💉 🩸 🩹 🩺 🩻 🌡️ 🧪 🧫 🧬 🔍 🪥 🪒 🧽 🪣 🧴 🛍️ 🎁 🎀 🎊 🎉 🪅 🎈 🪩 🎐 🎏 🎎 🧸 🪆 🖼️ 🧵 🪡 🧶 🪢 👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚 👛 👜 👝 🛍️ 🎒 🩴 👞 👟 🥾 🥿 👠 👡 🩰 👢 👑 👒 🎩 🎓 🧢 🪖 💄 💍 💼".split(" ") },
  { id: "symbols", name: "Nishan", icon: "❤️", emojis: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈁 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🈳 🈂️ 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧ 🚻 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔢 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↩️ ↪️ ⤴️ ⤵️ 🔀 🎲 🔁 🔂 ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢 👁‍🗨 💤 🗨️ 🗯️ 💭 💬 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛".split(" ") },
];

export const QUICK_EMOJIS = ["❤️", "👍", "😂", "🤲", "🌙", "😊", "🎉", "👏"];

export function searchEmojis(q: string): string[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const out: string[] = [];
  for (const c of EMOJI_CATS) {
    for (const e of c.emojis) {
      if (out.length >= 60) return out;
      // crude match — emoji names aren't stored; match category name as fallback
      if (c.name.toLowerCase().includes(needle) || c.id.includes(needle)) out.push(e);
    }
  }
  return [...new Set(out)].slice(0, 60);
}

const RECENT_KEY = "chatsapp:emoji:recent";
export function getRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, 24) : [];
  } catch { return []; }
}
export function pushRecentEmoji(e: string) {
  try {
    const cur = getRecentEmojis().filter((x) => x !== e);
    localStorage.setItem(RECENT_KEY, JSON.stringify([e, ...cur].slice(0, 24)));
  } catch { /* ignore */ }
}
