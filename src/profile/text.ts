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
import { COLORS, colorById } from "./styles";
import { Company, CompanyMember } from "../database/models/Company";
import { Inventory } from "../database/models/Inventory";
import { JobProfile } from "../database/models/JobProfile";
import { Marriage } from "../database/models/Marriage";
import { UserProfile } from "../database/models/UserProfile";
import { JOB_MAP } from "../jobs/data";
import { xpNeeded } from "../services/economy";
import { ESTATE_IDS, ITEMS, lovePercent } from "../shop/data";
import { ThiefState } from "../database/models/ThiefState";
import { makeBackground, renderProfile } from "./card";

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
  const jobBar = jobDef && jobDef.ranks.length > 1 ? ((jp?.rank ?? 0) + 1) / jobDef.ranks.length : undefined;

  // الشركة
  let companyName = "بدون شركة";
  if (cm) {
    const c = await Company.findById(cm.companyId, { name: 1 });
    companyName = c?.name ?? "شركة";
  }

  // الزواج
  let spouse = "غير متزوج";
  let loveBar: number | undefined;
  if (marriages.length > 0) {
    const mm = marriages[0];
    const pid = mm.husbandId === targetId ? mm.wifeId : mm.husbandId;
    const sp = await guild.members.fetch(pid).catch(() => null);
    const days = Math.max(0, Math.floor((Date.now() - new Date(mm.createdAt).getTime()) / 86_400_000));
    const love = lovePercent(mm.lovePoints ?? (mm.flowers ?? 0) * ITEMS.flower.love, days);
    spouse = sp?.displayName ?? "عضو غادر";
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
    bgImage: style?.bgImage ?? null,
    color: style?.color ?? "sky",
    tiles: [
      { icon: "star", label: "إجمالي الثروة", value: fmt(total + estateValue), bar: total + estateValue > 0 ? total / (total + estateValue) : undefined },
      { icon: "coin", label: "المحفظة", value: fmt(coins), bar: total > 0 ? coins / total : undefined },
      { icon: "chat", label: "الرسائل", value: fmt(msgs) },
      { icon: "flame", label: "الستريك", value: `${p?.streak ?? 0} يوم`, bar: Math.min(1, (p?.streak ?? 0) / 30) },
      { icon: "bag", label: "الوظيفة", value: jobDef ? jobDef.name : "عاطل", bar: jobBar },
      { icon: "building", label: "الشركة", value: companyName },
      { icon: "heart", label: "الزواج", value: spouse, bar: loveBar },
      { icon: "home", label: "العقارات", value: estateCount > 0 ? `${estateCount} ${estateCount === 1 ? "عقار" : "عقارات"}` : "لا يوجد" },
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

/** أزرار تغيير الخلفية (صورتك) واللون (pf|...) */
export async function handleProfileComponent(i: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  if (!i.customId.startsWith("pf|")) return false;
  const [, act, owner, msgId] = i.customId.split("|");
  if (!i.inGuild() || !i.guild) return true;
  if (i.user.id !== owner) {
    await i.reply({ content: "❌ هذي مو بطاقتك. اكتب `!ملفي` وغيّر بطاقتك.", ...eph }).catch(() => undefined);
    return true;
  }

  const refresh = async (guild: NonNullable<typeof i.guild>, msgId: string) => {
    const res = await buildProfile(guild, owner);
    if (!res?.png) return;
    const payload = { files: [new AttachmentBuilder(res.png, { name: "profile.png" })], attachments: [], components: [styleRow(owner)] };
    const target = await i.channel?.messages.fetch(msgId).catch(() => null);
    if (target) await target.edit(payload).catch(() => undefined);
    else if (i.channel && "send" in i.channel) await i.channel.send({ files: payload.files, components: payload.components }).catch(() => undefined);
  };

  // زر الخلفية: يرسل صورته بنفسه
  if (i.isButton() && act === "bg") {
    const ch = i.channel;
    if (!ch || !("awaitMessages" in ch)) {
      await i.reply({ content: "❌ تعذّر استقبال الصورة هنا.", ...eph });
      return true;
    }
    const del = new ButtonBuilder().setCustomId(`pf|bgdel|${owner}|${i.message.id}`).setLabel("حذف خلفيتي").setStyle(ButtonStyle.Danger);
    await i.reply({ content: "🖼️ ارسل صورتك في هذا الروم خلال دقيقة وتصير خلفية بطاقتك.", components: [new ActionRowBuilder<ButtonBuilder>().addComponents(del)], ...eph });
    const got = await ch
      .awaitMessages({ filter: (m) => m.author.id === owner && (m.attachments.some((x) => Boolean(x.contentType?.startsWith("image/"))) || /https?:\/\/\S+/.test(m.content)), max: 1, time: 60_000 })
      .catch(() => null);
    const msg = got?.first();
    if (!msg) {
      await i.editReply({ content: "⏰ انتهى الوقت بدون صورة.", components: [] }).catch(() => undefined);
      return true;
    }
    const att = msg.attachments.find((x) => Boolean(x.contentType?.startsWith("image/")));
    const url = att?.url ?? /https?:\/\/\S+/.exec(msg.content)?.[0];
    if (att && att.size > 8 * 1024 * 1024) {
      await i.editReply({ content: "❌ الصورة كبيرة (الحد 8 ميغا).", components: [] }).catch(() => undefined);
      return true;
    }
    const res = url ? await fetch(url).catch(() => null) : null;
    const buf = res && res.ok ? Buffer.from(await res.arrayBuffer()) : null;
    const bgImage = buf && buf.length <= 8 * 1024 * 1024 ? await makeBackground(buf) : null;
    if (!bgImage) {
      await i.editReply({ content: "❌ ما قدرت أقرأ الصورة.", components: [] }).catch(() => undefined);
      return true;
    }
    await ProfileStyle.updateOne({ userId: owner, guildId: i.guildId }, { $set: { bgImage } }, { upsert: true });
    msg.delete().catch(() => undefined);
    await refresh(i.guild, i.message.id);
    await i.editReply({ content: "✅ تم تغيير خلفية بطاقتك.", components: [] }).catch(() => undefined);
    return true;
  }
  if (i.isButton() && act === "bgdel") {
    await i.update({ content: "⏳ جاري الحذف...", components: [] });
    await ProfileStyle.updateOne({ userId: owner, guildId: i.guildId }, { $set: { bgImage: null } }, { upsert: true });
    await refresh(i.guild, msgId);
    await i.editReply({ content: "✅ انحذفت خلفيتك." });
    return true;
  }

  if (i.isButton() && act === "col") {
    const cur = await ProfileStyle.findOne({ userId: owner, guildId: i.guildId }, { color: 1 });
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`pf|cols|${owner}|${i.message.id}`)
      .setPlaceholder("اختر لون الخطوط والمستوى")
      .addOptions(COLORS.map((c) => ({ label: c.name, value: c.id, default: c.id === (cur?.color ?? "sky") })));
    await i.reply({ content: "🎨 ألوان الخطوط والمستوى:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ...eph });
    return true;
  }

  if (i.isStringSelectMenu() && act === "cols") {
    const value = i.values[0];
    if (!COLORS.some((c) => c.id === value)) return true;
    await i.update({ content: "⏳ جاري التطبيق...", components: [] });
    await ProfileStyle.updateOne({ userId: owner, guildId: i.guildId }, { $set: { color: value } }, { upsert: true });
    await refresh(i.guild, msgId);
    await i.editReply({ content: `✅ تم: ${colorById(value).name}` });
    return true;
  }
  return true;
}
