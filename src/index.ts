import { config } from "./config";
import { BotClient } from "./client";
import { connectDatabase, disconnectDatabase } from "./database/connect";
import { deployCommands } from "./deploy-commands";
import { loadCommands } from "./handlers/commandHandler";
import { loadEvents } from "./handlers/eventHandler";
import { startHealthServer } from "./utils/keepAlive";
import { logger } from "./utils/logger";

const client = new BotClient();

async function main() {
  // على Render توجد PORT دائماً؛ محلياً لا حاجة للخادم
  if (config.port) startHealthServer(config.port);

  await connectDatabase(config.mongoUri);
  await loadCommands(client);
  await loadEvents(client);
  await deployCommands().catch((err) => logger.error("فشل نشر الأوامر", err));
  await client.login(config.token);
}

async function shutdown(signal: string) {
  logger.info(`استلمت ${signal}، جارٍ الإيقاف...`);
  await client.destroy();
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (err) => logger.error("unhandledRejection", err));
process.on("uncaughtException", (err) => logger.error("uncaughtException", err));

main().catch((err) => {
  logger.error("فشل تشغيل البوت", err);
  process.exit(1);
});
