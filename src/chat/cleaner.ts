import type { Client } from "discord.js";
import { logger } from "../utils/logger";
import { cleanIdleRooms, loadRoomCache } from "./service";

const HOUR = 60 * 60 * 1000;

export function startChatCleaner(client: Client): void {
  loadRoomCache().catch((err) => logger.error("فشل تحميل كاش الدردشات", err));

  const run = () => {
    cleanIdleRooms(client)
      .then((n) => n > 0 && logger.info(`تم حذف ${n} دردشة خاملة`))
      .catch((err) => logger.error("فشل تنظيف الدردشات الخاملة", err));
  };
  setTimeout(run, 60_000).unref();
  setInterval(run, HOUR).unref();
}
