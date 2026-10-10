import { UserProfile } from "../database/models/UserProfile";
import { getProfile } from "./economy";
import { logger } from "../utils/logger";

/** اليوم يبدأ بتوقيت الرياض (UTC+3) */
const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const dayKey = (t = Date.now()): string => new Date(t + TZ_OFFSET_MS).toISOString().slice(0, 10);

/** جوائز المراحل (مرة عند الوصول لليوم) */
export const STREAK_MILESTONES: Record<number, number> = { 3: 100, 7: 300, 14: 700, 30: 2000, 60: 5000, 100: 10000, 365: 50000 };

export function nextMilestone(streak: number): { day: number; reward: number } | null {
  const day = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b).find((d) => d > streak);
  return day ? { day, reward: STREAK_MILESTONES[day] } : null;
}

// كاش بالذاكرة: ما نلمس الداتابيس إلا أول رسالة باليوم لكل عضو
const seen = new Map<string, string>();

export interface StreakTick {
  streak: number;
  milestone: number;
  broke: number;
}

/** يُستدعى مع كل رسالة. يرجع نتيجة فقط أول رسالة باليوم. */
export async function tickStreak(userId: string, guildId: string): Promise<StreakTick | null> {
  const today = dayKey();
  const key = `${guildId}:${userId}`;
  if (seen.get(key) === today) return null;
  seen.set(key, today);
  if (seen.size > 50_000) seen.clear();

  try {
    const before = await getProfile(userId, guildId);
    if (before.lastStreakDay === today) return null;
    const yesterday = dayKey(Date.now() - DAY_MS);
    const prev = before.streak ?? 0;

    // ذري: ينجح مرة واحدة فقط باليوم
    const updated = await UserProfile.findOneAndUpdate(
      { userId, guildId, lastStreakDay: { $ne: today } },
      [
        { $set: { streak: { $cond: [{ $eq: ["$lastStreakDay", yesterday] }, { $add: [{ $ifNull: ["$streak", 0] }, 1] }, 1] }, lastStreakDay: today } },
        { $set: { bestStreak: { $max: [{ $ifNull: ["$bestStreak", 0] }, "$streak"] } } },
      ],
      { new: true },
    );
    if (!updated) return null;
    const streak = updated.streak ?? 1;
    const milestone = STREAK_MILESTONES[streak] ?? 0;
    if (milestone > 0) await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: milestone } });
    return { streak, milestone, broke: streak === 1 && before.lastStreakDay && prev > 1 ? prev : 0 };
  } catch (err) {
    seen.delete(key);
    logger.error(`streak tick failed: ${String(err)}`);
    return null;
  }
}

/** الستريك الحي: لو فاتك أمس يعتبر منتهي */
export async function getStreak(userId: string, guildId: string): Promise<{ streak: number; best: number; activeToday: boolean; atRisk: boolean }> {
  const p = await getProfile(userId, guildId);
  const today = dayKey();
  const yesterday = dayKey(Date.now() - DAY_MS);
  const activeToday = p.lastStreakDay === today;
  const alive = activeToday || p.lastStreakDay === yesterday;
  return { streak: alive ? p.streak ?? 0 : 0, best: p.bestStreak ?? 0, activeToday, atRisk: !activeToday && p.lastStreakDay === yesterday };
}
