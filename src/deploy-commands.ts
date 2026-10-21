import { REST, Routes } from "discord.js";
import { config } from "./config";
import { logger } from "./utils/logger";

/** كل الأوامر كتابية (بدون سلاش)، فننشر قائمة فاضية لتنظيف أي سلاش قديم */
export async function deployCommands(): Promise<void> {
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: [] });
  logger.info(`تم تنظيف أوامر السلاش ${config.guildId ? "في سيرفر الاختبار" : "بشكل عام"}`);
}

// التشغيل اليدوي: npm run deploy
if (require.main === module) {
  deployCommands().catch((err) => {
    logger.error("فشل نشر الأوامر", err);
    process.exit(1);
  });
}
