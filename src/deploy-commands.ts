import { REST, Routes } from "discord.js";
import { data as aiCommand } from "./ai/commands";
import { config } from "./config";
import { logger } from "./utils/logger";

/** ينشر الأوامر لديسكورد (يُستدعى تلقائياً عند تشغيل البوت، أو يدوياً بـ npm run deploy) */
export async function deployCommands(): Promise<void> {
  // باقي الأوامر كتابية (بدون سلاش)، والسلاش الوحيد حالياً هو /ذكاء
  const commands = [aiCommand.toJSON()];
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
  logger.info(`تم نشر أمر /ذكاء ${config.guildId ? "في سيرفر الاختبار فقط" : "بشكل عام (كل السيرفرات)"}`);
}

// التشغيل اليدوي: npm run deploy
if (require.main === module) {
  deployCommands().catch((err) => {
    logger.error("فشل نشر الأوامر", err);
    process.exit(1);
  });
}
