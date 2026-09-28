import { config } from "./config";
import { BotClient } from "./client";
import { connectDatabase, disconnectDatabase } from "./database/connect";
import { deployCommands } from "./deploy-commands";
import { loadCommands } from "./handlers/commandHandler";
import { loadEvents } from "./handlers/eventHandler";
import { startHealthServer } from "./utils/keepAlive";
import { logger } from "./utils/logger";

const client = new BotClient();

// مهم جداً: بدون هذا، أي خطأ شبكة أو خطأ منتهي الصلاحية (زي تفاعل انتهت مهلته) يطلع كـ
// "uncaughtException" ويقدر يعطّل اتصال البوت بديسكورد بالكامل بصمت. هذا يمسكه بأمان بدل ما يوقف كل شيء.
client.on("error", (err) => logger.error("⚠️ خطأ في اتصال ديسكورد (Client error)", err));
client.on("shardError", (err) => logger.error("⚠️ خطأ في الشارد (Shard error)", err));
client.on("shardDisconnect", (_event, id) => logger.warn(`⚠️ انقطع اتصال الشارد ${id}`));
client.on("shardReconnecting", (id) => logger.info(`🔄 الشارد ${id} يعيد الاتصال...`));
client.rest.on("error", (err) => logger.error("⚠️ خطأ في REST API لديسكورد", err));

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
