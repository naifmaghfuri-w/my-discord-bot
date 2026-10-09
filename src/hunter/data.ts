export type StatKey = "str" | "spd" | "end" | "aura";
export type Stats = Record<StatKey, number>;

export type NenType = "enhancer" | "emitter" | "transmuter" | "conjurer" | "manipulator" | "specialist";

export interface NenDef {
  name: string;
  icon: string;
  desc: string;
  /** احتمال الظهور في اختبار الماء (المجموع 100) */
  weight: number;
  /** الإحصائية المفضلة: تأخذ +4 في البداية و+2 كل مستوى (بقية الإحصائيات +1) */
  fav: StatKey | null;
}

export const NEN: Record<NenType, NenDef> = {
  enhancer: { name: "Enhancer", icon: "👊", desc: "Boosts the body itself. Strong, direct and reliable.", weight: 19, fav: "str" },
  emitter: { name: "Emitter", icon: "🌠", desc: "Projects aura away from the body. Hits hard with Nen attacks.", weight: 19, fav: "aura" },
  transmuter: { name: "Transmuter", icon: "⚡", desc: "Changes the nature of aura. Fast and unpredictable.", weight: 19, fav: "spd" },
  conjurer: { name: "Conjurer", icon: "🛡️", desc: "Creates solid objects out of aura. Durable and patient.", weight: 19, fav: "end" },
  manipulator: { name: "Manipulator", icon: "🎭", desc: "Controls others and objects. Excels at wearing foes down.", weight: 19, fav: "aura" },
  specialist: { name: "Specialist", icon: "✨", desc: "A rare, unique ability that fits no category. Balanced growth.", weight: 5, fav: null },
};

export const NEN_TYPES = Object.keys(NEN) as NenType[];

/**
 * دورة التفوق (قاعدة لعبة، مو من العمل الأصلي):
 * enhancer > emitter > manipulator > conjurer > transmuter > enhancer
 */
const BEATS: Partial<Record<NenType, NenType>> = {
  enhancer: "emitter",
  emitter: "manipulator",
  manipulator: "conjurer",
  conjurer: "transmuter",
  transmuter: "enhancer",
};

export const ADVANTAGE = 1.2;
export const DISADVANTAGE = 0.85;
export const SPECIALIST_BONUS = 1.1;

export function affinity(att: NenType | null, def: NenType | null): number {
  if (!att) return 1;
  if (att === "specialist") return SPECIALIST_BONUS;
  if (!def) return 1;
  if (BEATS[att] === def) return ADVANTAGE;
  if (BEATS[def] === att) return DISADVANTAGE;
  return 1;
}

export const STAT_INFO: Record<StatKey, { name: string; icon: string }> = {
  str: { name: "Strength", icon: "💪" },
  spd: { name: "Speed", icon: "💨" },
  end: { name: "Endurance", icon: "🛡️" },
  aura: { name: "Aura", icon: "🔮" },
};
export const STAT_KEYS = Object.keys(STAT_INFO) as StatKey[];

export const BASE_STAT = 10;
export const FAV_START_BONUS = 4;

export function startingStats(nen: NenType): Stats {
  const s: Stats = { str: BASE_STAT, spd: BASE_STAT, end: BASE_STAT, aura: BASE_STAT };
  const fav = NEN[nen].fav;
  if (fav) s[fav] += FAV_START_BONUS;
  else for (const k of STAT_KEYS) s[k] += 1;
  return s;
}

/** مكاسب المستوى الواحد */
export function levelGain(nen: NenType, rng: () => number = Math.random): Stats {
  const g: Stats = { str: 1, spd: 1, end: 1, aura: 1 };
  const fav = NEN[nen].fav;
  if (fav) g[fav] += 1;
  else g[STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)]] += 1;
  return g;
}

export const xpNeeded = (level: number): number => 100 + level * 60;

export const RANKS: { min: number; name: string; icon: string }[] = [
  { min: 1, name: "Applicant", icon: "📄" },
  { min: 5, name: "Amateur Hunter", icon: "🌱" },
  { min: 10, name: "Pro Hunter", icon: "⭐" },
  { min: 20, name: "Star Hunter", icon: "🌟" },
  { min: 35, name: "Double-Star Hunter", icon: "💫" },
  { min: 50, name: "Triple-Star Hunter", icon: "👑" },
];

export function rankFor(level: number): { name: string; icon: string } {
  let r = RANKS[0];
  for (const x of RANKS) if (level >= x.min) r = x;
  return r;
}

/* ───────────── الخصوم (بوتات) ───────────── */

export type Personality = "brute" | "trickster" | "wild" | "tank";

export interface EnemyDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  minLevel: number;
  nen: NenType | null;
  stats: Stats;
  personality: Personality;
  xp: number;
  coins: number;
  /** خصم اختبار الصياد: مرحلة الاختبار اللي يظهر فيها (مخفي من قائمة القتال) */
  exam?: 2 | 3;
  /** يحتاج رخصة صياد */
  needsLicense?: boolean;
}

/** كل الأرقام هنا قابلة للتعديل لتوازن اللعبة */
export const ENEMIES: EnemyDef[] = [
  { id: "wolf", name: "Forest Wolf", icon: "🐺", desc: "A hungry predator from the woods.", minLevel: 1, nen: null, stats: { str: 8, spd: 11, end: 7, aura: 0 }, personality: "wild", xp: 25, coins: 60 },
  { id: "bandit", name: "Swamp Bandit", icon: "🗡️", desc: "A dirty fighter who ambushes travelers.", minLevel: 1, nen: null, stats: { str: 11, spd: 9, end: 10, aura: 0 }, personality: "brute", xp: 35, coins: 90 },
  { id: "hanzo", name: "Hanzo", icon: "🥷", desc: "A shinobi rival met on the road to the exam.", minLevel: 3, nen: "enhancer", stats: { str: 21, spd: 20, end: 18, aura: 10 }, personality: "trickster", xp: 75, coins: 190 },
  { id: "uvogin", name: "Uvogin", icon: "🦍", desc: "A brawler who fights for the thrill of it.", minLevel: 6, nen: "enhancer", stats: { str: 28, spd: 20, end: 20, aura: 18 }, personality: "brute", xp: 160, coins: 420, needsLicense: true },
  { id: "hisoka", name: "Hisoka", icon: "🃏", desc: "A smiling magician who toys with his prey.", minLevel: 9, nen: "transmuter", stats: { str: 34, spd: 36, end: 25, aura: 38 }, personality: "trickster", xp: 320, coins: 850, needsLicense: true },
  { id: "exam_beast", name: "Examination Beast", icon: "🐗", desc: "The Hunt stage: a beast that guards the trail.", minLevel: 1, nen: null, stats: { str: 15, spd: 12, end: 14, aura: 0 }, personality: "wild", xp: 0, coins: 0, exam: 2 },
  { id: "exam_rival", name: "Exam Rival", icon: "🥋", desc: "The Final Match: another applicant who wants the license too.", minLevel: 1, nen: null, stats: { str: 20, spd: 18, end: 17, aura: 6 }, personality: "trickster", xp: 0, coins: 0, exam: 3 },
];

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
