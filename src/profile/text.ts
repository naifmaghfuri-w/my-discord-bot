import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type Guild,
  type Message,
  type StringSelectMenuInteraction,
} from "discord.js";
import { ProfileStyle } from "../database/models/ProfileStyle";
import { BACKGROUNDS, COLORS, bgById, colorById } from "./styles";
import { Company, CompanyMember } from "../database/models/Company";
import { Inventory } from "../database/models/Inventory";
import { JobProfile } from "../database/models/JobProfile";
import { Marriage } from "../database/models/Marriage";
import { UserProfile } from "../database/models/UserProfile";
import { JOB_MAP } from "../jobs/data";
import { xpNeeded } from "../services/economy";
import { ESTATE_IDS, ITEMS, lovePercent } from "../shop/data";
import { ThiefState } from "../database/models/ThiefState";
import { renderProfile } from "./card";

export const PROFILE_TRIGGER = /^!\s*(?:ملفي|ملف)(?:\s+<@!?(\d+)>)?$/;

const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

/** يبني بطاقة الملف كصورة (أو null لو العضو غير موجود) */
async function buildProfile(guild: Guild, targetId: string): Promise<{ png: Buffer | null; fallback: string } | null> {
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member || member.user.bot) return null;

  const [p, jp, cm, marriages, inv] = await Promise.all([
    UserProfile.findOne({ userId: targetId, guildId: guild.id }),
    JobProfile.findOne({ userId: targetId, guildId: guild.id }),
    CompanyMember.findOne({ userId: targetId, guildId: guild.id }),
    Marriage.find({ guildId: guild.id, $or: [{ husbandId: targetId }, { wifeId: targetId }] }).sort({ createdAt: 1 }),
    Inventory.findOne({ userId: targetId, guildId: guild.id }),
  ]);

  const style = await ProfileStyle.findOne({ userId: targetId, guildId: guild.id });
  const level = p?.level ?? 1;
  const xp = p?.xp ?? 0;
  const coins = p?.coins ?? 0;
  const bank = p?.bank ?? 0;
  const ahead = await UserProfile.countDocuments({ guildId: guild.id, $or: [{ level: { $gt: level } }, { level, xp: { $gt: xp } }] });

  // العقارات
  const items = (inv?.items ?? {}) as Record<string, number>;
  let estateCount = 0;
  let estateValue = 0;
  for (const k of ESTATE_IDS) {
    const n = Number(items[k] ?? 0);
    estateCount += n;
    estateValue += n * ITEMS[k].price;
  }

  // الوظيفة
  const jobDef = jp?.jobId ? JOB_MAP[jp.jobId] : undefined;
  const jobRank = jobDef && jobDef.kind !== "thief" ? (jobDef.ranks[jp?.rank ?? 0]?.title ?? "") : "";
  const jobBar = jobDef && jobDef.ranks.length > 1 ? ((jp?.rank ?? 0) + 1) / jobDef.ranks.length : undefined;

  // الشركة
  let companyName = "بدون شركة";
  let companyTitle: string | undefined;
  if (cm) {
    const c = await Company.findById(cm.companyId, { name: 1 });
    companyName = c?.name ?? "شركة";
    companyTitle = cm.title;
  }

  // الزواج
  let spouse = "غير متزوج";
  let marriageSub: string | undefined;
  let loveBar: number | undefined;
  if (marriages.length > 0) {
    const mm = marriages[0];
    const pid = mm.husbandId === targetId ? mm.wifeId : mm.husbandId;
    const sp = await guild.members.fetch(pid).catch(() => null);
    const days = Math.max(0, Math.floor((Date.now() - new Date(mm.createdAt).getTime()) / 86_400_000));
    const love = lovePercent(mm.lovePoints ?? (mm.flowers ?? 0) * ITEMS.flower.love, days);
    spouse = sp?.displayName ?? "عضو غادر";
    marriageSub = `نسبة الحب ${love}%${marriages.length > 1 ? `  ·  +${marriages.length - 1}` : ""}`;
    loveBar = Math.min(1, love / 100);
  }

  // التصنيفات
  const total = coins + bank;
  const msgs = p?.messages ?? 0;
  const [wealthAhead, msgAhead, ts] = await Promise.all([
    UserProfile.countDocuments({ guildId: guild.id, $expr: { $gt: [{ $add: [{ $ifNull: ["$coins", 0] }, { $ifNull: ["$bank", 0] }] }, total] } }),
    UserProfile.countDocuments({ guildId: guild.id, messages: { $gt: msgs } }),
    ThiefState.findOne({ userId: targetId, guildId: guild.id }, { total: 1 }),
  ]);
  const stolen = ts?.total ?? 0;
  const thiefAhead = stolen > 0 ? await ThiefState.countDocuments({ guildId: guild.id, total: { $gt: stolen } }) : -1;

  const png = await renderProfile({
    name: member.displayName,
    avatar: member.displayAvatarURL({ extension: "png", size: 256 }),
    level,
    xp,
    need: xpNeeded(level),
    tags: [
      { icon: "bag", text: jobDef ? jobDef.name : "عاطل" },
      { icon: "building", text: companyName },
      { icon: "heart", text: spouse },
    ],
    ranks: [
      { label: "تصنيف المستوى", value: `#${ahead + 1}`, icon: "level" },
      { label: "تصنيف الثروة", value: `#${wealthAhead + 1}`, icon: "coin" },
      { label: "تصنيف الرسائل", value: `#${msgAhead + 1}`, icon: "chat" },
      { label: "تصنيف الحرامية", value: thiefAhead < 0 ? "-" : `#${thiefAhead + 1}`, icon: "dagger" },
    ],
    bg: style?.bg ?? "midnight",
    color: style?.color ?? "sky",
    tiles: [
      { icon: "star", label: "إجمالي الثروة", value: fmt(total + estateValue), sub: estateValue > 0 ? `منها عقارات ${fmt(estateValue)}` : undefined, bar: total + estateValue > 0 ? total / (total + estateValue) : undefined },
      { icon: "coin", label: "المحفظة", value: fmt(coins), sub: `البنك ${fmt(bank)}`, bar: total > 0 ? coins / total : undefined },
      { icon: "chat", label: "الرسائل", value: fmt(msgs), sub: `المستوى ${level}` },
      { icon: "flame", label: "الستريك", value: `${p?.streak ?? 0} يوم`, bar: Math.min(1, (p?.streak ?? 0) / 30) },
      { icon: "bag", label: "الوظيفة", value: jobDef ? jobDef.name : "عاطل", sub: jobRank || undefined, bar: jobBar },
      { icon: "building", label: "الشركة", value: companyName, sub: companyTitle },
      { icon: "heart", label: "الزواج", value: spouse, sub: marriageSub, bar: loveBar },
      { icon: "home", label: "العقارات", value: estateCount > 0 ? `${estateCount} ${estateCount === 1 ? "عقار" : "عقارات"}` : "لا يوجد", sub: estateCount > 0 ? `قيمتها ${fmt(estateValue)}` : undefined },
    ],
  });
  return { png, fallback: `**${member.displayName}** — المستوى ${level} • الرصيد ${fmt(coins)} • البنك ${fmt(bank)}` };
}

function styleRow(ownerId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`pf|bg|${ownerId}`).setLabel("تغيير الخلفية").setEmoji("🖼️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`pf|col|${ownerId}`).setLabel("تغيير اللون").setEmoji("🎨").setStyle(ButtonStyle.Secondary),
  );
}

export async function handleProfileMessage(message: Message<true>): Promise<void> {
  const targetId = PROFILE_TRIGGER.exec(message.content.trim())?.[1] ?? message.author.id;
  await message.channel.sendTyping().catch(() => undefined);
  const res = await buildProfile(message.guild, targetId);
  if (!res) {
    await message.reply({ content: "❌ ما لقيت العضو.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  const own = targetId === message.author.id;
  const components = own ? [styleRow(targetId)] : [];
  if (!res.png) {
    await message.reply({ content: res.fallback, components, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message.reply({ files: [new AttachmentBuilder(res.png, { name: "profile.png" })], components, allowedMentions: { repliedUser: false } }).catch(() => undefined);
}

const eph = { flags: MessageFlags.Ephemeral } as const;

/** أزرار تغيير الخلفية/اللون وقوائمها (pf|...) */
export async function handleProfileComponent(i: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  if (!i.customId.startsWith("pf|")) return false;
  const [, act, owner, msgId] = i.customId.split("|");
  if (!i.inGuild() || !i.guild) return true;
  if (i.user.id !== owner) {
    await i.reply({ content: "❌ هذي مو بطاقتك. اكتب `!ملفي` وغيّر بطاقتك.", ...eph }).catch(() => undefined);
    return true;
  }

  if (i.isButton() && (act === "bg" || act === "col")) {
    const cur = await ProfileStyle.findOne({ userId: owner, guildId: i.guildId });
    const menu = new StringSelectMenuBuilder().setCustomId(`pf|${act}s|${owner}|${i.message.id}`);
    if (act === "bg") {
      menu.setPlaceholder("اختر خلفية من الاستوديو").addOptions(BACKGROUNDS.map((b) => ({ label: b.name, description: b.desc, value: b.id, default: b.id === (cur?.bg ?? "midnight") })));
    } else {
      menu.setPlaceholder("اختر لون الخطوط والمستوى").addOptions(COLORS.map((c) => ({ label: c.name, value: c.id, default: c.id === (cur?.color ?? "sky") })));
    }
    await i.reply({ content: act === "bg" ? "🖼️ استوديو الخلفيات:" : "🎨 ألوان الخطوط والمستوى:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ...eph });
    return true;
  }

  if (i.isStringSelectMenu() && (act === "bgs" || act === "cols")) {
    const value = i.values[0];
    const valid = act === "bgs" ? BACKGROUNDS.some((b) => b.id === value) : COLORS.some((c) => c.id === value);
    if (!valid) return true;
    await i.update({ content: "⏳ جاري التطبيق...", components: [] });
    await ProfileStyle.updateOne({ userId: owner, guildId: i.guildId }, { $set: act === "bgs" ? { bg: value } : { color: value } }, { upsert: true });
    const res = await buildProfile(i.guild, owner);
    if (res?.png) {
      const target = await i.channel?.messages.fetch(msgId).catch(() => null);
      const payload = { files: [new AttachmentBuilder(res.png, { name: "profile.png" })], attachments: [], components: [styleRow(owner)] };
      if (target) await target.edit(payload).catch(() => undefined);
      else if (i.channel && "send" in i.channel) await i.channel.send({ files: payload.files, components: payload.components }).catch(() => undefined);
    }
    await i.editReply({ content: `✅ تم: ${act === "bgs" ? bgById(value).name : colorById(value).name}` });
    return true;
  }
  return true;
}
