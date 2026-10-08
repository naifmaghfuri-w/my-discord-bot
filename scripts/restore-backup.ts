/**
 * استعادة نسخة احتياطية:
 *   npx tsx scripts/restore-backup.ts <ملف.json.gz> --yes [--wipe]
 * - بدون --wipe: يدمج (يستبدل/يضيف السجلات حسب _id ولا يحذف الموجود)
 * - مع --wipe: يفرّغ كل مجموعة موجودة بالنسخة قبل الاستعادة
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import mongoose from "mongoose";
import { parseBackup } from "../src/backup/codec";

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  if (!file) {
    console.error("الاستخدام: npx tsx scripts/restore-backup.ts <ملف.json.gz> --yes [--wipe]");
    process.exit(1);
  }
  if (!flags.includes("--yes")) {
    console.error("⚠️ هذا يعدّل قاعدة البيانات الحالية. أضف --yes للتأكيد.");
    process.exit(1);
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI غير موجود في .env");

  const backup = parseBackup(readFileSync(file), mongoose.Types.ObjectId as unknown as new (hex: string) => unknown);
  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  const wipe = flags.includes("--wipe");

  console.log(`نسخة بتاريخ ${backup.createdAt}`);
  for (const [name, docs] of Object.entries(backup.collections)) {
    const col = db.collection(name);
    if (wipe) await col.deleteMany({});
    if (docs.length > 0) {
      await col.bulkWrite(
        (docs as { _id: unknown }[]).map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })) as never,
        { ordered: false },
      );
    }
    console.log(`✓ ${name}: ${docs.length} سجل`);
  }
  await mongoose.disconnect();
  console.log("تمت الاستعادة.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
