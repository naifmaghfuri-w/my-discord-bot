import mongoose from "mongoose";
import { gzip, serializeBackup } from "./codec";

/** الحد الآمن لحجم المرفق (ديسكورد: 10MB للسيرفرات العادية) */
export const MAX_ATTACHMENT = 9.5 * 1024 * 1024;

export interface BackupPart {
  name: string;
  data: Buffer;
}

export interface BackupResult {
  parts: BackupPart[];
  counts: Record<string, number>;
  totalDocs: number;
  /** مجموعات ما قدرنا نرسلها لأن ملفها لحاله أكبر من الحد */
  tooLarge: string[];
}

function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})(\d{4})$/, "$1-$2");
}

/** يقرأ كل المجموعات من MongoDB ويرجّعها كملف (أو عدة ملفات لو كبير) */
export async function createBackup(): Promise<BackupResult> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("قاعدة البيانات غير متصلة");

  const infos = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = infos.map((c) => c.name).filter((n) => !n.startsWith("system."));

  const collections: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const name of names) {
    const docs = await db.collection(name).find({}).toArray();
    collections[name] = docs;
    counts[name] = docs.length;
  }
  const totalDocs = Object.values(counts).reduce((a, b) => a + b, 0);
  const id = stamp();

  // ملف واحد لو يكفي
  const whole = gzip(serializeBackup(collections));
  if (whole.length <= MAX_ATTACHMENT) {
    return { parts: [{ name: `backup-${id}.json.gz`, data: whole }], counts, totalDocs, tooLarge: [] };
  }

  // وإلا: ملف لكل مجموعة (الاستعادة تقبل كل ملف لحاله)
  const parts: BackupPart[] = [];
  const tooLarge: string[] = [];
  for (const name of names) {
    const data = gzip(serializeBackup({ [name]: collections[name] }));
    if (data.length > MAX_ATTACHMENT) tooLarge.push(name);
    else parts.push({ name: `backup-${id}-${name}.json.gz`, data });
  }
  return { parts, counts, totalDocs, tooLarge };
}

/** ملخص نصي للنسخة */
export function summarize(result: BackupResult): string {
  const top = Object.entries(result.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([n, c]) => `${n}: ${c}`)
    .join(" • ");
  const size = result.parts.reduce((a, p) => a + p.data.length, 0);
  return [
    `📦 **نسخة احتياطية** — ${result.totalDocs.toLocaleString("en-US")} سجل في ${Object.keys(result.counts).length} مجموعة (${(size / 1024).toFixed(0)} KB مضغوطة)`,
    top,
    result.tooLarge.length ? `⚠️ مجموعات أكبر من حد المرفق ولم تُرسل: ${result.tooLarge.join("، ")} (استخدم mongodump أو نسخ Atlas)` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
