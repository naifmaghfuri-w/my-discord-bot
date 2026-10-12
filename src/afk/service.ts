import type { GuildMember } from "discord.js";
import { AfkInbox, type IAfkInbox } from "../database/models/AfkInbox";
import { AfkStatus, type IAfkStatus } from "../database/models/AfkStatus";
import { logger } from "../utils/logger";

const PREFIX = "[AFK] ";
/** أقصى طول للاسم المستعار في ديسكورد */
const MAX_NICK = 32;

export async function getAfk(guildId: string, userId: string): Promise<IAfkStatus | null> {
  return AfkStatus.findOne({ guildId, userId });
}

/** يفعّل وضع AFK ويحاول يضيف [AFK] لاسمه المستعار */
export async function setAfk(member: GuildMember, reason: string): Promise<void> {
  let originalNickname: string | null = null;

  if (member.manageable) {
    originalNickname = member.nickname; // null لو ما عنده لقب مستعار (يستخدم اسمه الأصلي)
    const base = member.nickname ?? member.user.username;
    const newNick = (PREFIX + base).slice(0, MAX_NICK);
    await member.setNickname(newNick, "تفعيل وضع الغياب المؤقت").catch((err) => {
      logger.error("فشل تغيير اللقب عند تفعيل AFK", err);
    });
  }

  await AfkStatus.findOneAndUpdate(
    { guildId: member.guild.id, userId: member.id },
    { reason, originalNickname, since: new Date(), notify: [], messages: [], mentions: [] },
    { upsert: true },
  );
}

export interface ClearAfkResult {
  status: IAfkStatus;
}

/** يلغي وضع AFK، يرجّع اللقب الأصلي، ويرجع بيانات الحالة (عشان قائمة التنبيه والرسائل) */
export async function clearAfk(member: GuildMember): Promise<ClearAfkResult | null> {
  const status = await AfkStatus.findOneAndDelete({ guildId: member.guild.id, userId: member.id });
  if (!status) return null;

  if (member.manageable) {
    const current = member.nickname ?? "";
    if (current.startsWith(PREFIX)) {
      await member.setNickname(status.originalNickname, "إلغاء وضع الغياب المؤقت").catch((err) => {
        logger.error("فشل إعادة اللقب عند إلغاء AFK", err);
      });
    }
  }

  return { status };
}

export async function addNotify(guildId: string, targetUserId: string, requesterId: string): Promise<boolean> {
  const res = await AfkStatus.updateOne(
    { guildId, userId: targetUserId },
    { $addToSet: { notify: requesterId } },
  );
  return res.matchedCount > 0;
}

export async function addMessage(
  guildId: string,
  targetUserId: string,
  fromUserId: string,
  content: string,
): Promise<boolean> {
  const res = await AfkStatus.updateOne(
    { guildId, userId: targetUserId },
    { $push: { messages: { fromUserId, content, createdAt: new Date() } } },
  );
  return res.matchedCount > 0;
}

/** يسجّل أن هذا العضو تم منشنه وهو AFK (لعرض العدد ومين منشنه عند رجوعه) */
export async function addMention(guildId: string, targetUserId: string, fromUserId: string): Promise<boolean> {
  const res = await AfkStatus.updateOne({ guildId, userId: targetUserId }, { $push: { mentions: fromUserId } });
  return res.matchedCount > 0;
}

/** ينقل الرسائل المتراكمة لصندوق خاص، ما يقدر يفتحه إلا صاحبه. يستبدل أي صندوق قديم ما تم فتحه */
export async function createInbox(guildId: string, userId: string, messages: IAfkStatus["messages"]): Promise<void> {
  if (messages.length === 0) return;
  await AfkInbox.findOneAndUpdate(
    { guildId, userId },
    { messages, createdAt: new Date() },
    { upsert: true },
  );
}

/** يقرأ الصندوق ويحذفه (يُفتح مرة وحدة) */
export async function readInbox(guildId: string, userId: string): Promise<IAfkInbox | null> {
  return AfkInbox.findOneAndDelete({ guildId, userId });
}

/** Turns a duration in ms into short English text (e.g. "45 minutes", "2 hours and 10 minutes") */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60_000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const parts: string[] = [];
  if (days) parts.push(unit(days, "day"));
  if (hours) parts.push(unit(hours, "hour"));
  if (minutes) parts.push(unit(minutes, "minute"));
  return parts.slice(0, 2).join(" and ");
}
