import { Events, type MessageReaction, type PartialMessageReaction, type PartialUser, type User } from "discord.js";
import type { BotClient } from "../client";
import { progressQuest, toAnnouncer } from "../quests/service";
import { todayKey } from "../quests/time";
import type { BotEvent } from "../types";
import { logger } from "../utils/logger";

// ضد التلاعب: نفس الرياكشن على نفس الرسالة يُحسب مرة واحدة باليوم
const seen = new Set<string>();

const event: BotEvent = {
  name: Events.MessageReactionAdd,
  async execute(client: BotClient, reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
    if (user.bot) return;

    try {
      const full = reaction.partial ? await reaction.fetch() : reaction;
      const guildId = full.message.guildId;
      if (!guildId) return;
      if (full.message.author?.id === user.id) return; // رياكشن على رسالتك ما يُحسب

      const key = `${todayKey()}:${user.id}:${full.message.id}:${full.emoji.id ?? full.emoji.name}`;
      if (seen.has(key)) return;
      if (seen.size > 20_000) seen.clear();
      seen.add(key);

      await progressQuest(client, {
        guildId,
        userId: user.id,
        questId: "reactions",
        amount: 1,
        channel: toAnnouncer(full.message.channel),
      });
    } catch (err) {
      logger.error("خطأ في تتبع الرياكشن", err);
    }
  },
};

export default event;
