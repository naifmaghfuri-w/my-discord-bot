import { Events } from "discord.js";
import type { BotEvent } from "../types";
import type { BotClient } from "../client";
import { logger } from "../utils/logger";

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: BotClient) {
    logger.info(`✅ البوت شغال باسم ${client.user?.tag}`);
  },
};

export default event;
