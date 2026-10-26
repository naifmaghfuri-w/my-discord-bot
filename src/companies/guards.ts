export const GUARD_BOTS = [
  { key: "rock", name: "روك" },
  { key: "beast", name: "بيست" },
  { key: "demon", name: "ديمون" },
] as const;

export const GUARD_RULES = {
  /** كل 100 = ساعة دوام */
  costPerHour: 100,
  /** أقصى رصيد ساعات متراكم للحارس */
  maxHours: 24,
} as const;

export const guardByKey = (key: string) => GUARD_BOTS.find((g) => g.key === key);

/** الساعات المتبقية (تقريب لفوق) */
export function hoursLeft(until: Date | null | undefined, now = Date.now()): number {
  if (!until) return 0;
  const ms = new Date(until).getTime() - now;
  return ms > 0 ? Math.ceil(ms / 3_600_000) : 0;
}

export function leftText(until: Date | null | undefined): string {
  const ms = until ? new Date(until).getTime() - Date.now() : 0;
  if (ms <= 0) return "منتهي";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h} ساعة و${m} دقيقة` : `${m} دقيقة`;
}
