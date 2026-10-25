/** عناصر المحلات (تنحفظ في مقتنياتي). love = نقاط الحب اللي تضيفها الهدية للزوجين، وتنقسم على أيام الزواج */
export const ITEMS = {
  flower: { name: "ورد", price: 100, love: 10 },
  ring: { name: "خاتم الفيروز", price: 1500, love: 0 },
} as const;
export type ItemId = keyof typeof ITEMS;

/** نسبة الحب من 100٪: مجموع نقاط الهدايا ÷ أيام الزواج (أقل يوم = 1) */
export function lovePercent(lovePoints: number, days: number): number {
  const v = lovePoints / Math.max(1, days);
  return Math.min(100, Math.round(v * 10) / 10);
}
