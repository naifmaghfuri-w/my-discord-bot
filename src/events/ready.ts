import { Events } from "discord.js";
import type { BotEvent } from "../types";
import type { BotClient } from "../client";
import { startBirthdayRoleChecker } from "../services/birthdayRole";
import { startVoiceTracker } from "../services/voiceTracker";
import { startBackupScheduler } from "../backup/scheduler";
import { startChatCleaner } from "../chat/cleaner";
import { loadTicketCache } from "../tickets/service";
import { logger } from "../utils/logger";

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: BotClient) {
    logger.info(`✅ البوت شغال باسم ${client.user?.tag}`);
    startVoiceTracker(client);
    startBirthdayRoleChecker(client);
    startChatCleaner(client);
    startBackupScheduler(client);
    loadTicketCache().catch((err) => logger.error("فشل تحميل كاش التذاكر", err));
  },
};

export default event;
