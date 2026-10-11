import { jenny } from "../constants";
import { LabProfile, type ILabProfile } from "../database/models/LabProfile";
import { UserProfile } from "../database/models/UserProfile";
import { todayKey } from "../quests/time";
import { CATEGORIES } from "./categories";
import { COMPOUNDS, type Rarity } from "./compounds";
import { getLabProfile, grantLabXp } from "./service";

/* ───────────── الألقاب العلمية (حسب السمعة) ───────────── */

export const TITLES: { min: number; name: string; icon: string }[] = [
  { min: 0, name: "متدرب", icon: "🧫" },
  { min: 10, name: "مساعد باحث", icon: "📎" },
  { min: 30, name: "باحث", icon: "🔬" },
  { min: 60, name: "دكتور", icon: "🎓" },
  { min: 100, name: "بروفيسور", icon: "🧑‍🏫" },
  { min: 160, name: "عالم عبقري", icon: "🧠" },
  { min: 250, name: "أسطورة علمية", icon: "👑" },
];

export function titleFor(reputation: number): { name: string; icon: string; next?: { name: string; min: number } } {
  let idx = 0;
  TITLES.forEach((t, i) => {
    if (reputation >= t.min) idx = i;
  });
  const next = TITLES[idx + 1];
  return { name: TITLES[idx].name, icon: TITLES[idx].icon, next: next ? { name: next.name, min: next.min } : undefined };
}

/* ───────────── المهام اليومية ───────────── */

export type QuestStat = "crafts" | "experiments" | "sold" | "bought" | "discoveries" | "advanced" | "trades";

export interface LabQuestDef {
  id: string;
  title: string;
  icon: string;
  stat: QuestStat;
  target: number;
  coins: number;
  xp: number;
}

export const LAB_QUESTS: LabQuestDef[] = [
  { id: "craft3", title: "اصنع 3 مركبات", icon: "⚗️", stat: "crafts", target: 3, coins: 150, xp: 30 },
  { id: "craft6", title: "اصنع 6 مركبات", icon: "🧪", stat: "crafts", target: 6, coins: 350, xp: 60 },
  { id: "exp5", title: "أجرِ 5 تجارب (نجحت أو فشلت)", icon: "🔬", stat: "experiments", target: 5, coins: 120, xp: 25 },
  { id: "sell500", title: "بع نواتج بقيمة 500", icon: "💵", stat: "sold", target: 500, coins: 200, xp: 30 },
  { id: "buy10", title: "اشتر 10 عناصر", icon: "🛒", stat: "bought", target: 10, coins: 100, xp: 20 },
  { id: "discover1", title: "اكتشف مركباً جديداً", icon: "🆕", stat: "discoveries", target: 1, coins: 250, xp: 50 },
  { id: "advanced2", title: "اصنع مركبين غير شائعين أو أعلى", icon: "💎", stat: "advanced", target: 2, coins: 300, xp: 55 },
  { id: "trade1", title: "أتمم صفقة تبادل مع لاعب", icon: "🤝", stat: "trades", target: 1, coins: 200, xp: 35 },
];

export const QUEST_COUNT = 3;

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** نفس مهام اليوم لكل اللاعبين، وتتغير يومياً */
export function questsForDay(day: string): LabQuestDef[] {
  const pool = [...LAB_QUESTS];
  const picked: LabQuestDef[] = [];
  let seed = hashStr(day);
  while (picked.length < QUEST_COUNT && pool.length > 0) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
    const q = pool.splice(seed % pool.length, 1)[0];
    // لا نجمع مهمتين على نفس العدّاد (مثل craft3 و craft6)
    if (picked.some((p) => p.stat === q.stat)) continue;
    picked.push(q);
  }
  return picked;
}

/* ───────────── الإنجازات ───────────── */

export interface AchievementDef {
  id: string;
  title: string;
  desc: string;
  icon: string;
  check: (p: ILabProfile) => boolean;
  reward: { tokens?: number; coins?: number; reputation?: number };
}

const stat = (p: ILabProfile, k: string) => p.stats?.[k] ?? 0;
const allOfRarity = (p: ILabProfile, r: Rarity) => COMPOUNDS.filter((c) => c.rarity === r).every((c) => p.discovered.includes(c.id));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_craft", title: "الخطوة الأولى", desc: "اصنع أول مركب", icon: "🧪", check: (p) => stat(p, "crafts") >= 1, reward: { coins: 50 } },
  { id: "crafts_25", title: "كيميائي نشيط", desc: "اصنع 25 مركباً", icon: "⚗️", check: (p) => stat(p, "crafts") >= 25, reward: { coins: 200, tokens: 1 } },
  { id: "crafts_100", title: "مصنع متنقل", desc: "اصنع 100 مركب", icon: "🏭", check: (p) => stat(p, "crafts") >= 100, reward: { coins: 800, tokens: 2, reputation: 5 } },
  { id: "discover_10", title: "فضولي", desc: "اكتشف 10 مركبات", icon: "📘", check: (p) => p.discovered.length >= 10, reward: { coins: 200, tokens: 1 } },
  { id: "discover_half", title: "موسوعي", desc: "اكتشف نصف المركبات", icon: "📚", check: (p) => p.discovered.length >= Math.ceil(COMPOUNDS.length / 2), reward: { coins: 600, tokens: 2, reputation: 10 } },
  { id: "all_common", title: "أساسيات الكيمياء", desc: "اكتشف كل المركبات الشائعة", icon: "🥉", check: (p) => allOfRarity(p, "common"), reward: { coins: 300, tokens: 1 } },
  { id: "all_rare", title: "نخبة المختبر", desc: "اكتشف كل المركبات النادرة", icon: "🥈", check: (p) => allOfRarity(p, "rare"), reward: { coins: 700, tokens: 2, reputation: 8 } },
  { id: "first_legend", title: "اكتشاف تاريخي", desc: "اكتشف مركباً نادراً جداً", icon: "🌟", check: (p) => COMPOUNDS.some((c) => c.rarity === "legendary" && p.discovered.includes(c.id)), reward: { coins: 1000, tokens: 3, reputation: 15 } },
  { id: "discover_all", title: "سيّد الكيمياء", desc: "اكتشف كل المركبات", icon: "👑", check: (p) => p.discovered.length >= COMPOUNDS.length, reward: { coins: 5000, tokens: 5, reputation: 50 } },
  { id: "seller_5000", title: "تاجر المختبر", desc: "اجمع 5,000 من بيع النواتج", icon: "💰", check: (p) => stat(p, "sold") >= 5000, reward: { coins: 500, tokens: 1 } },
  { id: "trader_5", title: "وسيط علمي", desc: "أتمم 5 صفقات تبادل", icon: "🤝", check: (p) => stat(p, "trades") >= 5, reward: { coins: 300, tokens: 1, reputation: 3 } },
  { id: "recycler", title: "خبير النفايات", desc: "فشلت 10 تجارب (والنفايات تفيد!)", icon: "♻️", check: (p) => stat(p, "fails") >= 10, reward: { coins: 150 } },
  { id: "scholar", title: "مرجع علمي", desc: "اوصل 100 سمعة", icon: "🎓", check: (p) => p.reputation >= 100, reward: { coins: 1000, tokens: 2 } },
  { id: "level_10", title: "باحث متمرس", desc: "اوصل مستوى 10", icon: "🔝", check: (p) => p.labLevel >= 10, reward: { coins: 600, reputation: 5 } },
];

for (const cat of CATEGORIES) {
  ACHIEVEMENTS.push({
    id: `cat_${cat.id}`,
    title: `خبير ${cat.name}`,
    desc: `اكتشف كل مركبات تصنيف «${cat.name}»`,
    icon: cat.icon,
    check: (p) => cat.members.every((m) => p.discovered.includes(m)),
    reward: cat.reward,
  });
}

/* ───────────── تسجيل الأحداث ───────────── */

export type LabEvent =
  | { type: "craft"; rarity: Rarity; discoveredNow: boolean }
  | { type: "experiment_failed" }
  | { type: "sell"; coins: number }
  | { type: "buy"; qty: number }
  | { type: "trade" }
  | { type: "hint" };

/**
 * يحدّث العدّادات والمهام اليومية والإنجازات بعد أي حدث،
 * ويرجع أسطراً جاهزة للعرض (مهمة اكتملت، إنجاز انفتح...).
 */
export async function recordEvent(userId: string, guildId: string, ev: LabEvent): Promise<string[]> {
  const lines: string[] = [];
  const profile = await getLabProfile(userId, guildId);
  const day = todayKey();

  const stats: Record<string, number> = { ...(profile.stats ?? {}) };
  const bump = (k: string, n = 1) => {
    stats[k] = (stats[k] ?? 0) + n;
  };
  const dayInc: Partial<Record<QuestStat, number>> = {};
  const q = (k: QuestStat, n = 1) => {
    dayInc[k] = (dayInc[k] ?? 0) + n;
  };

  switch (ev.type) {
    case "craft":
      bump("crafts");
      bump("experiments");
      q("crafts");
      q("experiments");
      if (ev.discoveredNow) q("discoveries");
      if (ev.rarity !== "common") q("advanced");
      break;
    case "experiment_failed":
      bump("fails");
      bump("experiments");
      q("experiments");
      break;
    case "sell":
      bump("sold", ev.coins);
      q("sold", ev.coins);
      break;
    case "buy":
      bump("bought", ev.qty);
      q("bought", ev.qty);
      break;
    case "trade":
      bump("trades");
      q("trades");
      break;
    case "hint":
      bump("hints");
      break;
  }

  // مهام اليوم (تصفير تلقائي إذا تغيّر اليوم)
  const sameDay = profile.questDay === day;
  const progress: Record<string, number> = sameDay ? { ...(profile.questProgress ?? {}) } : {};
  const done: string[] = sameDay ? [...(profile.questDone ?? [])] : [];
  let rewardCoins = 0;
  let rewardXp = 0;

  for (const quest of questsForDay(day)) {
    const add = dayInc[quest.stat] ?? 0;
    if (add > 0 && !done.includes(quest.id)) {
      progress[quest.id] = (progress[quest.id] ?? 0) + add;
      if (progress[quest.id] >= quest.target) {
        done.push(quest.id);
        rewardCoins += quest.coins;
        rewardXp += quest.xp;
        lines.push(`🎯 اكتملت مهمة **${quest.title}** (+${jenny(quest.coins)} • +${quest.xp} XP)`);
      }
    }
  }

  await LabProfile.updateOne(
    { userId, guildId },
    { $set: { stats, questDay: day, questProgress: progress, questDone: done } },
  );

  // الإنجازات: نفحص على نسخة محدثة من الملف
  const fresh = await getLabProfile(userId, guildId);
  let tokens = 0;
  let reputation = 0;
  for (const a of ACHIEVEMENTS) {
    if (fresh.achievements?.includes(a.id) || !a.check(fresh)) continue;
    // addToSet بشرط عدم وجودها: يمنع التكرار لو تزامنت أحداث
    const claimed = await LabProfile.findOneAndUpdate(
      { userId, guildId, achievements: { $ne: a.id } },
      { $addToSet: { achievements: a.id } },
    );
    if (!claimed) continue;
    rewardCoins += a.reward.coins ?? 0;
    tokens += a.reward.tokens ?? 0;
    reputation += a.reward.reputation ?? 0;
    const bits = [
      a.reward.coins ? jenny(a.reward.coins) : "",
      a.reward.tokens ? `${a.reward.tokens} 🔬` : "",
      a.reward.reputation ? `${a.reward.reputation} ✨` : "",
    ].filter(Boolean);
    lines.push(`🏅 إنجاز جديد: ${a.icon} **${a.title}** (${bits.join(" • ")})`);
  }

  if (rewardCoins > 0) await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: rewardCoins } }, { upsert: true });
  if (tokens > 0 || reputation > 0) {
    await LabProfile.updateOne({ userId, guildId }, { $inc: { labTokens: tokens, reputation } });
  }
  if (rewardXp > 0) {
    const xpRes = await grantLabXp(userId, guildId, rewardXp);
    if (xpRes.leveledUp) lines.push(`🆙 وصلت المستوى **${xpRes.level}** (+${xpRes.tokensGained} 🔬 نقاط فتح)`);
  }

  return lines;
}
