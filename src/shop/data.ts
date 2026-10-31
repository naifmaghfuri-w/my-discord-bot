export const ITEMS = {
  flower: { name: "ورد", price: 100, love: 10 },
  ring: { name: "خاتم الفيروز", price: 1500, love: 0 },
  cabin: { name: "كوخ", price: 600, love: 0 },
  apartment: { name: "شقة سكنية", price: 1500, love: 0 },
  small_house: { name: "بيت صغير", price: 10000, love: 0 },
  medium_house: { name: "بيت متوسط", price: 15000, love: 0 },
  large_house: { name: "بيت كبير", price: 25000, love: 0 },
  villa: { name: "فِلاّ", price: 50000, love: 0 },
  cherry_arrizo: { name: "شيري أريزو 5", price: 15000, love: 0 },
  land_cruiser: { name: "تويوتا لاندكروزر", price: 23000, love: 0 },
  rolls_royce: { name: "رولز رويس", price: 50000, love: 0 },
  iphone_18: { name: "آيفون 18", price: 15000, love: 0 },
  galaxy_note_19: { name: "جلكسي نوت 19", price: 7000, love: 0 },
  huawei: { name: "هواوي", price: 3000, love: 0 },
  bed: { name: "سرير", price: 1200, love: 0 },
  baby_crib: { name: "سرير طفل", price: 900, love: 0 },
  painting: { name: "لوحة", price: 600, love: 0 },
  lamp: { name: "لمبة", price: 150, love: 0 },
  sofa: { name: "كنبة", price: 2000, love: 0 },
  dining_table: { name: "طاولة طعام", price: 1800, love: 0 },
  wardrobe: { name: "خزانة ملابس", price: 1500, love: 0 },
  carpet: { name: "سجادة", price: 500, love: 0 },
  mirror: { name: "مرآة", price: 400, love: 0 },
  chair: { name: "كرسي", price: 250, love: 0 },
  chandelier: { name: "ثريا", price: 1000, love: 0 },
} as const;
export type ItemId = keyof typeof ITEMS;

/** نسبة الحب من 100٪: مجموع نقاط الهدايا ÷ أيام الزواج (أقل يوم = 1) */
export function lovePercent(lovePoints: number, days: number): number {
  const v = lovePoints / Math.max(1, days);
  return Math.min(100, Math.round(v * 10) / 10);
}

/** العقارات بترتيب العرض */
export const ESTATE_IDS = ["cabin", "apartment", "small_house", "medium_house", "large_house", "villa"] as const;
export type EstateId = (typeof ESTATE_IDS)[number];

/** السيارات بترتيب العرض (كل سيارة تنشترى مرة وحدة) */
export const CAR_IDS = ["cherry_arrizo", "land_cruiser", "rolls_royce"] as const;
export type CarId = (typeof CAR_IDS)[number];

/** الهواتف بترتيب العرض (كل هاتف ينشترى مرة وحدة) */
export const PHONE_IDS = ["iphone_18", "galaxy_note_19", "huawei"] as const;
export type PhoneId = (typeof PHONE_IDS)[number];

/** الأثاث بترتيب العرض (يمكن شراء القطعة أكثر من مرة) */
export const FURNITURE_IDS = ["bed", "baby_crib", "sofa", "dining_table", "wardrobe", "chair", "carpet", "painting", "mirror", "chandelier", "lamp"] as const;
export type FurnitureId = (typeof FURNITURE_IDS)[number];
