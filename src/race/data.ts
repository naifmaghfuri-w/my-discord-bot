import { CAR_IDS, ITEMS, type CarId } from "../shop/data";

export { CAR_IDS, type CarId };

export type StatKey = "speed" | "accel" | "handling" | "braking";
export type Stats = Record<StatKey, number>;
export const STAT_KEYS: StatKey[] = ["speed", "accel", "handling", "braking"];
export const STAT_LABEL: Record<StatKey, string> = { speed: "السرعة القصوى", accel: "التسارع", handling: "التحكم", braking: "كفاءة الفرامل" };
const STAT_SHORT: Record<StatKey, string> = { speed: "سرعة", accel: "تسارع", handling: "تحكم", braking: "فرامل" };

/** إحصائيات السيارة الأصلية (من 100) */
export const CAR_BASE: Record<CarId, Stats> = {
  cherry_arrizo: { speed: 45, accel: 40, handling: 50, braking: 45 },
  land_cruiser: { speed: 58, accel: 45, handling: 40, braking: 55 },
  rolls_royce: { speed: 72, accel: 62, handling: 55, braking: 62 },
};

export const CAT_IDS = ["engine", "tires", "nitro", "brakes", "suspension", "body"] as const;
export type CatId = (typeof CAT_IDS)[number];
export type Tier = 0 | 1 | 2 | 3;

interface CatDef {
  name: string;
  /** معامل السعر */
  factor: number;
  tiers: [string, string, string];
  fx: [Partial<Stats>, Partial<Stats>, Partial<Stats>];
}

export const CATS: Record<CatId, CatDef> = {
  engine: { name: "المحرك", factor: 1.0, tiers: ["محرك محسّن", "محرك توربو", "محرك سباق"], fx: [{ speed: 4, accel: 3 }, { speed: 8, accel: 6 }, { speed: 13, accel: 10 }] },
  tires: { name: "الإطارات", factor: 0.6, tiers: ["إطارات رياضية", "إطارات عالية الأداء", "إطارات سباق"], fx: [{ handling: 4, accel: 1, braking: 1 }, { handling: 8, accel: 2, braking: 2 }, { handling: 12, accel: 3, braking: 3 }] },
  nitro: { name: "النيترو", factor: 0.9, tiers: ["نيترو صغير", "نيترو متوسط", "نيترو سباق"], fx: [{ accel: 5, speed: 1 }, { accel: 9, speed: 3 }, { accel: 14, speed: 5 }] },
  brakes: { name: "الفرامل", factor: 0.6, tiers: ["فرامل رياضية", "فرامل سيراميك", "فرامل سباق"], fx: [{ braking: 6, handling: 1 }, { braking: 11, handling: 2 }, { braking: 17, handling: 3 }] },
  suspension: { name: "التعليق", factor: 0.7, tiers: ["تعليق رياضي", "تعليق منخفض", "تعليق سباق"], fx: [{ handling: 5, braking: 1 }, { handling: 9, braking: 2 }, { handling: 14, braking: 2 }] },
  body: { name: "الهيكل", factor: 0.8, tiers: ["هيكل مخفف", "ألياف كربون", "هيكل سباق"], fx: [{ accel: 3, speed: 2, handling: 1 }, { accel: 5, speed: 4, handling: 2 }, { accel: 8, speed: 6, handling: 3 }] },
};

const PRICE_RATIO = [0.06, 0.15, 0.3];

export const isCar = (x: string): x is CarId => (CAR_IDS as readonly string[]).includes(x);
export const isCat = (x: string): x is CatId => (CAT_IDS as readonly string[]).includes(x);

export const carName = (c: CarId): string => ITEMS[c].name;
export const partId = (car: CarId, cat: CatId, tier: Tier): string => `${car}:${cat}:${tier}`;

export interface PartInfo {
  id: string;
  tier: Tier;
  name: string;
  price: number;
  fx: Partial<Stats>;
}

/** قطعة: tier 0 = الأصلي (مجاني ودايم موجود) */
export function partInfo(car: CarId, cat: CatId, tier: Tier): PartInfo {
  const def = CATS[cat];
  if (tier === 0) return { id: partId(car, cat, 0), tier, name: "أصلي", price: 0, fx: {} };
  const price = Math.round((ITEMS[car].price * PRICE_RATIO[tier - 1]! * def.factor) / 50) * 50;
  return { id: partId(car, cat, tier), tier, name: def.tiers[tier - 1]!, price, fx: def.fx[tier - 1]! };
}

export type Installed = Partial<Record<CatId, number>>;

export function effectiveStats(car: CarId, installed: Installed): Stats {
  const out: Stats = { ...CAR_BASE[car] };
  for (const cat of CAT_IDS) {
    const t = (installed[cat] ?? 0) as Tier;
    if (t > 0) for (const k of STAT_KEYS) out[k] += partInfo(car, cat, t).fx[k] ?? 0;
  }
  for (const k of STAT_KEYS) out[k] = Math.max(0, Math.min(100, out[k]));
  return out;
}

export function fxText(fx: Partial<Stats>): string {
  const parts = STAT_KEYS.filter((k) => fx[k]).map((k) => `+${fx[k]} ${STAT_SHORT[k]}`);
  return parts.length ? parts.join("  ") : "بدون تأثير";
}

/* ───────── محاكاة السباق ───────── */

export const RACE = {
  fee: 100,
  maxPlayers: 6,
  minPlayers: 2,
  lobbyMs: 2 * 60_000,
  ticks: 8,
  frameMs: 1_500,
  /** توزيع الجائزة (من مجموع الرسوم) */
  split: [0.6, 0.3, 0.1],
} as const;

/** يرجّع مواقع كل سيارة في كل خطوة (من 0 إلى 1 نسبة لأبعد سيارة) والنتيجة النهائية */
export function simulate(stats: Stats[]): { frames: number[][]; order: number[] } {
  const dist = stats.map(() => 0);
  const raw: number[][] = [stats.map(() => 0)];
  const corners = new Set([2, 4, 6]);
  for (let t = 0; t < RACE.ticks; t++) {
    stats.forEach((s, i) => {
      const accel = Math.min(1, 0.45 + (s.accel / 100) * 0.45 + t * 0.1);
      const corner = corners.has(t) ? 0.6 + 0.4 * ((s.handling * 0.6 + s.braking * 0.4) / 100) : 1;
      const rnd = 0.92 + Math.random() * 0.16;
      dist[i] = (dist[i] as number) + (40 + s.speed * 0.8) * accel * corner * rnd;
    });
    raw.push([...dist]);
  }
  const max = Math.max(...dist);
  const frames = raw.map((f) => f.map((d) => d / max));
  const order = dist.map((_, i) => i).sort((a, b) => (dist[b] as number) - (dist[a] as number));
  return { frames, order };
}

/** توزيع الجوائز: 2 لاعبين = الأول ياخذ الكل */
export function payouts(n: number): number[] {
  const pool = RACE.fee * n;
  if (n <= 2) return [pool, ...Array(n - 1).fill(0)];
  const out = RACE.split.map((p) => Math.floor(pool * p));
  const res = Array.from({ length: n }, (_, i) => out[i] ?? 0);
  res[0] = (res[0] as number) + (pool - res.reduce((s, x) => s + x, 0));
  return res;
}
