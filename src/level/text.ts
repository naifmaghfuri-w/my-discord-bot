import { AttachmentBuilder, type Message } from "discord.js";
import { UserProfile } from "../database/models/UserProfile";
import { getProfile, grantReward, xpNeeded } from "../services/economy";
import { renderLevelCard } from "./card";

export const LEVEL_TRIGGER = /^!\s*(?:لفل|ليفل|مستوى|level)(?:\s+<@!?(\d+)>)?$/i;

const XP_COOLDOWN_MS = 60_000;
const XP_MIN = 15;
const XP_MAX = 25;
const lastXp = new Map<string, number>();

/** يحسب النقاط الكلية من المستوى + الـ XP الحالي (نفس معادلة xpNeeded) */
function totalPoints(level: number, xp: number): number {
  let total = xp;
  for (let l = 1; l < level; l++) total += xpNeeded(l);
  return total;
}

/** كل رسالة تنحسب، والـ XP مرة كل دقيقة (ضد السبام) */
export async function awardMessageXp(message: Message<true>): Promise<void> {
  const { guildId } = message;
  const userId = message.author.id;
  await UserProfile.updateOne({ userId, guildId }, { $inc: { messages: 1 } }, { upsert: true });
  const key = `${guildId}:${userId}`;
  const now = Date.now();
  if (now - (lastXp.get(key) ?? 0) < XP_COOLDOWN_MS) return;
  lastXp.set(key, now);
  await grantReward(userId, guildId, 0, XP_MIN + Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)));
}

export async function handleLevelMessage(message: Message<true>): Promise<void> {
  const m = LEVEL_TRIGGER.exec(message.content.trim());
  const targetId = m?.[1] ?? message.author.id;
  const member = await message.guild.members.fetch(targetId).catch(() => null);
  if (!member || member.user.bot) {
    await message.reply({ content: "❌ ما لقيت العضو.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message.channel.sendTyping().catch(() => undefined);
  const p = await getProfile(targetId, message.guildId);
  const level = p.level ?? 1;
  const xp = p.xp ?? 0;
  const ahead = await UserProfile.countDocuments({
    guildId: message.guildId,
    $or: [{ level: { $gt: level } }, { level, xp: { $gt: xp } }],
  });
  const png = await renderLevelCard({
    name: member.displayName,
    avatar: member.displayAvatarURL({ extension: "png", size: 256 }),
    level,
    rank: ahead + 1,
    points: totalPoints(level, xp),
    messages: p.messages ?? 0,
    xp,
    need: xpNeeded(level),
  });
  if (!png) {
    await message.reply({ content: `المستوى **${level}** • ${xp}/${xpNeeded(level)} XP`, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message.reply({ files: [new AttachmentBuilder(png, { name: "level.png" })], allowedMentions: { repliedUser: false } }).catch(() => undefined);
}
