/**
 * يولّد كل بطاقات المهام كصور PNG في مجلد ./preview بدون الحاجة لتشغيل البوت
 * أو الاتصال بديسكورد/قاعدة البيانات. شغّله بـ: npm run cards:preview
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_QUESTS_BONUS, QUESTS } from "../src/quests/definitions";
import { renderQuestCard } from "../src/quests/render/card";

async function main() {
  const outDir = join(__dirname, "..", "preview");
  mkdirSync(outDir, { recursive: true });

  for (const quest of QUESTS) {
    const buffer = await renderQuestCard({
      title: quest.titleEn,
      description: quest.descriptionEn,
      coins: quest.coins,
      xp: quest.xp,
      icon: quest.id,
    });

    if (!buffer) {
      console.error("❌ فشل التوليد: الخط العربي غير موجود في src/assets/fonts (راجع README هناك)");
      process.exit(1);
    }

    const file = join(outDir, `${quest.id}.png`);
    writeFileSync(file, buffer);
    console.log(`✅ ${file}`);
  }

  const bonus = await renderQuestCard({
    title: ALL_QUESTS_BONUS.titleEn,
    description: ALL_QUESTS_BONUS.descriptionEn,
    coins: ALL_QUESTS_BONUS.coins,
    xp: ALL_QUESTS_BONUS.xp,
    icon: "trophy",
  });
  if (bonus) {
    const file = join(outDir, "all-bonus.png");
    writeFileSync(file, bonus);
    console.log(`✅ ${file}`);
  }

  console.log(`\nافتح مجلد "preview" بجانب المشروع وتفرّج على كل الصور.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
