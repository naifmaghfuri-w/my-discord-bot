import { UserProfile, type IUserProfile } from "../database/models/UserProfile";

/** يجلب ملف العضو وينشئه إن لم يكن موجوداً */
export async function getProfile(userId: string, guildId: string): Promise<IUserProfile> {
  const doc = await UserProfile.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId } },
    { upsert: true, new: true },
  );
  if (!doc) throw new Error("فشل جلب ملف العضو");
  return doc;
}

/** يضيف Jenny (وفوز اختياري) بشكل ذري */
export async function reward(userId: string, guildId: string, coins: number, win = false): Promise<void> {
  await UserProfile.updateOne(
    { userId, guildId },
    { $inc: { coins, wins: win ? 1 : 0 } },
    { upsert: true },
  );
}

/** أعلى مستوى */
export const MAX_LEVEL = 100;

/**
 * الـ XP المطلوب للانتقال من مستوى إلى الذي بعده:
 * من 1 إلى 29: 5L² + 50L + 100  (155، 220، ... 5,755)
 * من 30 فما فوق: 10L² + 100L + 1000  (13,000 عند 30 ... 108,910 عند 99)
 */
export function xpNeeded(level: number): number {
  return level < 30 ? 5 * level ** 2 + 50 * level + 100 : 10 * level ** 2 + 100 * level + 1000;
}

export interface GrantResult {
  level: number;
  xp: number;
  leveledUp: boolean;
}

/** يعطي Jenny + XP ويرفع المستوى تلقائياً (حتى المستوى 100) */
export async function grantReward(
  userId: string,
  guildId: string,
  coins: number,
  xpGain: number,
): Promise<GrantResult> {
  const doc = await UserProfile.findOneAndUpdate(
    { userId, guildId },
    { $inc: { coins, xp: xpGain } },
    { upsert: true, new: true },
  );
  if (!doc) throw new Error("فشل إضافة المكافأة");

  let level = doc.level ?? 1;
  let xp = doc.xp ?? 0;
  let leveledUp = false;

  while (level < MAX_LEVEL && xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level++;
    leveledUp = true;
  }
  // المستوى الأقصى: ما يتراكم XP بعده
  if (level >= MAX_LEVEL) {
    level = Math.max(level, MAX_LEVEL);
    if (xp !== 0) {
      xp = 0;
      leveledUp = leveledUp || false;
    }
  }
  if (leveledUp || (level >= MAX_LEVEL && (doc.xp ?? 0) !== 0)) await UserProfile.updateOne({ userId, guildId }, { $set: { level, xp } });

  return { level, xp, leveledUp };
}
