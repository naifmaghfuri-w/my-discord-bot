import { REST, Routes } from "discord.js";
import { config } from "./config";
import { logger } from "./utils/logger";

/** ينشر الأوامر لديسكورد (يُستدعى تلقائياً عند تشغيل البوت، أو يدوياً بـ npm run deploy) */
export async function deployCommands(): Promise<void> {
  // الأوامر صارت كتابية (بدون سلاش)، فننشر قائمة فاضية لحذف أوامر السلاش القديمة من ديسكورد
  const commands: unknown[] = [];
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
  logger.info(`تم حذف أوامر السلاش ${config.guildId ? "من سيرفر الاختبار" : "بشكل عام"} (الأوامر الآن كتابية)`);
}

// التشغيل اليدوي: npm run deploy
if (require.main === module) {
  deployCommands().catch((err) => {
    logger.error("فشل نشر الأوامر", err);
    process.exit(1);
  });
}
