import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, type Message } from "discord.js";
import { INBOX_PREFIX, sendAfkNotices } from "../afk/notice";
import { clearAfk, createInbox, formatDuration, getAfk, setAfk } from "../afk/service";
import { buildBirthdayPanel, buildSetupMessage } from "../birthday/views";
import type { BotClient } from "../client";
import { config } from "../config";
import { CURRENCY, jenny } from "../constants";
import { ADOPT_ACCEPT_PREFIX, ADOPT_DECLINE_PREFIX, MARRY_ACCEPT_PREFIX, MARRY_DECLINE_PREFIX } from "../family/ids";
import { computeRelationship } from "../family/graph";
import { renderFamilyTree, toFamilyMember } from "../family/render";
import { canAdopt, canPropose, divorce, getFamilyView } from "../family/service";
import { buildMenuMessage } from "../menu/interactions";
import { QUEST_SETTINGS, type QuestId } from "../quests/definitions";
import { progressQuest, toAnnouncer } from "../quests/service";
import { progressWeeklyQuest } from "../quests/weeklyService";
import { getBirthday, isValidBirthday, setBirthday } from "../services/birthday";
import { recordMessage } from "../services/stats";
import type { BotEvent } from "../types";
import { logger } from "../utils/logger";

const CUSTOM_EMOJI = /<a?:\w+:\d+>/g;
const UNICODE_EMOJI = /\p{Extended_Pictographic}/gu;
const MEOW = /م+ي+ا+و+/;
/** يفعّل AFK إذا الرسالة "afk" لحالها أو "afk سبب..." (بدون سلاش) */
const AFK_TRIGGER = /^afk(?:\s+([\s\S]+))?$/i;
/** عيد الميلاد: "ميلاد" أو "birthday" أو "dob"، مع تاريخ اختياري بعدها (بدون سلاش أو زر) */
const BIRTHDAY_TRIGGER = /^(ميلاد|birthday|dob)(?:\s+([\s\S]+))?$/i;
/** نظام العائلة: زواج/طلاق/تبني/شجرة/قرابة (بدون سلاش) */
const MARRY_TRIGGER = /^تزوج\s+<@!?(\d+)>\s+مهر[:\s]+(\d+)$/i;
const ADOPT_TRIGGER = /^تبنى\s+<@!?(\d+)>$/i;
const RELATION_TRIGGER = /^قرابة\s+<@!?(\d+)>$/i;

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

    // --- القائمة الرئيسية بكتابة "p" لحالها ---
    if (rawContent.trim().toLowerCase() === "p") {
      await message.channel.send(buildMenuMessage()).catch(() => undefined);
      return;
    }

    // --- عيد الميلاد بكتابة "ميلاد" أو "birthday" أو "dob" (بدون سلاش أو زر) ---
    const birthdayTrigger = BIRTHDAY_TRIGGER.exec(rawContent.trim());
    if (birthdayTrigger) {
      const dateArg = birthdayTrigger[2]?.trim();

      if (dateArg) {
        const match = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(dateArg);
        if (!match) {
          await message.channel
            .send("❌ الصيغة غلط. اكتب: `ميلاد يوم/شهر/سنة`، مثال: `ميلاد 15/8/2001`")
            .catch(() => undefined);
          return;
        }
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        if (!isValidBirthday(day, month, year)) {
          await message.channel.send("❌ التاريخ غير صحيح.").catch(() => undefined);
          return;
        }
        await setBirthday(userId, guildId, day, month, year).catch((err) => logger.error("فشل حفظ عيد الميلاد", err));
        const panel = buildBirthdayPanel({ day, month, year }, message.member?.displayName ?? message.author.username, message.author.displayAvatarURL());
        await message.channel.send(panel).catch(() => undefined);
        return;
      }

      const existing = await getBirthday(userId, guildId).catch(() => null);
      if (!existing) {
        await message.channel.send(buildSetupMessage()).catch(() => undefined);
        return;
      }
      const panel = buildBirthdayPanel(existing, message.member?.displayName ?? message.author.username, message.author.displayAvatarURL());
      await message.channel.send(panel).catch(() => undefined);
      return;
    }

    // --- نظام العائلة: زواج/طلاق/تبني/شجرة/قرابة (بدون سلاش) ---
    const trimmed = rawContent.trim();

    const marryMatch = MARRY_TRIGGER.exec(trimmed);
    if (marryMatch) {
      const targetId = marryMatch[1];
      const dowry = Number(marryMatch[2]);
      const target = await message.client.users.fetch(targetId).catch(() => null);

      if (!target || target.bot || targetId === userId) {
        await message.channel.send("❌ ما تقدر تتزوج هذا الشخص.").catch(() => undefined);
        return;
      }

      const check = await canPropose(userId, targetId, guildId, dowry);
      if (!check.ok) {
        const reasons: Record<string, string> = {
          self: "❌ ما تقدر تتزوج نفسك.",
          proposer_married: "❌ أنت متزوج بالفعل، اكتب `طلاق` أول.",
          target_married: `❌ ${target} متزوج بالفعل.`,
          insufficient_dowry: "❌ رصيد محفظتك ما يكفي لهذا المهر.",
        };
        await message.channel.send(reasons[check.reason] ?? "❌ تعذّر إرسال العرض.").catch(() => undefined);
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${MARRY_ACCEPT_PREFIX}${userId}_${targetId}_${dowry}`)
          .setLabel("قبول")
          .setEmoji("💍")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${MARRY_DECLINE_PREFIX}${userId}_${targetId}_${dowry}`)
          .setLabel("رفض")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger),
      );

      await message.channel
        .send({
          content: `💍 <@${userId}> طلب الزواج من ${target} بمهر ${jenny(dowry)} ${CURRENCY.emoji}\n${target}، وافق أو ارفض بالأسفل.`,
          components: [row],
          allowedMentions: { users: [targetId] },
        })
        .catch(() => undefined);
      return;
    }

    if (trimmed === "طلاق") {
      const exSpouseId = await divorce(userId, guildId).catch((err) => {
        logger.error("فشل الطلاق", err);
        return null;
      });
      if (!exSpouseId) {
        await message.channel.send("❌ أنت مو متزوج أصلاً.").catch(() => undefined);
      } else {
        await message.channel.send(`💔 تم الطلاق بين <@${userId}> و<@${exSpouseId}>.`).catch(() => undefined);
      }
      return;
    }

    const adoptMatch = ADOPT_TRIGGER.exec(trimmed);
    if (adoptMatch) {
      const childId = adoptMatch[1];
      const target = await message.client.users.fetch(childId).catch(() => null);

      if (!target || target.bot || childId === userId) {
        await message.channel.send("❌ ما تقدر تتبنى هذا الشخص.").catch(() => undefined);
        return;
      }

      const check = await canAdopt(userId, childId, guildId);
      if (!check.ok) {
        const reasons: Record<string, string> = {
          self: "❌ ما تقدر تتبنى نفسك.",
          already_parent: `❌ أنت والد/والدة ${target} بالفعل.`,
          child_has_two_parents: `❌ عند ${target} والدان مسجّلان بالفعل.`,
          not_stepparent: `❌ لازم تكون متزوج من والد/والدة ${target} الحالي عشان تصير الوالد الثاني.`,
        };
        await message.channel.send(reasons[check.reason] ?? "❌ تعذّر إرسال طلب التبني.").catch(() => undefined);
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${ADOPT_ACCEPT_PREFIX}${userId}_${childId}`)
          .setLabel("قبول")
          .setEmoji("👶")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${ADOPT_DECLINE_PREFIX}${userId}_${childId}`)
          .setLabel("رفض")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger),
      );

      await message.channel
        .send({
          content: `👶 <@${userId}> يريد تبني ${target}\n${target}، وافق أو ارفض بالأسفل.`,
          components: [row],
          allowedMentions: { users: [childId] },
        })
        .catch(() => undefined);
      return;
    }

    if (trimmed === "شجرة") {
      const view = await getFamilyView(userId, guildId).catch(() => null);
      if (!view) {
        await message.channel.send("❌ تعذّر جلب شجرتك، حاول لاحقاً.").catch(() => undefined);
        return;
      }

      const resolveMember = async (id: string) => {
        const u = await message.client.users.fetch(id).catch(() => null);
        return u ? toFamilyMember({ userId: id }, u.username, u.displayAvatarURL({ size: 128 })) : null;
      };

      const ego = toFamilyMember(
        { userId },
        message.member?.displayName ?? message.author.username,
        message.author.displayAvatarURL({ size: 128 }),
      );
      const spouse = view.spouse ? await resolveMember(view.spouse.userId) : null;
      const parents = (await Promise.all(view.parents.map((p) => resolveMember(p.userId)))).filter((x) => x !== null);
      const siblings = (await Promise.all(view.siblings.map((s) => resolveMember(s.userId)))).filter((x) => x !== null);
      const children = (await Promise.all(view.children.map((c) => resolveMember(c.userId)))).filter((x) => x !== null);

      const buffer = await renderFamilyTree({ ego, spouse, parents, siblings, children }).catch((err) => {
        logger.error("فشل توليد صورة شجرة العائلة", err);
        return null;
      });

      if (!buffer) {
        await message.channel.send("❌ الخط العربي غير مثبت بعد، ما قدرت أرسم الشجرة.").catch(() => undefined);
        return;
      }

      await message.channel.send({ files: [{ attachment: buffer, name: "family-tree.png" }] }).catch(() => undefined);
      return;
    }

    const relationMatch = RELATION_TRIGGER.exec(trimmed);
    if (relationMatch) {
      const targetId = relationMatch[1];
      const target = await message.client.users.fetch(targetId).catch(() => null);
      if (!target) {
        await message.channel.send("❌ ما لقيت هذا العضو.").catch(() => undefined);
        return;
      }

      const result = await computeRelationship(userId, targetId, guildId).catch(() => null);
      if (!result) {
        await message.channel.send("❌ تعذّر فحص القرابة.").catch(() => undefined);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0xa855f7)
        .setTitle("🔍 نتيجة فحص القرابة")
        .setDescription(`بين <@${userId}> و${target}\n\n✨ **النتيجة:**\n${result.label}`);
      await message.channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => undefined);
      return;
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
    const jobs: Promise<void>[] = [recordMessage(guildId, userId).catch(() => undefined)];

    const track = (questId: QuestId, amount = 1, uid = userId) => {
      jobs.push(progressQuest(client, { guildId, userId: uid, questId, amount, channel }));
      jobs.push(progressWeeklyQuest(client, { guildId, userId: uid, questId, amount }));
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
