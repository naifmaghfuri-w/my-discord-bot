import { config } from "../config";

/** تاريخ اليوم بصيغة 2026-09-21 حسب المنطقة الزمنية للبوت */
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** وقت تجديد المهام القادم (Unix seconds) لاستخدامه في <t:...:R> */
export function nextResetUnix(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const passed = get("hour") * 3600 + get("minute") * 60 + get("second");
  return Math.floor(now.getTime() / 1000) + (86_400 - passed);
}
