import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Message,
} from "discord.js";
import { addMention, getAfk } from "./service";

export const NOTIFY_PREFIX = "afk_notify_";
export const MESSAGE_PREFIX = "afk_msg_";
export const MODAL_PREFIX = "afk_modal_";
export const INBOX_PREFIX = "afk_inbox_";

/** يرسل بطاقة "بوضع الغياب المؤقت" لكل عضو AFK تم منشنه في الرسالة (إن وجد)، ويسجّل المنشن لعرضه عند رجوعه */
export async function sendAfkNotices(message: Message<true>, mentionedIds: Iterable<string>): Promise<void> {
  const guildId = message.guildId;

  for (const targetId of mentionedIds) {
    if (targetId === message.author.id) continue;

    const status = await getAfk(guildId, targetId);
    if (!status) continue;

    await addMention(guildId, targetId, message.author.id).catch(() => undefined);

    const user = await message.client.users.fetch(targetId).catch(() => null);
    if (!user) continue;

    const minutesAgo = Math.max(1, Math.round((Date.now() - status.since.getTime()) / 60_000));

    const embed = new EmbedBuilder()
      .setColor(0x818cf8)
      .setAuthor({ name: `😪 [AFK] ${user.username}`, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL())
      .setDescription("✶ في وضع الغياب المؤقت (AFK)")
      .addFields(
        { name: "السبب", value: `📝 ${status.reason}`, inline: true },
        { name: "منذ", value: `⏳ ${minutesAgo} دقيقة`, inline: true },
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${NOTIFY_PREFIX}${targetId}`)
        .setLabel("نبهني عند عودته")
        .setEmoji("🔔")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`${MESSAGE_PREFIX}${targetId}`)
        .setLabel("اترك رسالة")
        .setEmoji("📧")
        .setStyle(ButtonStyle.Primary),
    );

    await message.channel.send({ embeds: [embed], components: [row] }).catch(() => undefined);
  }
}
