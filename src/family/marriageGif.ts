import { AttachmentBuilder } from "discord.js";
import fs from "node:fs";
import path from "node:path";

/** أماكن البحث عن مجلد الصور */
const DIRS = [
  path.join(process.cwd(), "src", "assets"),
  path.join(process.cwd(), "assets"),
  path.join(__dirname, "..", "assets"),
  path.join(__dirname, "..", "..", "src", "assets"),
];

/** أي ملف اسمه يبدأ بـ marry وينتهي بـ .gif (بأي حالة أحرف، حتى لو marry1.gif.GIF) */
const GIF_RE = /^marry.*\.gif$/i;

function listGifs(): string[] {
  const found: string[] = [];
  for (const dir of DIRS) {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (GIF_RE.test(f)) found.push(path.join(dir, f));
      }
    } catch {
      /* المجلد غير موجود */
    }
    if (found.length > 0) break;
  }
  return found;
}

/** يرجّع gif عشوائي أو null لو ما لقى شي، فالزواج ما يتعطل */
export function pickMarriageGif(): { file: AttachmentBuilder; name: string } | null {
  const gifs = listGifs();
  if (gifs.length === 0) return null;
  const full = gifs[Math.floor(Math.random() * gifs.length)];
  const name = "marriage.gif";
  return { file: new AttachmentBuilder(full, { name }), name };
}
