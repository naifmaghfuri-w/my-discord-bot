import { AttachmentBuilder, type Message } from "discord.js";
import { Company, CompanyMember } from "../database/models/Company";
import { Inventory } from "../database/models/Inventory";
import { JobProfile } from "../database/models/JobProfile";
import { Marriage } from "../database/models/Marriage";
import { UserProfile } from "../database/models/UserProfile";
import { JOB_MAP } from "../jobs/data";
import { xpNeeded } from "../services/economy";
import { ESTATE_IDS, ITEMS, lovePercent } from "../shop/data";
import { renderProfile, type Tile } from "./card";

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
  const jobTile: Tile = jobDef
    ? { label: "الوظيفة", value: jobDef.name, sub: jobDef.kind === "thief" ? undefined : (jobDef.ranks[jp?.rank ?? 0]?.title ?? ""), accent: "#22c55e" }
    : { label: "الوظيفة", value: "عاطل", accent: "#64748b" };

  // الشركة
  let companyTile: Tile = { label: "الشركة", value: "بدون شركة", accent: "#64748b" };
  if (cm) {
    const c = await Company.findById(cm.companyId, { name: 1 });
    companyTile = { label: "الشركة", value: c?.name ?? "شركة", sub: cm.title, accent: "#3b82f6" };
  }

  // الزواج
  let marriageTile: Tile = { label: "الزواج", value: "غير متزوج", accent: "#64748b" };
  if (marriages.length > 0) {
    const m = marriages[0];
    const pid = m.husbandId === targetId ? m.wifeId : m.husbandId;
    const sp = await guild.members.fetch(pid).catch(() => null);
    const days = Math.max(0, Math.floor((Date.now() - new Date(m.createdAt).getTime()) / 86_400_000));
    const love = lovePercent(m.lovePoints ?? (m.flowers ?? 0) * ITEMS.flower.love, days);
    marriageTile = {
      label: "الزواج",
      value: sp?.displayName ?? "عضو غادر",
      sub: `نسبة الحب ${love}%${marriages.length > 1 ? `  ·  +${marriages.length - 1}` : ""}`,
      accent: "#f472b6",
    };
  }

  const tiles: Tile[] = [
    { label: "الرصيد", value: `${fmt(coins)}`, sub: `البنك ${fmt(bank)}`, accent: "#f59e0b" },
    jobTile,
    companyTile,
    marriageTile,
    estateCount > 0
      ? { label: "العقارات", value: `${estateCount} ${estateCount === 1 ? "عقار" : "عقارات"}`, sub: `قيمتها ${fmt(estateValue)}`, accent: "#a855f7" }
      : { label: "العقارات", value: "لا يوجد", accent: "#64748b" },
    { label: "النشاط", value: `${fmt(p?.messages ?? 0)} رسالة`, sub: p?.streak ? `ستريك ${p.streak} يوم` : undefined, accent: "#06b6d4" },
  ];

  const png = await renderProfile({
    name: member.displayName,
    avatar: member.displayAvatarURL({ extension: "png", size: 256 }),
    level,
    rank: ahead + 1,
    xp,
    need: xpNeeded(level),
    wealth: coins + bank + estateValue,
    tiles,
  });
  if (!png) {
    await message.reply({ content: `**${member.displayName}** — المستوى ${level} • الرصيد ${fmt(coins)} • البنك ${fmt(bank)}`, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message.reply({ files: [new AttachmentBuilder(png, { name: "profile.png" })], allowedMentions: { repliedUser: false } }).catch(() => undefined);
}
