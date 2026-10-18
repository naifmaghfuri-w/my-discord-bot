import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type GuildMember,
  type Message,
  type User,
} from "discord.js";
import { config } from "../config";
import { isCommandDisabled } from "../admin/commandToggle";
import { Warning } from "../database/models/Warning";
import { logModActionText } from "../logs/logger";
import { logger } from "../utils/logger";

/** كل 3 تحذيرات = كتم تلقائي ساعة */
const AUTO_TIMEOUT = { threshold: 3, minutes: 60 } as const;
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // حد ديسكورد
const UNIT_MS: Record<string, number> = { ث: 1000, د: 60_000, س: 3_600_000 };
const UNIT_NAME: Record<string, string> = { ث: "ثانية", د: "دقيقة", س: "ساعة" };

const MENTION = "<@!?(\\d+)>";
/** !تحذير @شخص سبب */
const WARN = new RegExp(`^!\\s*تحذير\\s+${MENTION}\\s+([\\s\\S]+)$`);
/** !تحذيرات @شخص */
const WARNINGS = new RegExp(`^!\\s*تحذيرات\\s+${MENTION}$`);
/** !ميوت @شخص 10 د سبب   (ث = ثواني، د = دقايق، س = ساعات) */
const MUTE = new RegExp(`^!\\s*ميوت\\s+${MENTION}\\s+(\\d+)\\s*([دثس])(?:\\s+([\\s\\S]+))?$`);
/** !نو ميوت @شخص */
const UNMUTE = new RegExp(`^!\\s*نو\\s*ميوت\\s+${MENTION}$`);
/** !بان @شخص سبب (أو ايدي) */
const BAN = new RegExp(`^!\\s*بان\\s+(?:${MENTION}|(\\d{17,20}))(?:\\s+([\\s\\S]+))?$`);
/** !نو بان @شخص (أو ايدي) */
const UNBAN = new RegExp(`^!\\s*نو\\s*بان\\s+(?:${MENTION}|(\\d{17,20}))$`);
/** !طرد @شخص سبب */
const KICK = new RegExp(`^!\\s*طرد\\s+${MENTION}(?:\\s+([\\s\\S]+))?$`);
/** نفس الأوامر بصيغة غلط: نعرض طريقة الاستخدام */
const LOOSE = /^!\s*(تحذير|تحذيرات|ميوت|نو\s*ميوت|بان|نو\s*بان|طرد)(?:\s|$)/;

const USAGE: Record<string, string> = {
  تحذير: "`!تحذير @شخص السبب`",
  تحذيرات: "`!تحذيرات @شخص`",
  ميوت: "`!ميوت @شخص 10 د السبب` (د دقايق، س ساعات، ث ثواني)",
  "نو ميوت": "`!نو ميوت @شخص`",
  بان: "`!بان @شخص السبب` (أو آيدي)",
  "نو بان": "`!نو بان آيدي_الشخص`",
  طرد: "`!طرد @شخص السبب`",
};

function can(message: Message<true>, perm: bigint): boolean {
  if (config.ownerId && message.author.id === config.ownerId) return true;
  return !!message.member?.permissions.has(perm);
}

async function log(message: Message<true>, action: string, target: { id: string } | null, extra: string): Promise<void> {
  try {
    await logModActionText(message.guild, message.author, action, target, message.channelId, extra);
  } catch (err) {
    logger.error("فشل تسجيل إجراء الإدارة", err);
  }
}

/** يرجع نص الخطأ لو ما يصير تطبق الإجراء على هذا العضو */
function hierarchyError(message: Message<true>, target: GuildMember): string | null {
  if (target.id === message.author.id) return "😅 ما تقدر تطبقها على نفسك.";
  if (target.id === message.guild.ownerId) return "❌ ما تقدر على مالك السيرفر.";
  const privileged = message.author.id === config.ownerId || message.author.id === message.guild.ownerId;
  const authorTop = message.member?.roles.highest.position ?? 0;
  if (!privileged && authorTop <= target.roles.highest.position) return "❌ رتبته أعلى منك أو مساوية لك.";
  return null;
}

async function renderWarnings(guildId: string, user: User) {
  const filter = { guildId, userId: user.id };
  const [list, total] = await Promise.all([
    Warning.find(filter).sort({ createdAt: -1 }).limit(10),
    Warning.countDocuments(filter),
  ]);

  if (total === 0) {
    return { content: `✅ ${user} ما عنده أي تحذيرات.` as string | null, embeds: [] as EmbedBuilder[], components: [] as ActionRowBuilder<ButtonBuilder>[], ids: [] as string[] };
  }

  const lines = list.map(
    (w, i) => `**${i + 1}.** ${w.reason}\n<t:${Math.floor(w.createdAt.getTime() / 1000)}:R> — بواسطة <@${w.moderatorId}>`,
  );
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`⚠️ تحذيرات ${user.username}`)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: `الإجمالي: ${total} (يعرض آخر 10) • اضغط 🗑️ برقم التحذير لحذفه` });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  list.forEach((_, i) => {
    if (i % 5 === 0) rows.push(new ActionRowBuilder<ButtonBuilder>());
    rows[rows.length - 1].addComponents(
      new ButtonBuilder().setCustomId(`wdel|${i}`).setLabel(String(i + 1)).setEmoji("🗑️").setStyle(ButtonStyle.Danger),
    );
  });

  return { content: null as string | null, embeds: [embed], components: rows, ids: list.map((w) => String(w._id)) };
}

/** يعالج أوامر الإدارة النصية. يرجع true لو الرسالة كانت أمراً (تم التعامل معها) */
export async function handleModerationText(message: Message<true>): Promise<boolean> {
  const text = message.content.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!text.startsWith("!") && !text.startsWith("！")) return false;

  const loose = LOOSE.exec(text);
  if (!loose) return false;

  const guild = message.guild;
  const reply = (content: string, ping: string[] = []) =>
    message.reply({ content, allowedMentions: { parse: [], users: ping, repliedUser: false } }).catch(() => undefined);

  const verb = loose[1].replace(/\s+/g, " ").replace("نوميوت", "نو ميوت").replace("نوبان", "نو بان");
  const perm =
    verb === "بان" || verb === "نو بان"
      ? PermissionFlagsBits.BanMembers
      : verb === "طرد"
        ? PermissionFlagsBits.KickMembers
        : PermissionFlagsBits.ModerateMembers;
  // من ما عنده صلاحية: نتجاهل بصمت
  if (!can(message, perm)) return false;

  // أمر موقوف من "!إعدادات المسؤول"
  if (await isCommandDisabled(guild.id, verb)) {
    await reply(`⛔ أمر **${verb}** موقوف حالياً.`);
    return true;
  }

  const fetchMember = (id: string) => guild.members.fetch(id).catch(() => null);

  // ---------- !تحذير ----------
  const warn = WARN.exec(text);
  if (warn) {
    const target = await fetchMember(warn[1]);
    if (!target) return (await reply("❌ ما لقيت هذا العضو في السيرفر."), true);
    const err = hierarchyError(message, target);
    if (err) return (await reply(err), true);

    const reason = warn[2].trim().slice(0, 200);
    await Warning.create({ guildId: guild.id, userId: target.id, moderatorId: message.author.id, reason });
    const total = await Warning.countDocuments({ guildId: guild.id, userId: target.id });

    let extra = "";
    if (total % AUTO_TIMEOUT.threshold === 0 && target.moderatable) {
      await target.timeout(AUTO_TIMEOUT.minutes * 60_000, `تحذيرات متكررة (${total})`).catch(() => undefined);
      extra = `\n🔇 وصل لـ ${AUTO_TIMEOUT.threshold} تحذيرات، تم كتمه تلقائياً ${AUTO_TIMEOUT.minutes} دقيقة.`;
    }

    await reply(`⚠️ تم تحذير ${target} (إجمالي التحذيرات: **${total}**)\nالسبب: ${reason}${extra}`, [target.id]);
    await log(message, "تحذير", target.user, `**السبب:** ${reason}\n**إجمالي التحذيرات:** ${total}${extra ? "\n🔇 كتم تلقائي" : ""}`);
    return true;
  }

  // ---------- !تحذيرات ----------
  const warnings = WARNINGS.exec(text);
  if (warnings) {
    const user = await message.client.users.fetch(warnings[1]).catch(() => null);
    if (!user) return (await reply("❌ ما لقيت هذا العضو."), true);

    const first = await renderWarnings(guild.id, user);
    const sent = await message
      .reply({
        ...(first.content ? { content: first.content } : {}),
        embeds: first.embeds,
        components: first.components,
        allowedMentions: { parse: [], repliedUser: false },
      })
      .catch(() => null);
    if (!sent || first.ids.length === 0) return true;

    let ids = first.ids;
    const collector = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: 2 * 60 * 1000 });

    collector.on("collect", async (i) => {
      const isMod = i.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) || i.user.id === config.ownerId;
      if (!isMod) {
        await i.reply({ content: "❌ للمشرفين فقط.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
        return;
      }
      await i.deferUpdate().catch(() => undefined);

      const id = ids[Number(i.customId.split("|")[1])];
      if (id) {
        const removed = await Warning.findOneAndDelete({ _id: id, guildId: guild.id, userId: user.id }).catch(() => null);
        if (removed) {
          try {
            await logModActionText(guild, i.user, "حذف تحذير", user, message.channelId, `**كان:** ${removed.reason}`);
          } catch (err) {
            logger.error("فشل تسجيل حذف التحذير", err);
          }
        }
      }

      const next = await renderWarnings(guild.id, user);
      ids = next.ids;
      await i.editReply({ content: next.content, embeds: next.embeds, components: next.components }).catch(() => undefined);
      if (next.ids.length === 0) collector.stop("empty");
    });

    collector.on("end", async (_c, reason) => {
      if (reason === "empty") return;
      await sent.edit({ components: [] }).catch(() => undefined);
    });
    return true;
  }

  // ---------- !ميوت ----------
  const mute = MUTE.exec(text);
  if (mute) {
    const target = await fetchMember(mute[1]);
    if (!target) return (await reply("❌ ما لقيت هذا العضو في السيرفر."), true);
    const err = hierarchyError(message, target);
    if (err) return (await reply(err), true);
    if (!target.moderatable) return (await reply("❌ ما أقدر أكتمه (رتبته أعلى مني أو مساوية)."), true);

    const n = Number(mute[2]);
    const unit = mute[3];
    const ms = n * UNIT_MS[unit];
    if (!Number.isSafeInteger(n) || n < 1) return (await reply("❌ المدة لازم تكون رقم أكبر من 0."), true);
    if (ms > MAX_TIMEOUT_MS) return (await reply("❌ أقصى مدة للميوت 28 يوم."), true);

    const reason = (mute[4] ?? "بدون سبب").trim().slice(0, 200);
    const label = `${n} ${UNIT_NAME[unit]}`;
    try {
      await target.timeout(ms, `${reason} | بواسطة ${message.author.tag}`);
    } catch (e) {
      logger.error("فشل الميوت", e);
      return (await reply("❌ ما قدرت أكتمه، تأكد من صلاحياتي."), true);
    }
    await reply(`🔇 تم كتم ${target} لمدة **${label}**\nالسبب: ${reason}`, [target.id]);
    await log(message, "كتم", target.user, `**السبب:** ${reason}\n**المدة:** ${label}`);
    return true;
  }

  // ---------- !نو ميوت ----------
  const unmute = UNMUTE.exec(text);
  if (unmute) {
    const target = await fetchMember(unmute[1]);
    if (!target) return (await reply("❌ ما لقيت هذا العضو في السيرفر."), true);
    if (!target.isCommunicationDisabled()) return (await reply("ℹ️ هذا العضو مو مكتوم."), true);
    try {
      await target.timeout(null, `رفع الكتم بواسطة ${message.author.tag}`);
    } catch (e) {
      logger.error("فشل رفع الميوت", e);
      return (await reply("❌ ما قدرت أرفع الكتم، تأكد من صلاحياتي."), true);
    }
    await reply(`🔊 تم رفع الكتم عن ${target}.`);
    await log(message, "رفع كتم", target.user, "");
    return true;
  }

  // ---------- !نو بان ----------
  const unban = UNBAN.exec(text);
  if (unban) {
    const id = unban[1] ?? unban[2];
    const ban = await guild.bans.fetch(id).catch(() => null);
    if (!ban) return (await reply("ℹ️ هذا الشخص مو محظور (أو الآيدي غلط)."), true);
    try {
      await guild.bans.remove(id, `رفع الحظر بواسطة ${message.author.tag}`);
    } catch (e) {
      logger.error("فشل رفع الحظر", e);
      return (await reply("❌ ما قدرت أرفع الحظر، تأكد من صلاحياتي."), true);
    }
    await reply(`✅ تم رفع الحظر عن **${ban.user.tag}**.`);
    await log(message, "رفع حظر", ban.user, "");
    return true;
  }

  // ---------- !بان ----------
  const ban = BAN.exec(text);
  if (ban) {
    const id = ban[1] ?? ban[2];
    if (id === message.author.id) return (await reply("😅 ما تقدر تحظر نفسك."), true);

    const user = await message.client.users.fetch(id).catch(() => null);
    if (!user) return (await reply("❌ ما لقيت هذا الشخص."), true);

    const member = await fetchMember(id);
    if (member) {
      const err = hierarchyError(message, member);
      if (err) return (await reply(err), true);
      if (!member.bannable) return (await reply("❌ ما أقدر أحظره (رتبته أعلى مني أو مساوية)."), true);
    }

    const reason = (ban[3] ?? "بدون سبب").trim().slice(0, 200);
    try {
      await guild.members.ban(id, { reason: `${reason} | بواسطة ${message.author.tag}` });
    } catch (e) {
      logger.error("فشل الحظر", e);
      return (await reply("❌ ما قدرت أحظره، تأكد من صلاحياتي."), true);
    }
    await reply(`🔨 تم حظر **${user.tag}**\nالسبب: ${reason}`);
    await log(message, "حظر", user, `**السبب:** ${reason}`);
    return true;
  }

  // ---------- !طرد ----------
  const kick = KICK.exec(text);
  if (kick) {
    const target = await fetchMember(kick[1]);
    if (!target) return (await reply("❌ ما لقيت هذا العضو في السيرفر."), true);
    const err = hierarchyError(message, target);
    if (err) return (await reply(err), true);
    if (!target.kickable) return (await reply("❌ ما أقدر أطرده (رتبته أعلى مني أو مساوية)."), true);

    const reason = (kick[2] ?? "بدون سبب").trim().slice(0, 200);
    try {
      await target.kick(`${reason} | بواسطة ${message.author.tag}`);
    } catch (e) {
      logger.error("فشل الطرد", e);
      return (await reply("❌ ما قدرت أطرده، تأكد من صلاحياتي."), true);
    }
    await reply(`👢 تم طرد **${target.user.tag}**\nالسبب: ${reason}`);
    await log(message, "طرد", target.user, `**السبب:** ${reason}`);
    return true;
  }

  // صيغة غلط
  await reply(`❌ الصيغة: ${USAGE[verb] ?? ""}`);
  return true;
}
