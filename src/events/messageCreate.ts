import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, type Message } from "discord.js";
import { INBOX_PREFIX, sendAfkNotices } from "../afk/notice";
import { clearAfk, createInbox, formatDuration, getAfk, setAfk } from "../afk/service";
import type { BotClient } from "../client";
import { config } from "../config";
import { QUEST_SETTINGS, type QuestId } from "../quests/definitions";
import { progressQuest, toAnnouncer } from "../quests/service";
import type { BotEvent } from "../types";
import { logger } from "../utils/logger";

const CUSTOM_EMOJI = /<a?:\w+:\d+>/g;
const UNICODE_EMOJI = /\p{Extended_Pictographic}/gu;
const MEOW = /م+ي+ا+و+/;
/** يفعّل AFK إذا الرسالة "afk" لحالها أو "afk سبب..." (بدون سلاش) */
const AFK_TRIGGER = /^afk(?:\s+([\s\S]+))?$/i;

const lastCounted = new Map<string, number>();

function countEmojis(text: string): number {
  const custom = text.match(CUSTOM_EMOJI)?.length ?? 0;
  const unicode = text.replace(CUSTOM_EMOJI, "").match(UNICODE_EMOJI)?.length ?? 0;
  return custom + unicode;
}

const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(client: BotClient, message: Message) {
    if (!message.inGuild() || message.author.bot || message.webhookId) return;

    const guildId = message.guildId;
    const userId = message.author.id;
    const rawContent = message.content ?? "";

    // --- تفعيل AFK بكتابة "afk" أو "afk سبب" (بدون سلاش) ---
    const trigger = AFK_TRIGGER.exec(rawContent.trim());
    if (trigger) {
      const member = message.member ?? (await message.guild?.members.fetch(userId).catch(() => null));
      if (member) {
        const reason = trigger[1]?.trim() || "بدون سبب";
        await setAfk(member, reason).catch((err) => logger.error("فشل تفعيل AFK", err));

        const embed = new EmbedBuilder()
          .setColor(0x818cf8)
          .setTitle("✶ غياب مؤقت")
          .setDescription("💤 تم تفعيل وضع الغياب المؤقت بنجاح")
          .setThumbnail(member.displayAvatarURL())
          .addFields({ name: "السبب", value: `📝 ${reason}` });

        await message.channel.send({ embeds: [embed] }).catch(() => undefined);
      }
      return; // ما نكمل تتبع مهام على رسالة الأمر نفسها
    }

    // --- رجوع من وضع AFK ---
    const wasAfk = await getAfk(guildId, userId).catch(() => null);
    if (wasAfk) {
      const member = message.member ?? (await message.guild?.members.fetch(userId).catch(() => null));
      if (member) {
        const result = await clearAfk(member).catch((err) => {
          logger.error("فشل إلغاء AFK", err);
          return null;
        });

        if (result) {
          const duration = formatDuration(Date.now() - result.status.since.getTime());
          const mentionCount = result.status.mentions.length;
          const mentioners = [...new Set(result.status.mentions)];

          const lines = [`👋 أهلاً بعودتك يا ${member}!`, `⏱️ مدة الغياب: ${duration}`];
          if (mentionCount > 0) {
            const names = mentioners.map((id) => `<@${id}>`).join("، ");
            lines.push(`📣 تم منشنتك **${mentionCount}** مرة، من: ${names}`);
          }
          if (result.status.messages.length > 0) {
            lines.push(`📬 لديك **${result.status.messages.length}** رسالة بانتظارك في صندوقك`);
          }

          const embed = new EmbedBuilder()
            .setColor(0x4ade80)
            .setThumbnail(member.displayAvatarURL())
            .setDescription(lines.join("\n"));

          const components: ActionRowBuilder<ButtonBuilder>[] = [];
          if (result.status.messages.length > 0) {
            await createInbox(guildId, userId, result.status.messages).catch((err) =>
              logger.error("فشل إنشاء صندوق AFK", err),
            );
            components.push(
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`${INBOX_PREFIX}${userId}`)
                  .setLabel("فتح الصندوق")
                  .setEmoji("📬")
                  .setStyle(ButtonStyle.Primary),
              ),
            );
          }

          await message.channel
            .send({ embeds: [embed], components, allowedMentions: { users: [...mentioners, userId] } })
            .catch(() => undefined);

          // إشعار من طلبوا التنبيه عند رجوعه
          if (result.status.notify.length > 0) {
            const mentions = result.status.notify.map((id) => `<@${id}>`).join(" ");
            await message.channel
              .send({ content: `🔔 ${mentions} رجع ${member} من الغياب!`, allowedMentions: { users: result.status.notify } })
              .catch(() => undefined);
          }
        }
      }
    }

    const channel = toAnnouncer(message.channel);
    const content = rawContent;
    const jobs: Promise<void>[] = [];

    const track = (questId: QuestId, amount = 1, uid = userId) => {
      jobs.push(progressQuest(client, { guildId, userId: uid, questId, amount, channel }));
    };

    // أرسل 5 رسائل (بفاصل زمني ضد السبام)
    const now = Date.now();
    if (now - (lastCounted.get(userId) ?? 0) >= QUEST_SETTINGS.messageGapMs) {
      lastCounted.set(userId, now);
      track("messages");
    }

    // صورة أو فيديو
    if (message.attachments.some((a) => a.contentType?.startsWith("image/") || a.contentType?.startsWith("video/"))) {
      track("media");
    }

    // ستيكرات
    if (message.stickers.size > 0) track("stickers", message.stickers.size);

    // إيموجي
    const emojis = countEmojis(content);
    if (emojis > 0) track("emojis", emojis);

    // مياو
    if (MEOW.test(content)) track("meow");

    // قناة العد
    if (config.countingChannelId && message.channelId === config.countingChannelId && /^\d+$/.test(content.trim())) {
      track("counting");
    }

    // رد على عضو + استلام رد/منشن
    const mentioned = new Set<string>();
    message.mentions.users.forEach((u) => {
      if (!u.bot && u.id !== userId) mentioned.add(u.id);
    });

    if (message.reference?.messageId) {
      const ref = await message.fetchReference().catch(() => null);
      if (ref && !ref.author.bot && ref.author.id !== userId) {
        track("reply");
        mentioned.add(ref.author.id);
      }
    }
    mentioned.forEach((id) => track("mention", 1, id));
    if (mentioned.size > 0) {
      await sendAfkNotices(message, mentioned).catch((err) => logger.error("خطأ في إشعار AFK", err));
    }

    const results = await Promise.allSettled(jobs);
    for (const r of results) {
      if (r.status === "rejected") logger.error("خطأ في تتبع المهام", r.reason);
    }
  },
};

export default event;
