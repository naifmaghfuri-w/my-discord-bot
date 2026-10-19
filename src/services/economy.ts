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

/** الـ XP المطلوب للانتقال من مستوى إلى الذي بعده */
export function xpNeeded(level: number): number {
  return 5 * level ** 2 + 50 * level + 100;
}

export interface GrantResult {
  level: number;
  xp: number;
  leveledUp: boolean;
}

/** يعطي Jenny + XP ويرفع المستوى تلقائياً */
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

  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level++;
    leveledUp = true;
  }
  if (leveledUp) await UserProfile.updateOne({ userId, guildId }, { $set: { level, xp } });

  return { level, xp, leveledUp };
}
