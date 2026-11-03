import { Events, type GuildMember } from "discord.js";
import type { BotEvent } from "../types";
import type { BotClient } from "../client";
import { handleMemberJoin } from "../invites/text";
import { logger } from "../utils/logger";

/** عند دخول عضو: نكشف من دعاه ونرسل سجل الدخول */
const event: BotEvent = {
  name: Events.GuildMemberAdd,
  async execute(_client: BotClient, member: GuildMember) {
    await handleMemberJoin(member).catch((err) => logger.error("خطأ في تتبع الدعوات", err));
  },
};

export default event;
