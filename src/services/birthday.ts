import { config } from "../config";
import { UserProfile } from "../database/models/UserProfile";

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // فبراير 29 لتقبل السنين الكبيسة
const MIN_YEAR = 1930;
const DAY_MS = 86_400_000;

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** اليوم والشهر والسنة الحاليين حسب المنطقة الزمنية للبوت */
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

/** السنة اختيارية: بدونها يتسجل اليوم والشهر فقط ولا يظهر عمر */
export function isValidBirthday(day: number, month: number, year?: number): boolean {
  if (![day, month].every(Number.isInteger)) return false;
export function isValidBirthday(day: number, month: number, year: number): boolean {
  if (![day, month, year].every(Number.isInteger)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > DAYS_IN_MONTH[month - 1]) return false;
  if (year === undefined) return true;
  if (!Number.isInteger(year)) return false;
  if (day === 29 && month === 2 && !isLeapYear(year)) return false;
  const { day: td, month: tm, year: ty } = todayDayMonth();
  if (year < MIN_YEAR || year > ty) return false;
  if (year === ty && (month > tm || (month === tm && day > td))) return false;
  return true;
}

export interface ParsedBirthday {
  day: number;
  month: number;
  year?: number;
  const currentYear = new Date().getUTCFullYear();
  return year >= MIN_YEAR && year <= currentYear;
}

/** يقبل 15/8/2001 أو 15/8 (بدون سنة)، ويقبل أرقام عربية وفواصل / - . */
export function parseBirthdayInput(raw: string): ParsedBirthday | "format" | "invalid" {
  const normalized = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const m = /^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{4}))?$/.exec(normalized);
  if (!m) return "format";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3] ? Number(m[3]) : undefined;
  return isValidBirthday(day, month, year) ? { day, month, year } : "invalid";
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
  year?: number;
  hideAge: boolean;
}

/** هل العمر ظاهر للآخرين؟ (فيه سنة ومو مخفي) */
export function isAgeVisible(b: Birthday): boolean {
  return b.year !== undefined && !b.hideAge;
}

export async function setBirthday(userId: string, guildId: string, day: number, month: number, year?: number): Promise<void> {
  const update =
    year === undefined
      ? { $set: { birthdayDay: day, birthdayMonth: month }, $unset: { birthdayYear: 1, birthdayHideAge: 1 } }
      : { $set: { birthdayDay: day, birthdayMonth: month, birthdayYear: year } };
  await UserProfile.findOneAndUpdate({ userId, guildId }, update, { upsert: true });
  year: number;
}

export async function getBirthday(userId: string, guildId: string): Promise<Birthday | null> {
  const profile = await UserProfile.findOne(
    { userId, guildId },
    { birthdayDay: 1, birthdayMonth: 1, birthdayYear: 1, birthdayHideAge: 1 },
    { birthdayDay: 1, birthdayMonth: 1, birthdayYear: 1 },
  );
  if (!profile?.birthdayDay || !profile.birthdayMonth) return null;
  return {
    day: profile.birthdayDay,
    month: profile.birthdayMonth,
    year: profile.birthdayYear || undefined,
    hideAge: !!profile.birthdayHideAge,
  };
}

/** يقلب إخفاء العمر. يرجع الحالة الجديدة، أو null لو ما عنده سنة مسجلة */
export async function toggleHideAge(userId: string, guildId: string): Promise<boolean | null> {
  const b = await getBirthday(userId, guildId);
  if (!b || b.year === undefined) return null;
  const hideAge = !b.hideAge;
  await UserProfile.updateOne({ userId, guildId }, { $set: { birthdayHideAge: hideAge } });
  return hideAge;
}

/** 29 فبراير في السنة غير الكبيسة يُحتفل به يوم 28 فبراير */
function occurrenceUTC(year: number, month: number, day: number): number {
  const d = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
  return Date.UTC(year, month - 1, d);
  if (!profile?.birthdayDay || !profile.birthdayMonth || !profile.birthdayYear) return null;
  return { day: profile.birthdayDay, month: profile.birthdayMonth, year: profile.birthdayYear };
}

function nextOccurrence(month: number, day: number, ty: number, todayUTC: number): { year: number; utc: number } {
  let year = ty;
  let utc = occurrenceUTC(year, month, day);
  if (utc < todayUTC) {
    year += 1;
    utc = occurrenceUTC(year, month, day);
  }
  return { year, utc };
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
@@ -117,15 +53,17 @@ export interface BirthdayEntry {
  month: number;
  /** أيام متبقية للعيد القادم (0 = اليوم) */
  daysUntil: number;
  /** كم سنة بيصير عمره (0 = غير معروف أو مخفي) */
  /** كم سنة بيصير عمره بهذا العيد */
  turningAge: number;
  /** وقت العيد القادم (ثواني يونكس، منتصف اليوم UTC) */
  nextTs: number;
}

/** أقرب الأعياد بالسيرفر (كل أصحاب عيد اليوم يظهرون حتى لو زادوا عن الحد) */
/** يحسب الأعياد القادمة لكل الأعضاء اللي عندهم عيد ميلاد محدد بهذا السيرفر */
export async function getUpcomingBirthdays(guildId: string, limit = 10): Promise<BirthdayEntry[]> {
  const docs = await UserProfile.find(
    { guildId, birthdayDay: { $exists: true }, birthdayMonth: { $exists: true } },
    { userId: 1, birthdayDay: 1, birthdayMonth: 1, birthdayYear: 1, birthdayHideAge: 1 },
    { userId: 1, birthdayDay: 1, birthdayMonth: 1, birthdayYear: 1 },
  );

  const { day: td, month: tm, year: ty } = todayDayMonth();
@@ -134,65 +72,71 @@ export async function getUpcomingBirthdays(guildId: string, limit = 10): Promise
  const entries: BirthdayEntry[] = docs.map((d) => {
    const day = d.birthdayDay!;
    const month = d.birthdayMonth!;
    const next = nextOccurrence(month, day, ty, todayUTC);
    const daysUntil = Math.round((next.utc - todayUTC) / DAY_MS);
    const turningAge = d.birthdayYear && !d.birthdayHideAge ? next.year - d.birthdayYear : 0;
    return { userId: d.userId, day, month, daysUntil, turningAge };
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

  entries.sort((a, b) => a.daysUntil - b.daysUntil);
  const todayCount = entries.filter((e) => e.daysUntil === 0).length;
  return entries.slice(0, Math.max(limit, todayCount));
  return entries.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, limit);
}

export async function countRegisteredBirthdays(guildId: string): Promise<number> {
  return UserProfile.countDocuments({ guildId, birthdayDay: { $exists: true }, birthdayMonth: { $exists: true } });
}

export interface AgeDetails {
  /** null لو ما فيه سنة ميلاد */
  age: { years: number; months: number; days: number } | null;
  turningAge: number | null;
  years: number;
  months: number;
  days: number;
  turningAge: number;
  daysUntilNext: number;
  /** نسبة التقدم من العيد السابق للقادم (0 → 1) */
  progress: number;
  nextBirthdayUTC: number;
  nextWeekday: string;
}

/** يحسب العمر بالتفصيل، العيد القادم، ونسبة التقدم للعيد */
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** يحسب العمر بالتفصيل (سنة/شهر/يوم) وتاريخ العيد القادم */
export function calculateAge(b: Birthday): AgeDetails {
  const { day: td, month: tm, year: ty } = todayDayMonth();
  const todayUTC = Date.UTC(ty, tm - 1, td);

  let age: AgeDetails["age"] = null;
  if (b.year !== undefined) {
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
    age = { years, months, days };
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

  const next = nextOccurrence(b.month, b.day, ty, todayUTC);
  const daysUntilNext = Math.round((next.utc - todayUTC) / DAY_MS);
  const prevUTC = occurrenceUTC(next.year - 1, b.month, b.day);
  const cycle = Math.max(1, Math.round((next.utc - prevUTC) / DAY_MS));
  const progress = daysUntilNext === 0 ? 1 : Math.min(1, Math.max(0, (cycle - daysUntilNext) / cycle));
  let nextYear = ty;
  let next = Date.UTC(ty, b.month - 1, b.day);
  if (next < todayUTC) {
    nextYear += 1;
    next = Date.UTC(nextYear, b.month - 1, b.day);
  }
  const daysUntilNext = Math.round((next - todayUTC) / 86_400_000);

  return {
    age,
    turningAge: b.year !== undefined ? next.year - b.year : null,
    years,
    months,
    days,
    turningAge: nextYear - b.year,
    daysUntilNext,
    progress,
    nextBirthdayUTC: Math.floor(next.utc / 1000),
    nextBirthdayUTC: Math.floor(next / 1000),
    nextWeekday: WEEKDAYS[new Date(next).getUTCDay()],
  };
}