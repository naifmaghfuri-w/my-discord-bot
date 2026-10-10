import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder,
  type BaseMessageOptions, type ButtonInteraction, type Message, type StringSelectMenuInteraction,
} from "discord.js";
import { UserProfile } from "../database/models/UserProfile";
import { getProfile } from "../services/economy";
import { dayKey, getStreak } from "../services/streak";
import { DEFAULT_SEP, SEPARATORS, applyStreakNick } from "./nick";

export const STREAK_TRIGGER = /^(ستريك|شعلة|streak)$/i;
const MENU = "stk_menu";
const SEP = "stk_sep";
const TOP_PREV = "stk_tprev";
const TOP_NEXT = "stk_tnext";
const PAGE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const parse = (id: string): { base: string; owner: string; extra: string } => {
  const [base, owner = "", extra = ""] = id.split("|");
  return { base, owner, extra };
};

export function buildStreakPanel(owner: string, streak: number, best: number): BaseMessageOptions {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("✶ لوحة الستريك")
    .setDescription(
      [
        "• أرسل أي رسالة في أي روم كل يوم عشان تزيد شعلتك 🔥",
        "• يظهر عدد أيامك بجانب اسمك، وتقدر تخفيه أو تغيّر شكله أو توقف إشعاراته.",
        "",
        `🔥 **شعلتك:** ${streak} يوم • 🏅 **أفضل شعلة:** ${best} يوم`,
      ].join("\n"),
    );
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${MENU}|${owner}`)
    .setPlaceholder("- افتح القائمة للتحكم بالستريك")
    .addOptions(
      { label: "اخفاء / اظهار", value: "hide", description: "يخفي او يظهر الستريك في اسمك", emoji: "🙈" },
      { label: "تغيير", value: "sep", description: "يغير ايقونة الفاصلة", emoji: "✨" },
      { label: "توب", value: "top", description: "يظهر اعلى مستعملي الستريك", emoji: "🏆" },
      { label: "اشعارات", value: "notify", description: "ايقاف او تشغيل 🔥 ورسائل المراحل", emoji: "🔔" },
    );
  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
}

export async function handleStreakMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const s = await getStreak(message.author.id, message.guildId);
  await message.channel.send(buildStreakPanel(message.author.id, s.streak, s.best)).catch(() => undefined);
}

async function topView(guildId: string, owner: string, page: number): Promise<BaseMessageOptions> {
  const filter = { guildId, streak: { $gt: 0 }, lastStreakDay: { $in: [dayKey(), dayKey(Date.now() - DAY_MS)] } };
  const total = await UserProfile.countDocuments(filter);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const p = Math.min(Math.max(page, 0), pages - 1);
  const rows = await UserProfile.find(filter, { userId: 1, streak: 1 }).sort({ streak: -1, userId: 1 }).skip(p * PAGE).limit(PAGE).lean();
  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.map((r, i) => {
    const rank = p * PAGE + i;
    return `${medals[rank] ?? `**#${rank + 1}**`} <@${r.userId}> — **${r.streak}** يوم 🔥`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("🏆 ملوك الستريك اليومي")
    .setDescription(lines.join("\n") || "ما فيه أحد عنده شعلة لسه.")
    .setFooter({ text: `الصفحة ${p + 1} من ${pages}` });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`${TOP_PREV}|${owner}|${p}`).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(p <= 0),
    new ButtonBuilder().setCustomId(`${TOP_NEXT}|${owner}|${p}`).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(p >= pages - 1),
  );
  return { embeds: [embed], components: [row] };
}

export async function handleStreakSelect(i: StringSelectMenuInteraction): Promise<boolean> {
  const { base, owner } = parse(i.customId);
  if (base !== MENU && base !== SEP) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== owner) {
    await i.reply({ content: "هذي مو لوحتك. اكتب `ستريك` لتفتح لوحتك.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const gid = i.guildId;
  const uid = i.user.id;
  const member = i.member && "manageable" in i.member ? i.member : await i.guild?.members.fetch(uid).catch(() => null);
  const choice = i.values[0];

  if (base === SEP) {
    if (!SEPARATORS.includes(choice as (typeof SEPARATORS)[number])) return true;
    const doc = await UserProfile.findOneAndUpdate({ userId: uid, guildId: gid }, { $set: { streakSep: choice } }, { new: true });
    if (member && doc) await applyStreakNick(member, doc.streak ?? 0, choice, Boolean(doc.streakHidden));
    await i.update({ content: `✅ تم تغيير فاصل الستريك الخاص بك إلى: \`${choice}\``, components: [] });
    return true;
  }

  if (choice === "hide") {
    const p = await getProfile(uid, gid);
    const hidden = !p.streakHidden;
    await UserProfile.updateOne({ userId: uid, guildId: gid }, { $set: { streakHidden: hidden } });
    const live = (await getStreak(uid, gid)).streak;
    if (member) await applyStreakNick(member, live, p.streakSep || DEFAULT_SEP, hidden);
    await i.reply({ content: hidden ? "✅ تم إخفاء الستريك." : "✅ تم إظهار الستريك.", flags: MessageFlags.Ephemeral });
  } else if (choice === "sep") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`${SEP}|${uid}`)
      .setPlaceholder("اختر الفاصل الذي تفضله...")
      .addOptions(SEPARATORS.map((x) => ({ label: x, value: x })));
    await i.reply({ content: "اختر مظهر الفاصل الجديد لاسمك:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], flags: MessageFlags.Ephemeral });
  } else if (choice === "top") {
    await i.reply({ ...(await topView(gid, uid, 0)), flags: MessageFlags.Ephemeral });
  } else if (choice === "notify") {
    const p = await getProfile(uid, gid);
    const on = p.streakNotify === false;
    await UserProfile.updateOne({ userId: uid, guildId: gid }, { $set: { streakNotify: on } });
    await i.reply({ content: `✅ تم ضبط إشعارات الستريك الخاصة بك إلى: **${on ? "مفعّلة" : "معطلة"}**.`, flags: MessageFlags.Ephemeral });
  }
  return true;
}

export async function handleStreakButton(i: ButtonInteraction): Promise<boolean> {
  const { base, owner, extra } = parse(i.customId);
  if (base !== TOP_PREV && base !== TOP_NEXT) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== owner) {
    await i.reply({ content: "افتح لوحتك بنفسك: `ستريك`.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const cur = Number(extra) || 0;
  await i.update(await topView(i.guildId, owner, base === TOP_NEXT ? cur + 1 : cur - 1));
  return true;
}
