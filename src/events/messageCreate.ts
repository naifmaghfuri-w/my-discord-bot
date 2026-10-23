import { handleModerationText } from "../moderation/text";
import { handleBankText } from "../bank/text";
import { handleGiveMessage } from "../balance/give";
import { handleColorMessage } from "../colors/text";
import { handleWhisperMessage } from "../whisper/interactions";
import { handleBotProfileMessage } from "../botprofile/interactions";
import { handleAdminSettingsMessage } from "../admin/settings";
import { ROB_TRIGGER, handleRobMessage } from "../rob/text";
import { BALANCE_TRIGGER, handleBalanceMessage } from "../balance/text";
import { handleEconomyTextCommand } from "../handlers/economyText";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, type Message } from "discord.js";
import { INBOX_PREFIX, sendAfkNotices } from "../afk/notice";
import { arCount, clearAfk, createInbox, getAfk, setAfk } from "../afk/service";
import { buildBirthdayPanel, buildSetupMessage } from "../birthday/views";
import type { BotClient } from "../client";
import { config } from "../config";
import { CURRENCY, jenny } from "../constants";
import { getGender, type Gender } from "../family/gender";
import { touchRoom } from "../chat/service";
import { handleTalkMessage, handleTalkReply } from "../talk";
import { COMPANY_HUB_TRIGGER, COMPANY_MINE_TRIGGER, handleCompanyMessage, handleCompanyWorkMessage } from "../companies";
import { JOBS_GUIDE_TRIGGER, buildJobsGuide } from "../jobs/guide";
import { JOBS_TRIGGER, PROMO_TRIGGER, RESIGN_TRIGGER, WORK_TRIGGER, handleJobMessage } from "../jobs/interactions";
import { DUEL_TRIGGER, HUNTER_TRIGGER, handleDuelMessage, handleHunterMessage } from "../hunter/interactions";
import { handleCountingMessage } from "../counting/service";
import { CLEAR_TRIGGER, handleClearMessage } from "../moderation/clearText";
import { handleTextCommand } from "../handlers/textCommands";
import { buildLabHub } from "../lab/interactions";
import { TRADE_TRIGGER, startTradeFromMessage } from "../lab/trade";
import { handleLabTasksMessage } from "../lab/tasks";
import { buildLabCard } from "../lab/views";
import { LabProfile } from "../database/models/LabProfile";
import { computeRelationship } from "../family/graph";
import { ADOPT_ACCEPT_PREFIX, ADOPT_DECLINE_PREFIX, MARRY_ACCEPT_PREFIX, MARRY_DECLINE_PREFIX, SIB_ACCEPT_PREFIX, SIB_DECLINE_PREFIX } from "../family/ids";
import { sendFamilyTree } from "../family/treeView";
import { handleGamesMessage } from "../games";
import { handleCoinMessage } from "../games/coin";
import { MARRIAGE_TRIGGER, buildMarriageGuide } from "../family/guide";
import { canAdopt, canPropose, canSibling, disown, getParents, khulaDivorce, runAway, talaqDivorce } from "../family/service";
import { getBirthday, parseBirthdayInput, setBirthday } from "../services/birthday";
import { recordMessage } from "../services/stats";
import { tickStreak } from "../services/streak";
import { LEVEL_TRIGGER, awardMessageXp, handleLevelMessage } from "../level/text";
import { STREAK_TRIGGER, handleStreakMessage } from "../streak/interactions";
import { applyStreakNick } from "../streak/nick";
import type { BotEvent } from "../types";
import { logger } from "../utils/logger";

/** يفعّل AFK إذا الرسالة "afk" لحالها أو "afk سبب..." (بدون سلاش) */
const AFK_TRIGGER = /^afk(?:\s+([\s\S]+))?$/i;
/** عيد الميلاد: "ميلاد" أو "birthday" أو "dob"، مع تاريخ اختياري بعدها (بدون سلاش أو زر) */
const BIRTHDAY_TRIGGER = /^!\s*(ميلاد|birthday|dob)(?:\s+([\s\S]+))?$/i;
/** نظام العائلة: زواج/طلاق/خلع/تبني/تبرؤ/شجرة/قرابة (بدون سلاش) */
const MARRY_TRIGGER = /^!\s*زواج\s+<@!?(\d+)>\s+(\d+)$/;
const TALAQ_TRIGGER = /^!\s*طلاق(?:\s+<@!?(\d+)>)?$/i;
const ADOPT_TRIGGER = /^!\s*تبن[ىي]\s+<@!?(\d+)>$/i;
const DISOWN_TRIGGER = /^!\s*تبرؤ\s+<@!?(\d+)>$/i;
/** طلب أخ / أخت: "!اخ @شخص" أو "!اخت @شخص" */
const SIBLING_TRIGGER = /^!\s*[اأإ]خ(ت)?\s+<@!?(\d+)>$/;
/** هروب: الابن يتخلى عن عائلته بالكامل */
const RUNAWAY_TRIGGER = /^!\s*(?:هروب|هرب)$/i;
/** شجرة العائلة: "شجرة" لشجرتك، أو "شجرة @شخص" لشجرة غيرك */
const TREE_TRIGGER = /^!\s*شجرة(?:\s+<@!?(\d+)>)?$/;
const RELATION_TRIGGER = /^!\s*قرابة\s+<@!?(\d+)>$/i;


/** قنوات العد (كل قناة لها عدّاد مستقل). أضف أي ID جديد هنا */
const EXTRA_COUNTING_CHANNELS = ["1551164925001342986"];
const countingChannels = (): string[] => [config.countingChannelId, ...EXTRA_COUNTING_CHANNELS].filter((id): id is string => !!id);


const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(client: BotClient, message: Message) {
    if (!message.inGuild() || message.author.bot || message.webhookId) return;

    // 🔥 شعلة النشاط: أي رسالة (نص/صورة/ايموجي/ستيكر) في أي روم تحسب يوم (تظهر بجانب الاسم فقط)
    void tickStreak(message.author.id, message.guildId).then((t) => {
      if (!t) return;
      if (message.member) void applyStreakNick(message.member, t.streak, t.sep, t.hidden);
    });

    // --- قناة العد: رقم صحيح (أو عملية ناتجها الرقم الصحيح) يتعلّم، وأي شيء ثاني يُمسح بدون ما يحسب لأي مهمة ---
    if (countingChannels().includes(message.channelId)) {
      const result = await handleCountingMessage(message);
      if (result === "wrong") return; // انمسحت: كأنها ما انكتبت
    }

    const guildId = message.guildId;
    const userId = message.author.id;
    const rawContent = message.content ?? "";

    // نشاط بالدردشات الخاصة (يمنع حذفها كخاملة)
    touchRoom(message.channelId);

    // --- البوت المتحدث: يرد في غرفته أو عند منشنه (بدون ما يوقف باقي الأنظمة) ---
    void handleTalkReply(message);

    // --- تفعيل AFK بكتابة "afk" أو "afk سبب" (بدون سلاش) ---
    const trigger = AFK_TRIGGER.exec(rawContent.trim());
    if (trigger) {
      const member = message.member ?? (await message.guild?.members.fetch(userId).catch(() => null));
      if (member) {
        const reason = trigger[1]?.trim() || "بدون سبب";
        await setAfk(member, reason).catch((err) => logger.error("فشل تفعيل AFK", err));

        const embed = new EmbedBuilder()
          .setColor(0x22c55e)
          .setTitle("★ غياب مؤقت")
          .setDescription(["💤 تم تفعيل وضع الغياب المؤقت بنجاح", "", `📝 **السبب:** ${reason}`].join("\n"))
          .setThumbnail(member.displayAvatarURL());

        await message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } }).catch(() => undefined);
      }
      return; // ما نكمل تتبع مهام على رسالة الأمر نفسها
    }

    // --- مسح رسائل: "clear 10" أو "clear 10 @شخص" أو "clear 10 <ايدي>" (بدون سلاش) ---
    const clearTrigger = CLEAR_TRIGGER.exec(rawContent.trim());
    if (clearTrigger && (await handleClearMessage(message, clearTrigger[1]))) return;

    // --- لوحة تشغيل/إيقاف الأوامر الإدارية: "!إعدادات المسؤول" ---
    if (await handleAdminSettingsMessage(message)) return;
    if (await handleTalkMessage(message)) return;

    // --- إدارة: !تحذير !تحذيرات !ميوت !نو ميوت !بان !نو بان ---
    if (await handleModerationText(message)) return;

    // --- مبارزة لاعبين: "قتال @شخص 500" ---
    const duelMatch = DUEL_TRIGGER.exec(rawContent.trim());
    if (duelMatch) {
      await handleDuelMessage(message, duelMatch);
      return;
    }

    // --- الوظائف: "وظائف" / "دوام" / "استقالة" ---
    if (LEVEL_TRIGGER.test(rawContent.trim())) {
      await handleLevelMessage(message);
      return;
    }
    if (STREAK_TRIGGER.test(rawContent.trim())) {
      await handleStreakMessage(message);
      return;
    }
    if (JOBS_GUIDE_TRIGGER.test(rawContent.trim())) {
      await message.channel.send({ embeds: [buildJobsGuide()] }).catch(() => undefined);
      return;
    }
    if (COMPANY_HUB_TRIGGER.test(rawContent.trim()) || COMPANY_MINE_TRIGGER.test(rawContent.trim())) {
      await handleCompanyMessage(message);
      return;
    }
    if (JOBS_TRIGGER.test(rawContent.trim())) {
      await handleJobMessage(message, "panel");
      return;
    }
    if (WORK_TRIGGER.test(rawContent.trim())) {
      if (await handleCompanyWorkMessage(message, "work")) return;
      await handleJobMessage(message, "work");
      return;
    }
    if (PROMO_TRIGGER.test(rawContent.trim())) {
      await handleJobMessage(message, "promo");
      return;
    }
    if (RESIGN_TRIGGER.test(rawContent.trim())) {
      if (await handleCompanyWorkMessage(message, "resign")) return;
      await handleJobMessage(message, "resign");
      return;
    }

    // --- لعبة هنتر ---
    if (HUNTER_TRIGGER.test(rawContent.trim())) {
      await handleHunterMessage(message);
      return;
    }

    // --- العملة: "!عملة صورة|كتابة" فردي، أو "!عملة @شخص مبلغ" ---
    if (await handleCoinMessage(message)) return;

    // --- قائمة الألعاب: "!العاب" ---
    if (await handleGamesMessage(message).catch(() => false)) return;

    // --- دليل أوامر العائلة: "!زواج" ---
    if (MARRIAGE_TRIGGER.test(rawContent.trim())) {
      await message.channel.send({ embeds: [buildMarriageGuide()] }).catch(() => undefined);
      return;
    }

    // --- باقي الأوامر بالكتابة بدون سلاش: "ban @شخص سبب"، "pay @شخص 100"، "daily"... ---
    // --- "!اعطى عدد": للمالك فقط ---
    if (await handleGiveMessage(message)) return;

    // --- لوحة الألوان: "!لون" ---
    if (await handleColorMessage(message)) return;

    // --- الهمسات: "!همسة @شخص" ---
    if (await handleWhisperMessage(message)) return;

    // --- تخصيص البوت لكل سيرفر: "!ايقونة البوت" (للمالك) ---
    if (await handleBotProfileMessage(message)) return;

    // --- الرصيد: "!رصيدي" لرصيدك، "!رصيد @شخص" لرصيد غيرك ---
    if (BALANCE_TRIGGER.test(rawContent.trim())) {
      await handleBalanceMessage(message);
      return;
    }

    // --- النهب: "!نهب @شخص" (لعبة تخمين: مال / فخ / فارغ) ---
    const robMatch = ROB_TRIGGER.exec(rawContent.trim());
    if (robMatch) {
      await handleRobMessage(message, robMatch[1]);
      return;
    }

    // --- البنك: "!ايداع 500" / "!سحب 500" / "!رصيدي بنكي" ---
    if (await handleBankText(message)) return;

    if (await handleEconomyTextCommand(message)) return;
    if (await handleTextCommand(client, message)) return;

    // --- مختبر لاعب آخر: "lab @شخص" ---
    const labCardMatch = /^lab\s+<@!?(\d+)>$/i.exec(rawContent.trim());
    if (labCardMatch) {
      const targetId = labCardMatch[1];
      const targetUser = await message.client.users.fetch(targetId).catch(() => null);
      if (!targetUser || targetUser.bot) {
        await message.channel.send("❌ ما لقيت هذا العضو.").catch(() => undefined);
        return;
      }
      const targetProfile = await LabProfile.findOne({ userId: targetId, guildId }).catch(() => null);
      if (!targetProfile) {
        await message.channel.send(`🧪 ${targetUser.username} ما فتح مختبره بعد.`).catch(() => undefined);
        return;
      }
      const targetMember = await message.guild.members.fetch(targetId).catch(() => null);
      const card = buildLabCard(targetProfile, targetMember?.displayName ?? targetUser.username, targetUser.displayAvatarURL());
      await message.channel.send({ ...card, allowedMentions: { parse: [] } }).catch(() => undefined);
      return;
    }

    // --- مهام المختبر: "$LT" (روم مخصص فقط) ---
    if (await handleLabTasksMessage(message).catch(() => false)) return;

    // --- تبادل مركبات: "عرض @شخص السعر [الكمية]" ---
    const tradeMatch = TRADE_TRIGGER.exec(rawContent.trim());
    if (tradeMatch) {
      await startTradeFromMessage(message, tradeMatch[1], Number(tradeMatch[2]), Number(tradeMatch[3] ?? 1)).catch((err) =>
        logger.error("فشل بدء عرض تبادل", err),
      );
      return;
    }

    // --- مختبر الكيمياء بكتابة "lab" لحالها (بدون سلاش) ---
    if (rawContent.trim().toLowerCase() === "lab") {
      const panel = await buildLabHub(
        userId,
        guildId,
        message.member?.displayName ?? message.author.username,
        message.author.displayAvatarURL(),
      ).catch((err) => {
        logger.error("فشل فتح المختبر", err);
        return null;
      });
      if (panel) await message.channel.send(panel).catch(() => undefined);
      return;
    }

    // --- عيد الميلاد: "ميلاد" / "birthday" / "dob" + (تاريخ | @شخص) اختياري ---
    const birthdayTrigger = BIRTHDAY_TRIGGER.exec(rawContent.trim());
    if (birthdayTrigger) {
      const arg = birthdayTrigger[2]?.trim();
      const selfName = message.member?.displayName ?? message.author.username;
      const mention = arg ? /^<@!?(\d+)>$/.exec(arg) : null;

      // عرض ميلاد شخص ثاني: ميلاد @شخص
      if (mention) {
        const targetId = mention[1];
        const target = await message.client.users.fetch(targetId).catch(() => null);
        if (!target || target.bot) {
          await message.channel.send("❌ ما لقيت هذا العضو.").catch(() => undefined);
          return;
        }
        const targetBirthday = await getBirthday(targetId, guildId).catch(() => null);
        if (!targetBirthday) {
          await message.channel
            .send({ content: `❌ <@${targetId}> ما سجّل عيد ميلاده بعد.`, allowedMentions: { parse: [] } })
            .catch(() => undefined);
          return;
        }
        const targetMember = await message.guild?.members.fetch(targetId).catch(() => null);
        const panel = buildBirthdayPanel(
          targetBirthday,
          targetMember?.displayName ?? target.username,
          target.displayAvatarURL(),
          false,
        );
        await message.channel.send(panel).catch(() => undefined);
        return;
      }

      // تسجيل تاريخ: ميلاد 15/8/2001 أو ميلاد 15/8
      if (arg) {
        const parsed = parseBirthdayInput(arg);
        if (parsed === "format") {
          await message.channel
            .send("❌ الصيغة غلط. اكتب `!ميلاد يوم/شهر/سنة`، مثل `!ميلاد 15/8/2001` (أو `!ميلاد 15/8` بدون سنة).")
            .catch(() => undefined);
          return;
        }
        if (parsed === "invalid") {
          await message.channel.send("❌ هذا التاريخ غير صحيح.").catch(() => undefined);
          return;
        }
        await setBirthday(userId, guildId, parsed.day, parsed.month, parsed.year).catch((err) =>
          logger.error("فشل حفظ عيد الميلاد", err),
        );
        const saved = await getBirthday(userId, guildId).catch(() => null);
        if (saved) {
          await message.channel
            .send(buildBirthdayPanel(saved, selfName, message.author.displayAvatarURL()))
            .catch(() => undefined);
        }
        return;
      }

      const existing = await getBirthday(userId, guildId).catch(() => null);
      if (!existing) {
        await message.channel.send(buildSetupMessage()).catch(() => undefined);
        return;
      }
      await message.channel
        .send(buildBirthdayPanel(existing, selfName, message.author.displayAvatarURL()))
        .catch(() => undefined);
      return;
    }

    // --- نظام العائلة: زواج/طلاق/خلع/تبني/تبرؤ/شجرة/قرابة (بدون سلاش) ---
    // نحوّل الأرقام العربية (٠-٩) لإنجليزية حتى يشتغل "مهر ٠" أو "مهر ٥٠٠"
    const trimmed = rawContent.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const guild = message.guild;

    const marryMatch = MARRY_TRIGGER.exec(trimmed);
    if (marryMatch) {
      const targetId = marryMatch[1];
      const dowry = Number(marryMatch[2]);
      const target = await message.client.users.fetch(targetId).catch(() => null);

      if (!target || target.bot || targetId === userId) {
        await message.channel.send("❌ ما تقدر تتزوج هذا الشخص.").catch(() => undefined);
        return;
      }

      const [fromMember, toMember] = await Promise.all([
        message.member ?? guild.members.fetch(userId).catch(() => null),
        guild.members.fetch(targetId).catch(() => null),
      ]);
      const fromGender: Gender = fromMember ? getGender(fromMember) : null;
      const toGender: Gender = toMember ? getGender(toMember) : null;

      const check = await canPropose(userId, targetId, guildId, dowry, fromGender, toGender);
      if (!check.ok) {
        const reasons: Record<string, string> = {
          self: "❌ ما تقدر تتزوج نفسك.",
          gender_unknown: "❌ لازم تكون أنت والطرف الثاني عندكم رتبة ذكر/أنثى محددة حتى يشتغل الزواج.",
          same_gender: "❌ الزواج لازم يكون بين ذكر وأنثى.",
          proposer_full: "❌ وصلت للحد الأقصى من الزوجات/الأزواج.",
          target_full: `❌ ${target} وصل للحد الأقصى من الزوجات/الأزواج.`,
          already_married_each_other: "❌ أنتما متزوجان من بعض بالفعل.",
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
          content: `💍 <@${userId}> طلب الزواج من ${target} ${dowry > 0 ? `بمهر ${jenny(dowry)} ${CURRENCY.emoji}` : "بدون مهر"}\n${target}، وافق أو ارفض بالأسفل.`,
          components: [row],
          allowedMentions: { users: [targetId] },
        })
        .catch(() => undefined);
      return;
    }

    const talaqMatch = TALAQ_TRIGGER.exec(trimmed);
    if (talaqMatch) {
      const member = message.member ?? (await guild.members.fetch(userId).catch(() => null));
      const gender = member ? getGender(member) : null;

      if (gender !== "male") {
        await message.channel.send("❌ أمر `طلاق` للزوج بس. الزوجة تستخدم `خلع`.").catch(() => undefined);
        return;
      }

      const wifeId = talaqMatch[1];
      const result = await talaqDivorce(userId, guildId, wifeId).catch((err) => {
        logger.error("فشل الطلاق", err);
        return { ok: false as const, reason: "not_married" as const };
      });

      if (!result.ok) {
        const reasons: Record<string, string> = {
          not_married: "❌ أنت مو متزوج أصلاً.",
          not_found: "❌ هذا الشخص مو زوجتك.",
          specify_wife: "❌ عندك أكثر من زوجة، حدد وحدة: `طلاق @الزوجة`",
        };
        await message.channel.send(reasons[result.reason] ?? "❌ تعذّر الطلاق.").catch(() => undefined);
        return;
      }

      await message.channel.send(`💔 تم الطلاق بين <@${userId}> و<@${result.exSpouseId}>.`).catch(() => undefined);
      return;
    }

    if (/^!\s*خلع$/.test(trimmed)) {
      const member = message.member ?? (await guild.members.fetch(userId).catch(() => null));
      const gender = member ? getGender(member) : null;

      if (gender !== "female") {
        await message.channel.send("❌ أمر `خلع` للزوجة بس. الزوج يستخدم `طلاق`.").catch(() => undefined);
        return;
      }

      const result = await khulaDivorce(userId, guildId).catch((err) => {
        logger.error("فشل الخلع", err);
        return { ok: false as const, reason: "not_married" as const };
      });

      if (!result.ok) {
        const text =
          result.reason === "insufficient_refund"
            ? `❌ الخلع يتطلب إرجاع نصف المهر لزوجك، وتحتاجين ${jenny(result.needed)} ${CURRENCY.emoji} في محفظتك.`
            : "❌ أنتِ مو متزوجة أصلاً.";
        await message.channel.send(text).catch(() => undefined);
        return;
      }

      const refundText = result.refund ? ` وأرجعت نصف المهر (${jenny(result.refund)} ${CURRENCY.emoji}) لزوجها.` : ".";
      await message.channel.send(`💔 طلبت <@${userId}> الخلع من <@${result.exSpouseId}>${refundText}`).catch(() => undefined);
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

      const parentMember = message.member ?? (await guild.members.fetch(userId).catch(() => null));
      const parentGender: Gender = parentMember ? getGender(parentMember) : null;

      const existingParents = await getParents(childId, guildId);
      const existingGenders: Gender[] = await Promise.all(
        existingParents.map(async (p) => {
          const m = await guild.members.fetch(p.userId).catch(() => null);
          return m ? getGender(m) : null;
        }),
      );

      const check = await canAdopt(userId, childId, guildId, parentGender, existingGenders);
      if (!check.ok) {
        const reasons: Record<string, string> = {
          self: "❌ ما تقدر تتبنى نفسك.",
          gender_unknown: "❌ لازم تكون عندك رتبة ذكر/أنثى محددة حتى يشتغل التبني.",
          already_parent: `❌ أنت والد/والدة ${target} بالفعل.`,
          same_gender_parent: `❌ عند ${target} والد من نفس جنسك مسجّل بالفعل.`,
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

    const sibMatch = SIBLING_TRIGGER.exec(trimmed);
    if (sibMatch) {
      const wantsSister = Boolean(sibMatch[1]);
      const targetId = sibMatch[2];
      const target = await message.client.users.fetch(targetId).catch(() => null);
      if (!target || target.bot || targetId === userId) {
        await message.channel.send("❌ ما تقدر تطلب هذا الشخص.").catch(() => undefined);
        return;
      }
      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      const targetGender: Gender = targetMember ? getGender(targetMember) : null;
      if (!targetGender) {
        await message.channel.send(`❌ ما قدرت أتأكد من جنس ${target} (محتاج رتبة ذكر/أنثى).`).catch(() => undefined);
        return;
      }
      if (wantsSister && targetGender !== "female") {
        await message.channel.send(`❌ ${target} مو أنثى، استخدم \`!اخ\`.`).catch(() => undefined);
        return;
      }
      if (!wantsSister && targetGender !== "male") {
        await message.channel.send(`❌ ${target} مو ذكر، استخدم \`!اخت\`.`).catch(() => undefined);
        return;
      }
      const check = await canSibling(userId, targetId, guildId);
      if (!check.ok) {
        const reasons: Record<string, string> = {
          self: "❌ ما تقدر تسوي هذا مع نفسك.",
          already_siblings: `❌ أنت و${target} إخوة بالفعل.`,
          related: `❌ بينك وبين ${target} قرابة مباشرة (زواج أو أبوة).`,
        };
        await message.channel.send(reasons[check.reason] ?? "❌ تعذّر إرسال الطلب.").catch(() => undefined);
        return;
      }
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${SIB_ACCEPT_PREFIX}${userId}_${targetId}`).setLabel("قبول").setEmoji("🤝").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`${SIB_DECLINE_PREFIX}${userId}_${targetId}`).setLabel("رفض").setEmoji("❌").setStyle(ButtonStyle.Danger),
      );
      await message.channel
        .send({
          content: `🤝 <@${userId}> يبي ${target} يكون ${wantsSister ? "أخته" : "أخوه"}\n${target}، وافق أو ارفض بالأسفل.`,
          components: [row],
          allowedMentions: { users: [targetId] },
        })
        .catch(() => undefined);
      return;
    }

    const disownMatch = DISOWN_TRIGGER.exec(trimmed);
    if (disownMatch) {
      const childId = disownMatch[1];
      const result = await disown(userId, childId, guildId).catch((err) => {
        logger.error("فشل التبرؤ", err);
        return { ok: false as const, reason: "not_your_child" as const };
      });

      if (!result.ok) {
        await message.channel.send("❌ هذا الشخص مو ابنك.").catch(() => undefined);
        return;
      }

      await message.channel
        .send(`⚠️ تبرّأ <@${userId}> من <@${childId}>.`)
        .catch(() => undefined);
      return;
    }

    if (RUNAWAY_TRIGGER.test(trimmed)) {
      const result = await runAway(userId, guildId).catch((err) => {
        logger.error("فشل الهروب", err);
        return { ok: false as const, reason: "no_family" as const };
      });
      if (!result.ok) {
        await message.channel.send("❌ ما عندك عائلة مسجّلة عشان تهرب منها.").catch(() => undefined);
        return;
      }
      await message.channel
        .send(`🏃 هرب <@${userId}> من عائلته وتخلى عن الجميع.`)
        .catch(() => undefined);
      return;
    }

    const treeMatch = TREE_TRIGGER.exec(trimmed);
    if (treeMatch) {
      await sendFamilyTree(message, treeMatch[1] ?? userId).catch((err) => {
        logger.error("فشل أمر شجرة العائلة", err);
      });
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

      const targetMember = await guild.members.fetch(targetId).catch(() => null);
      const result = await computeRelationship(userId, targetId, guildId, targetMember ? getGender(targetMember) : null).catch(() => null);
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
          const sinceUnix = Math.floor(result.status.since.getTime() / 1000);
          const mentionCount = result.status.mentions.length;
          const mentioners = [...new Set(result.status.mentions)];

          const lines = [`👋 ★أهلاً بعودتك يا ${member}!`, `⏱️ ★**مدة الغياب:** <t:${sinceUnix}:R>`];
          if (mentionCount > 0) {
            const names = mentioners.map((id) => `<@${id}>`).join("، ");
            lines.push(`انمنشنت **${arCount(mentionCount, "مرة", "مرتين", "مرات")}** من ${names}.`);
          }
          if (result.status.messages.length > 0) {
            lines.push(`عندك **${arCount(result.status.messages.length, "رسالة", "رسالتين", "رسائل")}** بانتظارك في الصندوق.`);
          }

          const components: ActionRowBuilder<ButtonBuilder>[] = [];
          if (result.status.messages.length > 0) {
            await createInbox(guildId, userId, result.status.messages).catch((err) =>
              logger.error("فشل إنشاء صندوق AFK", err),
            );
            components.push(
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(`${INBOX_PREFIX}${userId}`)
                  .setLabel("افتح الصندوق")
                  .setStyle(ButtonStyle.Primary),
              ),
            );
          }

          await message.channel
            .send({ content: lines.join("\n"), components, allowedMentions: { users: [...mentioners, userId] } })
            .catch(() => undefined);

          // إشعار من طلبوا التنبيه عند رجوعه
          if (result.status.notify.length > 0) {
            const mentions = result.status.notify.map((id) => `<@${id}>`).join(" ");
            await message.channel
              .send({ content: `${mentions}، ${member} رجع من الغياب.`, allowedMentions: { users: result.status.notify } })
              .catch(() => undefined);
          }
        }
      }
    }

    const jobs: Promise<void>[] = [recordMessage(guildId, userId).catch(() => undefined), awardMessageXp(message).catch(() => undefined)];

    // رد على عضو + استلام رد/منشن
    const mentioned = new Set<string>();
    message.mentions.users.forEach((u) => {
      if (!u.bot && u.id !== userId) mentioned.add(u.id);
    });

    if (message.reference?.messageId) {
      const ref = await message.fetchReference().catch(() => null);
      if (ref && !ref.author.bot && ref.author.id !== userId) {
        mentioned.add(ref.author.id);
      }
    }
    if (mentioned.size > 0) {
      await sendAfkNotices(message, mentioned).catch((err) => logger.error("خطأ في إشعار AFK", err));
    }

    const results = await Promise.allSettled(jobs);
    for (const r of results) {
      if (r.status === "rejected") logger.error("خطأ في معالجة الرسالة", r.reason);
    }
  },
};

export default event;
