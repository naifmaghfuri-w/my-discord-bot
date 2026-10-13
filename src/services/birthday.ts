import { config } from "../config";
import { UserProfile } from "../database/models/UserProfile";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // فبراير 29 لتقبل السنين الكبيسة
const MIN_YEAR = 1930;
const DAY_MS = 86_400_000;


export function isValidBirthday(day: number, month: number, year: number): boolean {
  if (![day, month, year].every(Number.isInteger)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) return false;
  const currentYear = new Date().getUTCFullYear();
  return year >= MIN_YEAR && year <= currentYear;
}

export async function setBirthday(userId: string, guildId: string, day: number, month: number, year: number): Promise<void> {
  await UserProfile.findOneAndUpdate(
    { userId, guildId },
    { $set: { birthdayDay: day, birthdayMonth: month, birthdayYear: year } },
    { upsert: true },
  );
}

export interface Birthday {
  day: number;
  month: number;
  year: number;
}

export async function getBirthday(userId: string, guildId: string): Promise<Birthday | null> {
  const profile = await UserProfile.findOne(
    { userId, guildId },
    { birthdayDay: 1, birthdayMonth: 1, birthdayYear: 1 },
  );
  if (!profile?.birthdayDay || !profile.birthdayMonth || !profile.birthdayYear) return null;
  return { day: profile.birthdayDay, month: profile.birthdayMonth, year: profile.birthdayYear };
}

/** اليوم والشهر الحاليين حسب المنطقة الزمنية للبوت (لمقارنتهم بيوم/شهر الميلاد) */
export function todayDayMonth(now = new Date()): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

export interface BirthdayEntry {
  userId: string;
  day: number;
  month: number;
  /** أيام متبقية للعيد القادم (0 = اليوم) */
  daysUntil: number;
  /** كم سنة بيصير عمره بهذا العيد */
  turningAge: number;
  /** وقت العيد القادم (ثواني يونكس، منتصف اليوم UTC) */
  nextTs: number;
}

/** يحسب الأعياد القادمة لكل الأعضاء اللي عندهم عيد ميلاد محدد بهذا السيرفر */
export async function getUpcomingBirthdays(guildId: string, limit = 10): Promise<BirthdayEntry[]> {
  const docs = await UserProfile.find(
    { guildId, birthdayDay: { $exists: true }, birthdayMonth: { $exists: true } },
    { userId: 1, birthdayDay: 1, birthdayMonth: 1, birthdayYear: 1 },
  );

  const { day: td, month: tm, year: ty } = todayDayMonth();
  const todayUTC = Date.UTC(ty, tm - 1, td);

  const entries: BirthdayEntry[] = docs.map((d) => {
    const day = d.birthdayDay!;
    const month = d.birthdayMonth!;
    let nextYear = ty;
    let next = Date.UTC(ty, month - 1, day);
    if (next < todayUTC) {
      nextYear += 1;
      next = Date.UTC(nextYear, month - 1, day);
    }
    const daysUntil = Math.round((next - todayUTC) / 86_400_000);
    const turningAge = d.birthdayYear ? nextYear - d.birthdayYear : 0;
    return { userId: d.userId, day, month, daysUntil, turningAge, nextTs: Math.floor(next / 1000) };
  });

  return entries.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, limit);
}

export async function countRegisteredBirthdays(guildId: string): Promise<number> {
  return UserProfile.countDocuments({ guildId, birthdayDay: { $exists: true }, birthdayMonth: { $exists: true } });
}

export interface AgeDetails {
  years: number;
  months: number;
  days: number;
  turningAge: number;
  daysUntilNext: number;
  nextBirthdayUTC: number;
  nextWeekday: string;
}

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** يحسب العمر بالتفصيل (سنة/شهر/يوم) وتاريخ العيد القادم */
export function calculateAge(b: Birthday): AgeDetails {
  const { day: td, month: tm, year: ty } = todayDayMonth();
  const todayUTC = Date.UTC(ty, tm - 1, td);

  // فرق السنة/الشهر/اليوم بالتقويم (مو بقسمة الأيام)
  let years = ty - b.year;
  let months = tm - b.month;
  let days = td - b.day;
  if (days < 0) {
    months -= 1;
    const prevMonth = tm - 1 <= 0 ? 12 : tm - 1;
    const prevMonthYear = tm - 1 <= 0 ? ty - 1 : ty;
    days += new Date(Date.UTC(prevMonthYear, prevMonth, 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  let nextYear = ty;
  let next = Date.UTC(ty, b.month - 1, b.day);
  if (next < todayUTC) {
    nextYear += 1;
    next = Date.UTC(nextYear, b.month - 1, b.day);
  }
  const daysUntilNext = Math.round((next - todayUTC) / 86_400_000);

  return {
    years,
    months,
    days,
    turningAge: nextYear - b.year,
    daysUntilNext,
    nextBirthdayUTC: Math.floor(next / 1000),
    nextWeekday: WEEKDAYS[new Date(next).getUTCDay()],
  };
}
