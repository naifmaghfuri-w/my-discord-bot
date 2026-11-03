import { config } from "./config";
import { BotClient } from "./client";
import { connectDatabase, disconnectDatabase } from "./database/connect";
import { deployCommands } from "./deploy-commands";
import { loadCommands } from "./handlers/commandHandler";
import { loadEvents } from "./handlers/eventHandler";
import { startHealthServer } from "./utils/keepAlive";
import { logger } from "./utils/logger";

const client = new BotClient();

// يمسك أخطاء الشبكة بدل ما تعطّل اتصال البوت بصمت
client.on("error", (err) => logger.error("⚠️ خطأ في اتصال ديسكورد (Client error)", err));
client.on("shardError", (err) => logger.error("⚠️ خطأ في الشارد (Shard error)", err));
client.on("shardDisconnect", (_event, id) => logger.warn(`⚠️ انقطع اتصال الشارد ${id}`));
client.on("shardReconnecting", (id) => logger.info(`🔄 الشارد ${id} يعيد الاتصال...`));
client.rest.on("error", (err) => logger.error("⚠️ خطأ في REST API لديسكورد", err));

// تشخيص مؤقت: يطبع تفاصيل الاتصال (احذفه بعد حل المشكلة)
client.on("debug", (m) => logger.info(`[debug] ${m}`));
client.on("warn", (m) => logger.warn(`[warn] ${m}`));
client.rest.on("rateLimited", (info) => logger.warn(`[rate-limit] ${info.method} ${info.url} انتظار ${info.timeToReset}ms`));

async function main() {
  // على Render توجد PORT دائماً؛ محلياً لا حاجة للخادم
  if (config.port) startHealthServer(config.port);

  logger.info("1) الاتصال بقاعدة البيانات...");
  await connectDatabase(config.mongoUri);
  logger.info("2) تحميل الأوامر والأحداث...");
  await loadCommands(client);
  await loadEvents(client);

  // يسجّل أمر السلاش /mail (ويمسح أي سلاش قديم)
  await deployCommands().catch((err) => logger.error("فشل تسجيل أوامر السلاش", err));

  logger.info("3) تسجيل الدخول لديسكورد...");
  const t = setTimeout(() => logger.warn("⏳ تسجيل الدخول لم ينتهِ بعد 30 ثانية!"), 30_000);
  await client.login(config.token);
  clearTimeout(t);
  logger.info("4) تم تسجيل الدخول");
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
