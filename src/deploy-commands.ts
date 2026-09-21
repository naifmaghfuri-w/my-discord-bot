import { REST, Routes } from "discord.js";
import { config } from "./config";
import { loadCommandModules } from "./handlers/commandHandler";
import { logger } from "./utils/logger";

async function main() {
  const commands = (await loadCommandModules()).map((c) => c.data.toJSON());
  const rest = new REST().setToken(config.token);

  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
  logger.info(`تم نشر ${commands.length} أمر ${config.guildId ? "على سيرفر الاختبار" : "بشكل عام"}`);
}

main().catch((err) => logger.error("فشل نشر الأوامر", err));
