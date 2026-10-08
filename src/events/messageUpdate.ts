import { EmbedBuilder, Events, type Message, type PartialMessage } from "discord.js";
import type { BotClient } from "../client";
import { isRoomChannel } from "../chat/service";
import { getLogChannelId, LOG_COLORS, sendLog } from "../logs/logger";
import { isTicketChannel } from "../tickets/service";
import type { BotEvent } from "../types";

const event: BotEvent = {
  name: Events.MessageUpdate,
  async execute(_client: BotClient, before: Message | PartialMessage, after: Message | PartialMessage) {
    if (!after.guild || after.author?.bot) return;
    if (before.partial || !before.content || before.content === after.content) return;
    if (isRoomChannel(after.channelId) || isTicketChannel(after.channelId)) return;
    if ((await getLogChannelId(after.guild.id)) === after.channelId) return;

    await sendLog(
      after.guild,
      new EmbedBuilder()
        .setColor(LOG_COLORS.edit)
        .setTitle("✏️ رسالة معدّلة")
        .setDescription(
          `**الكاتب:** <@${after.author?.id}>\n**القناة:** <#${after.channelId}> • [الذهاب للرسالة](${after.url})\n\n**قبل:**\n${before.content.slice(0, 900)}\n\n**بعد:**\n${(after.content ?? "").slice(0, 900)}`,
        ),
    );
  },
};

export default event;
