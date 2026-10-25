import { Events } from "discord.js";
import type { BotEvent } from "../types";
import type { BotClient } from "../client";
import { startBirthdayRoleChecker } from "../services/birthdayRole";
import { startBackupScheduler } from "../backup/scheduler";
import { startChatCleaner } from "../chat/cleaner";
import { loadTicketCache } from "../tickets/service";
import { applyBotStatus } from "../botprofile/interactions";
import { startVipChecker } from "../vip/text";
import { logger } from "../utils/logger";

import { startCompanyPayroll } from "../companies";
// داخل execute بعد تسجيل الدخول:
startCompanyPayroll();


const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: BotClient) {
    logger.info(`✅ البوت شغال باسم ${client.user?.tag}`);
    startBirthdayRoleChecker(client);
    startChatCleaner(client);
    startVipChecker(client);
    startBackupScheduler(client);
    loadTicketCache().catch((err) => logger.error("فشل تحميل كاش التذاكر", err));
    // يرجّع حالة البوت المحفوظة (من لوحة !ايقونة البوت)
    applyBotStatus(client).catch((err) => logger.error("فشل تطبيق حالة البوت", err));
  },
};

export default event;
