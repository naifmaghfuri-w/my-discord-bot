import { UserProfile } from "../database/models/UserProfile";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // فبراير 29 لتقبل السنين الكبيسة

export function isValidBirthday(day: number, month: number): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

export async function setBirthday(userId: string, guildId: string, day: number, month: number): Promise<void> {
  await UserProfile.findOneAndUpdate(
    { userId, guildId },
    { $set: { birthdayDay: day, birthdayMonth: month } },
    { upsert: true },
  );
}

export interface BirthdayEntry {
  userId: string;
  day: number;
  month: number;
  /** أيام متبقية للعيد القادم (0 = اليوم) */
  daysUntil: number;
}

/** يحسب الأعياد القادمة لكل الأعضاء اللي عندهم عيد ميلاد محدد بهذا السيرفر */
export async function getUpcomingBirthdays(guildId: string, limit = 5): Promise<BirthdayEntry[]> {
  const docs = await UserProfile.find(
    { guildId, birthdayDay: { $exists: true }, birthdayMonth: { $exists: true } },
    { userId: 1, birthdayDay: 1, birthdayMonth: 1 },
  );

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const entries: BirthdayEntry[] = docs.map((d) => {
    const day = d.birthdayDay!;
    const month = d.birthdayMonth!;
    let next = Date.UTC(now.getUTCFullYear(), month - 1, day);
    if (next < todayUTC) next = Date.UTC(now.getUTCFullYear() + 1, month - 1, day);
    const daysUntil = Math.round((next - todayUTC) / 86_400_000);
    return { userId: d.userId, day, month, daysUntil };
  });

  return entries.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, limit);
}

export async function getBirthday(userId: string, guildId: string): Promise<{ day: number; month: number } | null> {
  const profile = await UserProfile.findOne({ userId, guildId }, { birthdayDay: 1, birthdayMonth: 1 });
  if (!profile?.birthdayDay || !profile.birthdayMonth) return null;
  return { day: profile.birthdayDay, month: profile.birthdayMonth };
}
