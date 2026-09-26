import type { BotClient } from "../client";
import { QUEST_SETTINGS } from "../quests/definitions";
import { progressQuest } from "../quests/service";
import { progressWeeklyQuest } from "../quests/weeklyService";
import { logger } from "../utils/logger";

/** كل دقيقة: نضيف دقيقة لكل عضو موجود في روم صوتي */
export function startVoiceTracker(client: BotClient): void {
  setInterval(() => {
    void tick(client).catch((err) => logger.error("خطأ في تتبع الصوت", err));
  }, 60_000);
}

async function tick(client: BotClient): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const rooms = new Map<string, string[]>();

    for (const state of guild.voiceStates.cache.values()) {
      if (!state.channelId || state.channelId === guild.afkChannelId) continue;
      if (state.selfDeaf || state.serverDeaf) continue;

      const member = state.member ?? (await guild.members.fetch(state.id).catch(() => null));
      if (!member || member.user.bot) continue;

      const list = rooms.get(state.channelId) ?? [];
      list.push(member.id);
      rooms.set(state.channelId, list);
    }

    for (const users of rooms.values()) {
      if (QUEST_SETTINGS.voiceRequireCompany && users.length < 2) continue;

      for (const userId of users) {
        await progressQuest(client, { guildId: guild.id, userId, questId: "voice", amount: 1, channel: null }).catch(
          (err) => logger.error("خطأ في مهمة الصوت", err),
        );
        await progressWeeklyQuest(client, { guildId: guild.id, userId, questId: "voice", amount: 1 }).catch((err) =>
          logger.error("خطأ في مهمة الصوت الأسبوعية", err),
        );
      }
    }
  }
}
