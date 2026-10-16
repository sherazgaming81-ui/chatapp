// 13 — har build par version.json me naya version likho (Vercel deploy par auto-bump)
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const now = new Date();
// PKT time stamp: YYYY.MM.DD-HHMM
const v = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
writeFileSync(join(root, "public", "version.json"), JSON.stringify({ version: v }) + "\n");
console.log(`[version] bumped to ${v}`);
