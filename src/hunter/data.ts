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
  { id: "brawler", name: "Arena Brawler", icon: "🥊", desc: "A veteran of the Heavens Arena floors.", minLevel: 4, nen: null, stats: { str: 22, spd: 17, end: 19, aura: 0 }, personality: "brute", xp: 110, coins: 280 },
  { id: "exam_beast", name: "Examination Beast", icon: "🐗", desc: "The Hunt stage: a beast that guards the trail.", minLevel: 1, nen: null, stats: { str: 15, spd: 12, end: 14, aura: 0 }, personality: "wild", xp: 0, coins: 0, exam: 2 },
  { id: "exam_rival", name: "Exam Rival", icon: "🥋", desc: "The Final Match: another applicant who wants the license too.", minLevel: 1, nen: null, stats: { str: 20, spd: 18, end: 17, aura: 6 }, personality: "trickster", xp: 0, coins: 0, exam: 3 },
];

export const ENEMY_MAP: Record<string, EnemyDef> = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

/* ───────────── اللغة ───────────── */

export type Lang = "en" | "ar";
export interface Bi {
  en: string;
  ar: string;
}

/* ───────────── الشخصيات ───────────── */

export interface CharDef {
  id: string;
  name: Bi;
  icon: string;
  nen: NenType | null;
  /** الإحصائيات عند المستوى 1 */
  base: Stats;
  /** الإحصائية المفضلة: +2 كل مستوى (البقية +1) */
  fav: StatKey;
  /** ملف الصورة داخل assets/hunter */
  image: string;
  unlock: { type: "story"; chapter: number } | { type: "shop"; price: number };
  desc: Bi;
}

export const CHARS: CharDef[] = [
  { id: "gon", name: { en: "Gon", ar: "غون" }, icon: "🌿", nen: "enhancer", base: { str: 14, spd: 11, end: 11, aura: 10 }, fav: "str", image: "gon.jpg", unlock: { type: "story", chapter: 1 }, desc: { en: "A cheerful boy with raw strength and endless determination.", ar: "فتى مرح بقوة خام وإصرار لا ينتهي." } },
  { id: "killua", name: { en: "Killua", ar: "كيلوا" }, icon: "⚡", nen: "transmuter", base: { str: 11, spd: 15, end: 10, aura: 11 }, fav: "spd", image: "killua.jpg", unlock: { type: "story", chapter: 4 }, desc: { en: "A lightning-fast assassin-trained prodigy.", ar: "عبقري سريع كالبرق تدرّب على الاغتيال." } },
  { id: "kurapika", name: { en: "Kurapika", ar: "كورابيكا" }, icon: "⛓️", nen: "conjurer", base: { str: 10, spd: 11, end: 14, aura: 11 }, fav: "end", image: "kurapika.jpg", unlock: { type: "story", chapter: 3 }, desc: { en: "A calm, durable strategist who outlasts his foes.", ar: "استراتيجي هادئ وصلب يتفوق بالصبر." } },
  { id: "leorio", name: { en: "Leorio", ar: "ليوريو" }, icon: "💼", nen: "emitter", base: { str: 10, spd: 10, end: 11, aura: 15 }, fav: "aura", image: "leorio.jpg", unlock: { type: "story", chapter: 2 }, desc: { en: "A determined future doctor with strong aura attacks.", ar: "طالب طب مصمم، قوي بهجمات الأورا." } },
  { id: "hanzo", name: { en: "Hanzo", ar: "هانزو" }, icon: "🥷", nen: null, base: { str: 16, spd: 15, end: 13, aura: 0 }, fav: "spd", image: "hanzo.jpg", unlock: { type: "shop", price: 4000 }, desc: { en: "A shinobi master of pure physical technique — no Nen needed.", ar: "شينوبي محترف بتقنية جسدية بحتة بدون نن." } },
  { id: "hisoka", name: { en: "Hisoka", ar: "هيسوكا" }, icon: "🃏", nen: "transmuter", base: { str: 15, spd: 15, end: 13, aura: 16 }, fav: "aura", image: "hisoka.jpg", unlock: { type: "shop", price: 12000 }, desc: { en: "A cunning magician whose aura sticks and stretches.", ar: "ساحر ماكر أوراه يلتصق ويتمدد." } },
];

export const CHAR_MAP: Record<string, CharDef> = Object.fromEntries(CHARS.map((c) => [c.id, c]));
export const SHOP_CHARS = CHARS.filter((c) => c.unlock.type === "shop");

/* ───────────── تطوير الشخصية: هجوم / دفاع / مراوغة ───────────── */

export type UpgKey = "atk" | "def" | "dod";
export const UPG_KEYS: UpgKey[] = ["atk", "def", "dod"];
/** كل مستوى تطوير يعطي +1 في الإحصائية المقابلة */
export const UPG_STAT: Record<UpgKey, StatKey> = { atk: "str", def: "end", dod: "spd" };
export const UPG_MAX = 10;
export const upgCost = (level: number): number => 200 * (level + 1);
export type Upgrades = Partial<Record<UpgKey, number>>;

export function charStats(c: CharDef, accountLevel: number, upg: Upgrades = {}): Stats {
  const lv = Math.max(0, accountLevel - 1);
  const s: Stats = { ...c.base };
  for (const k of STAT_KEYS) s[k] += lv * (k === c.fav ? 2 : 1);
  for (const u of UPG_KEYS) s[UPG_STAT[u]] += Math.min(UPG_MAX, upg[u] ?? 0);
  return s;
}

/* ───────────── القصة (حتى أرك Greed Island) ───────────── */

export interface Chapter {
  id: number;
  title: Bi;
  story: Bi;
  enemyId: string;
  minLevel: number;
  xp: number;
  coins: number;
  unlock?: string;
  license?: boolean;
}

export const CHAPTERS: Chapter[] = [
  { id: 1, title: { en: "Whale Island", ar: "جزيرة الحوت" }, story: { en: "A boy sets out to become a Hunter, but a wolf blocks the forest path.", ar: "فتى ينطلق ليصبح صيادًا، لكن ذئبًا يسد طريق الغابة." }, enemyId: "wolf", minLevel: 1, xp: 60, coins: 150, unlock: "gon" },
  { id: 2, title: { en: "Road to the Exam", ar: "الطريق إلى الاختبار" }, story: { en: "On the way to the exam site you meet a future doctor... and a bandit who wants your money.", ar: "في الطريق لموقع الاختبار تقابل طالب طب مستقبلي... وقاطع طريق يريد مالك." }, enemyId: "bandit", minLevel: 1, xp: 80, coins: 200, unlock: "leorio" },
  { id: 3, title: { en: "The Marsh", ar: "المستنقع" }, story: { en: "The Hunt begins in the swamp. A blond examinee watches your every move.", ar: "تبدأ المطاردة في المستنقع. متقدم أشقر يراقب كل حركة منك." }, enemyId: "exam_beast", minLevel: 3, xp: 100, coins: 250, unlock: "kurapika" },
  { id: 4, title: { en: "Trick Tower", ar: "برج الفخاخ" }, story: { en: "A shinobi stands in your way, and a silver-haired boy decides to join you.", ar: "شينوبي يقف في طريقك، وفتى فضي الشعر يقرر الانضمام إليك." }, enemyId: "hanzo", minLevel: 5, xp: 150, coins: 350, unlock: "killua" },
  { id: 5, title: { en: "The Final Match", ar: "المباراة النهائية" }, story: { en: "One last bout decides who earns the Hunter License.", ar: "نزال أخير يقرر من ينال رخصة الصياد." }, enemyId: "exam_rival", minLevel: 6, xp: 200, coins: 800, license: true },
  { id: 6, title: { en: "Heavens Arena", ar: "ساحة السماء" }, story: { en: "Hunters now, you climb the arena floors. The crowd roars for a brawler.", ar: "صرتم صيادين، وتتسلقون طوابق الساحة. والجمهور يهتف لمقاتل شرس." }, enemyId: "brawler", minLevel: 7, xp: 250, coins: 600 },
  { id: 7, title: { en: "Yorknew City", ar: "مدينة يوركنيو" }, story: { en: "A dangerous brawler of the Phantom Troupe appears in the city's shadows.", ar: "مقاتل خطير من فرقة الأشباح يظهر في ظلال المدينة." }, enemyId: "uvogin", minLevel: 9, xp: 400, coins: 1000 },
];
/** عدد فصول القصة الحالية؛ بعدها يبدأ أرك Greed Island (قريبًا) */
export const STORY_LENGTH = CHAPTERS.length;
