import { join } from "node:path";
import type { BotClient } from "../client";
import type { BotEvent } from "../types";
import { walk } from "../utils/files";
import { logger } from "../utils/logger";

/** يشغّل الحدث ويمسك أي خطأ بأمان — بدون هذا، خطأ داخل أي معالج حدث يقدر يفلت كـ uncaughtException */
function safeExecute(event: BotEvent, client: BotClient, args: unknown[]): void {
  Promise.resolve(event.execute(client, ...args)).catch((err) => {
    logger.error(`خطأ غير متوقع في معالج الحدث ${event.name}`, err);
  });
}

export async function loadEvents(client: BotClient): Promise<void> {
  let count = 0;

  for (const file of walk(join(__dirname, "..", "events"))) {
    const event: BotEvent | undefined = (await import(file)).default;
    if (!event?.name || !event?.execute) {
      logger.warn(`تم تجاهل الحدث: ${file}`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => safeExecute(event, client, args));
    } else {
      client.on(event.name, (...args) => safeExecute(event, client, args));
    }
    count++;
  }
  logger.info(`تم تحميل ${count} حدث`);
}
