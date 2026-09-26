import { config } from "../config";

function localParts(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** مفتاح الأسبوع بصيغة ISO مثل 2026-W39 (يبدأ الاثنين) حسب المنطقة الزمنية للبوت */
export function weekKey(now = new Date()): string {
  const { year, month, day } = localParts(now);
  const date = new Date(Date.UTC(year, month - 1, day));

  // خوارزمية رقم الأسبوع ISO 8601
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);

  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** وقت بداية الأسبوع القادم (Unix seconds) لعرضه بـ <t:...:R> */
export function nextWeekResetUnix(now = new Date()): number {
  const { year, month, day } = localParts(now);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = date.getUTCDay() || 7; // 1=اثنين ... 7=أحد
  const daysUntilMonday = ((8 - dayNum) % 7) || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return Math.floor(date.getTime() / 1000);
}
