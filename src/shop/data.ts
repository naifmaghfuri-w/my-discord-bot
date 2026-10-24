/** عناصر المحلات (تنحفظ في مقتنياتي) */
export const ITEMS = {
  flower: { name: "ورد", price: 100 },
} as const;
export type ItemId = keyof typeof ITEMS;
