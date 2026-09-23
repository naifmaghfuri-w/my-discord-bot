import { join } from "node:path";
import type { BotClient } from "../client";
import type { BotEvent } from "../types";
import { walk } from "../utils/files";
import { logger } from "../utils/logger";

export async function loadEvents(client: BotClient): Promise<void> {
  let count = 0;

  for (const file of walk(join(__dirname, "..", "events"))) {
    const event: BotEvent | undefined = (await import(file)).default;
    if (!event?.name || !event?.execute) {
      logger.warn(`تم تجاهل الحدث: ${file}`);
      continue;
    }

    if (event.once) {
      client.once(event.name, (...args) => event.execute(client, ...args));
    } else {
      client.on(event.name, (...args) => event.execute(client, ...args));
    }
    count++;
  }
  logger.info(`تم تحميل ${count} حدث`);
}
