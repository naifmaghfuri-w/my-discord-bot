import { AttachmentBuilder, type Message } from "discord.js";
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

export async function handleProfileMessage(message: Message<true>): Promise<void> {
  const targetId = PROFILE_TRIGGER.exec(message.content.trim())?.[1] ?? message.author.id;
  const guild = message.guild;
  const member = await guild.members.fetch(targetId).catch(() => null);
  if (!member || member.user.bot) {
    await message.reply({ content: "❌ ما لقيت العضو.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message.channel.sendTyping().catch(() => undefined);

  const [p, jp, cm, marriages, inv] = await Promise.all([
    UserProfile.findOne({ userId: targetId, guildId: guild.id }),
    JobProfile.findOne({ userId: targetId, guildId: guild.id }),
    CompanyMember.findOne({ userId: targetId, guildId: guild.id }),
    Marriage.find({ guildId: guild.id, $or: [{ husbandId: targetId }, { wifeId: targetId }] }).sort({ createdAt: 1 }),
    Inventory.findOne({ userId: targetId, guildId: guild.id }),
  ]);

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
  if (!png) {
    await message.reply({ content: `**${member.displayName}** — المستوى ${level} • الرصيد ${fmt(coins)} • البنك ${fmt(bank)}`, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message.reply({ files: [new AttachmentBuilder(png, { name: "profile.png" })], allowedMentions: { repliedUser: false } }).catch(() => undefined);
}
