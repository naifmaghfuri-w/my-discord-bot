import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "./config";
import { logger } from "./utils/logger";

/** أوامر السلاش: /mail و /shop (باقي الأوامر كتابية). أي سلاش قديم غيره يُمسح */
const COMMANDS = [
  new SlashCommandBuilder().setName("mail").setDescription("📫 View your mailbox.").setDMPermission(false).toJSON(),
  new SlashCommandBuilder().setName("shop").setDescription("🛒 Browse the shops.").setDMPermission(false).toJSON(),
];

export async function deployCommands(): Promise<void> {
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: COMMANDS });
  logger.info(`تم تسجيل أوامر السلاش (${COMMANDS.map((c) => `/${c.name}`).join("، ")}) ${config.guildId ? "في سيرفر الاختبار" : "بشكل عام"}`);
}

// التشغيل اليدوي: npm run deploy
if (require.main === module) {
  deployCommands().catch((err) => {
    logger.error("فشل نشر الأوامر", err);
    process.exit(1);
  });
}
