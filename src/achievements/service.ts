import { Achievement } from "../database/models/Achievement";

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "miser", name: "البخيل", icon: "🪙", desc: "حوّل 1 لشخص" },
  { id: "generous", name: "كريم", icon: "💝", desc: "حوّل 1000 لشخص" },
  { id: "city_guardian", name: "حامي المدينة", icon: "🛡️", desc: "اسجن 10 أشخاص" },
  { id: "professor", name: "البروفيسور", icon: "🎓", desc: "نفّذ سطو البنك بدون خطأ واحد" },
  { id: "too_fast", name: "تو فاست", icon: "⚡", desc: "فُز بالمركز الأول في السباقات 10 مرات على التوالي" },
  { id: "too_slow", name: "تو سلو", icon: "🐢", desc: "خذ المركز الأخير في السباقات 10 مرات على التوالي" },
];
const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const NEED = { jails: 10, streak: 10, generous: 1000 } as const;

/** يفتح الإنجاز مرة وحدة بس. يرجّع true لو انفتح الحين */
async function unlock(guildId: string, userId: string, id: string): Promise<boolean> {
  try {
    const r = await Achievement.updateOne({ guildId, userId, "unlocked.id": { $ne: id } }, { $push: { unlocked: { id, at: new Date() } } }, { upsert: true });
    return r.modifiedCount > 0 || r.upsertedCount > 0;
  } catch {
    return false; // موجود من قبل
  }
}

async function unlockMany(guildId: string, userId: string, ids: string[]): Promise<AchievementDef[]> {
  const out: AchievementDef[] = [];
  for (const id of ids) {
    const def = BY_ID.get(id);
    if (def && (await unlock(guildId, userId, id))) out.push(def);
  }
  return out;
}

/** تحويل فلوس من شخص لشخص */
export async function trackTransfer(guildId: string, userId: string, amount: number): Promise<AchievementDef[]> {
  const ids: string[] = [];
  if (amount === 1) ids.push("miser");
  if (amount >= NEED.generous) ids.push("generous");
  return ids.length ? unlockMany(guildId, userId, ids) : [];
}

/** الشرطي سجن شخص */
export async function trackJail(guildId: string, userId: string): Promise<AchievementDef[]> {
  const doc = await Achievement.findOneAndUpdate({ guildId, userId }, { $inc: { jails: 1 } }, { upsert: true, new: true });
  return (doc?.jails ?? 0) >= NEED.jails ? unlockMany(guildId, userId, ["city_guardian"]) : [];
}

/** سطو البنك بدون أي خطأ */
export async function trackHeistFlawless(guildId: string, userId: string): Promise<AchievementDef[]> {
  return unlockMany(guildId, userId, ["professor"]);
}

/** نتيجة سباق: position = ترتيبه (1 = الأول)، total = عدد المتسابقين */
export async function trackRace(guildId: string, userId: string, position: number, total: number): Promise<AchievementDef[]> {
  if (total < 2) return [];
  const first = position === 1;
  const last = position === total;
  const doc = await Achievement.findOneAndUpdate(
    { guildId, userId },
    [{ $set: { firstStreak: first ? { $add: [{ $ifNull: ["$firstStreak", 0] }, 1] } : 0, lastStreak: last ? { $add: [{ $ifNull: ["$lastStreak", 0] }, 1] } : 0 } }],
    { upsert: true, new: true },
  );
  const ids: string[] = [];
  if ((doc?.firstStreak ?? 0) >= NEED.streak) ids.push("too_fast");
  if ((doc?.lastStreak ?? 0) >= NEED.streak) ids.push("too_slow");
  return ids.length ? unlockMany(guildId, userId, ids) : [];
}

export async function getAchievements(guildId: string, userId: string) {
  const doc = await Achievement.findOne({ guildId, userId });
  const unlocked = new Map<string, Date>((doc?.unlocked ?? []).map((u: { id?: string | null; at?: Date | null }) => [String(u.id), u.at ? new Date(u.at) : new Date()]));
  return { unlocked, jails: doc?.jails ?? 0, firstStreak: doc?.firstStreak ?? 0, lastStreak: doc?.lastStreak ?? 0 };
}
