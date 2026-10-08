import { EmbedBuilder, Events, type Message, type PartialMessage } from "discord.js";
import type { BotClient } from "../client";
import { isRoomChannel } from "../chat/service";
import { getLogChannelId, LOG_COLORS, sendLog } from "../logs/logger";
import { isTicketChannel } from "../tickets/service";
import type { BotEvent } from "../types";

const event: BotEvent = {
  name: Events.MessageDelete,
  async execute(_client: BotClient, message: Message | PartialMessage) {
    if (!message.guild || message.author?.bot) return;
    // الخصوصية: لا نسجل محتوى الدردشات الخاصة ولا التذاكر ولا قناة السجلات نفسها
    if (isRoomChannel(message.channelId) || isTicketChannel(message.channelId)) return;
    if ((await getLogChannelId(message.guild.id)) === message.channelId) return;

    const content = message.content?.slice(0, 1500) || (message.partial ? "_(رسالة قديمة غير محفوظة)_" : "_(بدون نص)_");
    const attachments = message.attachments?.size ? `\n📎 مرفقات: ${message.attachments.size}` : "";

    await sendLog(
      message.guild,
      new EmbedBuilder()
        .setColor(LOG_COLORS.delete)
        .setTitle("🗑️ رسالة محذوفة")
        .setDescription(
          `**الكاتب:** ${message.author ? `<@${message.author.id}>` : "غير معروف"}\n**القناة:** <#${message.channelId}>\n\n${content}${attachments}`,
        ),
    );
  },
};

export default event;
