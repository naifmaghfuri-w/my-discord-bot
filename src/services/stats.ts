import { GuildDailyStats } from "../database/models/GuildDailyStats";
import { todayKey } from "../quests/time";

/** يسجّل رسالة جديدة لإحصائيات اليوم (عدد الرسائل + الأعضاء النشطين) */
export async function recordMessage(guildId: string, userId: string): Promise<void> {
  await GuildDailyStats.updateOne(
    { guildId, dateKey: todayKey() },
    { $inc: { messageCount: 1 }, $addToSet: { activeUserIds: userId } },
    { upsert: true },
  );
}

export interface TodayStats {
  messageCount: number;
  activeMembers: number;
}

export async function getTodayStats(guildId: string): Promise<TodayStats> {
  const doc = await GuildDailyStats.findOne({ guildId, dateKey: todayKey() });
  return { messageCount: doc?.messageCount ?? 0, activeMembers: doc?.activeUserIds.length ?? 0 };
}
