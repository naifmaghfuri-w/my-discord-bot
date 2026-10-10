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
  /** يظهر في القصة فقط */
  storyOnly?: boolean;
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
  { id: "rookie_crusher", name: "Rookie Crusher", icon: "🧃", desc: "A veteran applicant who preys on newcomers.", minLevel: 2, nen: null, stats: { str: 14, spd: 11, end: 14, aura: 0 }, personality: "tank", xp: 0, coins: 0, storyOnly: true },
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
  /** مهارة خاصة تحل محل النن (للي ما عنده نن) */
  special?: { name: Bi; icon: string };
}

export const CHARS: CharDef[] = [
  { id: "gon", name: { en: "Gon", ar: "غون" }, icon: "🌿", nen: null, special: { name: { en: "Fishing Rod", ar: "الصنارة" }, icon: "🎣" }, base: { str: 14, spd: 11, end: 11, aura: 10 }, fav: "str", image: "gon.jpg", unlock: { type: "story", chapter: 1 }, desc: { en: "A cheerful boy with raw strength and endless determination.", ar: "فتى مرح بقوة خام وإصرار لا ينتهي." } },
  { id: "killua", name: { en: "Killua", ar: "كيلوا" }, icon: "⚡", nen: "transmuter", base: { str: 11, spd: 15, end: 10, aura: 11 }, fav: "spd", image: "killua.jpg", unlock: { type: "story", chapter: 5 }, desc: { en: "A lightning-fast assassin-trained prodigy.", ar: "عبقري سريع كالبرق تدرّب على الاغتيال." } },
  { id: "kurapika", name: { en: "Kurapika", ar: "كورابيكا" }, icon: "⛓️", nen: "conjurer", base: { str: 10, spd: 11, end: 14, aura: 11 }, fav: "end", image: "kurapika.jpg", unlock: { type: "story", chapter: 4 }, desc: { en: "A calm, durable strategist who outlasts his foes.", ar: "استراتيجي هادئ وصلب يتفوق بالصبر." } },
  { id: "leorio", name: { en: "Leorio", ar: "ليوريو" }, icon: "💼", nen: "emitter", base: { str: 10, spd: 10, end: 11, aura: 15 }, fav: "aura", image: "leorio.jpg", unlock: { type: "story", chapter: 2 }, desc: { en: "A determined future doctor with strong aura attacks.", ar: "طالب طب مصمم، قوي بهجمات الأورا." } },
  { id: "tonpa", name: { en: "Tonpa", ar: "تونبا" }, icon: "🧃", nen: null, base: { str: 11, spd: 10, end: 14, aura: 0 }, fav: "end", image: "tonpa.jpg", unlock: { type: "story", chapter: 3 }, desc: { en: "A veteran examinee with a thick skin and a trick or two.", ar: "متقدم قديم بجلد سميك وحيلة أو اثنتين." } },
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
  /** المهمة المعروضة قبل البدء */
  mission: Bi;
  /** ماذا حصل بعد النجاح */
  outro: Bi;
  type: "fight" | "fishing";
  /** صورة الفصل (ملف في assets/hunter)، وإلا صورة الشخصية المفتوحة */
  image?: string;
  enemyId: string;
  minLevel: number;
  xp: number;
  coins: number;
  unlock?: string;
  license?: boolean;
}

export const CHAPTERS: Chapter[] = [
  { id: 1, type: "fishing", image: "chapter1.jpg", title: { en: "Departure from Whale Island", ar: "الانطلاق من جزيرة الحوت" }, mission: { en: "Catch the Lady of the Lake [giant fish]", ar: "اصطياد سيدة البحيرة [سمكة عملاقة]" }, outro: { en: "After a long struggle you reel in the Lady of the Lake! Proud and ready, you set off from Whale Island toward the Hunter Exam.", ar: "بعد صراع طويل سحبت سيدة البحيرة! فخور وجاهز، انطلقت من جزيرة الحوت نحو اختبار الصيادين." }, enemyId: "", minLevel: 1, xp: 60, coins: 150, unlock: "gon" },
  { id: 2, type: "fight", title: { en: "On the Road to the Exam", ar: "في الطريق إلى الاختبار" }, mission: { en: "Defeat the bandit blocking the road", ar: "اهزم قاطع الطريق الذي يسد الطريق" }, outro: { en: "The bandit flees! A tall student who watched the whole fight introduces himself and decides to travel with you.", ar: "هرب قاطع الطريق! طالب طويل شاهد القتال كله عرّف بنفسه وقرر السفر معك." }, enemyId: "bandit", minLevel: 1, xp: 80, coins: 200, unlock: "leorio" },
  { id: 3, type: "fight", title: { en: "The Rookie Crusher", ar: "محطّم المبتدئين" }, mission: { en: "Beat the veteran applicant who preys on newcomers", ar: "اهزم المتقدم القديم الذي يستغل المبتدئين" }, outro: { en: "The veteran admits defeat, hands you a (suspicious) drink and decides to tag along.", ar: "اعترف المتقدم القديم بالهزيمة، وقدّم لك مشروبًا (مشكوكًا فيه) وقرر مرافقتك." }, enemyId: "rookie_crusher", minLevel: 2, xp: 90, coins: 220, unlock: "tonpa" },
  { id: 4, type: "fight", title: { en: "The Marsh", ar: "المستنقع" }, mission: { en: "Survive the Hunt in the swamp", ar: "انجُ من المطاردة في المستنقع" }, outro: { en: "The beast falls. A calm blond examinee, who had been watching your every move, joins your group.", ar: "سقط الوحش. متقدم أشقر هادئ كان يراقب كل حركة منك ينضم إلى مجموعتك." }, enemyId: "exam_beast", minLevel: 3, xp: 100, coins: 250, unlock: "kurapika" },
  { id: 5, type: "fight", title: { en: "Trick Tower", ar: "برج الفخاخ" }, mission: { en: "Defeat the shinobi guarding the tower", ar: "اهزم الشينوبي الذي يحرس البرج" }, outro: { en: "The shinobi yields. A silver-haired boy, impressed, decides to join you.", ar: "استسلم الشينوبي. فتى فضي الشعر أُعجب بك وقرر الانضمام إليك." }, enemyId: "hanzo", minLevel: 5, xp: 150, coins: 350, unlock: "killua" },
  { id: 6, type: "fight", title: { en: "The Final Match", ar: "المباراة النهائية" }, mission: { en: "Win the last bout of the exam", ar: "اربح النزال الأخير من الاختبار" }, outro: { en: "You did it! The examiner hands you the **Hunter License**. A new world opens up.", ar: "نجحت! سلّمك الممتحن **رخصة الصياد**. عالم جديد ينفتح أمامك." }, enemyId: "exam_rival", minLevel: 6, xp: 200, coins: 800, license: true },
  { id: 7, type: "fight", title: { en: "Heavens Arena", ar: "ساحة السماء" }, mission: { en: "Climb the arena floors and beat the brawler", ar: "اصعد طوابق الساحة واهزم المقاتل الشرس" }, outro: { en: "The crowd roars as the brawler hits the mat. Word of your name spreads through the arena.", ar: "الجمهور يهتف والمقاتل على الأرض. اسمك بدأ ينتشر في الساحة." }, enemyId: "brawler", minLevel: 7, xp: 250, coins: 600 },
  { id: 8, type: "fight", title: { en: "Yorknew City", ar: "مدينة يوركنيو" }, mission: { en: "Face the dangerous brawler lurking in the city", ar: "واجه المقاتل الخطير المتربص في المدينة" }, outro: { en: "The brawler is down. The shadows of Yorknew grow quiet... for now.", ar: "سقط المقاتل. ظلال يوركنيو تهدأ... مؤقتًا." }, enemyId: "uvogin", minLevel: 10, xp: 400, coins: 1000 },
];
/** عدد فصول القصة الحالية؛ بعدها يبدأ أرك Greed Island (قريبًا) */
export const STORY_LENGTH = CHAPTERS.length;
