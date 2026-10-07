import { COMPOUND_MAP, COMPOUNDS, STEP_MULTIPLIERS, type CompoundDef } from "./compounds";
import { ELEMENT_MAP } from "./elements";
import { LabProfile, type ILabProfile } from "../database/models/LabProfile";
import { LabSession, type ILabSession } from "../database/models/LabSession";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";

export async function getLabProfile(userId: string, guildId: string): Promise<ILabProfile> {
  const doc = await LabProfile.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId } },
    { upsert: true, new: true },
  );
  if (!doc) throw new Error("فشل جلب ملف المختبر");
  return doc;
}

export async function getSession(userId: string, guildId: string): Promise<ILabSession> {
  const doc = await LabSession.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId } },
    { upsert: true, new: true },
  );
  if (!doc) throw new Error("فشل جلب جلسة المختبر");
  return doc;
}

export async function resetSession(userId: string, guildId: string): Promise<void> {
  await LabSession.updateOne(
    { userId, guildId },
    { $set: { mix: {}, temp: 20, pressure: 1, updatedAt: new Date() } },
    { upsert: true },
  );
}

export function isElementAvailable(profile: ILabProfile, elementId: string): boolean {
  const el = ELEMENT_MAP[elementId];
  if (!el) return false;
  return el.tier === 1 || profile.unlockedElements.includes(elementId);
}

export async function addToMix(userId: string, guildId: string, itemId: string): Promise<{ ok: boolean; reason?: string }> {
  const isCompound = Boolean(COMPOUND_MAP[itemId]);
  if (!isCompound && !ELEMENT_MAP[itemId]) return { ok: false, reason: "unknown" };

  const profile = await getLabProfile(userId, guildId);
  if (!isCompound && !isElementAvailable(profile, itemId)) return { ok: false, reason: "locked" };

  const owned = (isCompound ? profile.compounds[itemId] : profile.inventory[itemId]) ?? 0;
  const session = await getSession(userId, guildId);
  const inMix = session.mix[itemId] ?? 0;

  if (inMix >= owned) return { ok: false, reason: "insufficient" };

  await LabSession.updateOne(
    { userId, guildId },
    { $inc: { [`mix.${itemId}`]: 1 }, $set: { updatedAt: new Date() } },
  );
  return { ok: true };
}

export async function adjustTemp(userId: string, guildId: string, direction: 1 | -1, baseStep: number, min: number, max: number): Promise<number> {
  const session = await getSession(userId, guildId);
  const next = Math.min(max, Math.max(min, session.temp + direction * baseStep * (session.stepMult || 1)));
  await LabSession.updateOne({ userId, guildId }, { $set: { temp: next, updatedAt: new Date() } });
  return next;
}

export async function adjustPressure(userId: string, guildId: string, direction: 1 | -1, baseStep: number, min: number, max: number): Promise<number> {
  const session = await getSession(userId, guildId);
  const next = Math.min(max, Math.max(min, session.pressure + direction * baseStep * (session.stepMult || 1)));
  await LabSession.updateOne({ userId, guildId }, { $set: { pressure: next, updatedAt: new Date() } });
  return next;
}

export async function toggleStep(userId: string, guildId: string): Promise<number> {
  const session = await getSession(userId, guildId);
  const idx = STEP_MULTIPLIERS.indexOf((session.stepMult || 1) as (typeof STEP_MULTIPLIERS)[number]);
  const next = STEP_MULTIPLIERS[(idx + 1) % STEP_MULTIPLIERS.length];
  await LabSession.updateOne({ userId, guildId }, { $set: { stepMult: next, updatedAt: new Date() } });
  return next;
}

export type BuyResult = { ok: true; spent: number } | { ok: false; reason: "locked" | "insufficient" };

export async function buyElement(userId: string, guildId: string, elementId: string, qty: number): Promise<BuyResult> {
  const el = ELEMENT_MAP[elementId];
  if (!el) return { ok: false, reason: "locked" };

  const profile = await getLabProfile(userId, guildId);
  if (el.tier === 2 && !profile.unlockedElements.includes(elementId)) return { ok: false, reason: "locked" };

  const cost = el.price * qty;
  const updated = await UserProfile.findOneAndUpdate(
    { userId, guildId, coins: { $gte: cost } },
    { $inc: { coins: -cost } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "insufficient" };

  await LabProfile.updateOne({ userId, guildId }, { $inc: { [`inventory.${elementId}`]: qty } });
  await logTransaction(guildId, userId, "lab_purchase", cost);
  return { ok: true, spent: cost };
}

export type UnlockResult = { ok: true } | { ok: false; reason: "already" | "tokens" | "unknown" };

export async function unlockElement(userId: string, guildId: string, elementId: string): Promise<UnlockResult> {
  const el = ELEMENT_MAP[elementId];
  if (!el || el.tier !== 2 || !el.unlockCost) return { ok: false, reason: "unknown" };

  const profile = await getLabProfile(userId, guildId);
  if (profile.unlockedElements.includes(elementId)) return { ok: false, reason: "already" };

  const updated = await LabProfile.findOneAndUpdate(
    { userId, guildId, labTokens: { $gte: el.unlockCost } },
    { $inc: { labTokens: -el.unlockCost }, $addToSet: { unlockedElements: elementId } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "tokens" };
  return { ok: true };
}

export function xpNeeded(level: number): number {
  return 100 + level * 80;
}

export interface GrantXpResult {
  level: number;
  leveledUp: boolean;
  tokensGained: number;
}

async function grantLabXp(userId: string, guildId: string, xp: number): Promise<GrantXpResult> {
  const doc = await LabProfile.findOneAndUpdate(
    { userId, guildId },
    { $inc: { labXp: xp } },
    { upsert: true, new: true },
  );
  if (!doc) throw new Error("فشل إضافة خبرة المختبر");

  let level = doc.labLevel;
  let xpLeft = doc.labXp;
  let tokensGained = 0;

  while (xpLeft >= xpNeeded(level)) {
    xpLeft -= xpNeeded(level);
    level++;
    tokensGained++;
  }

  if (tokensGained > 0) {
    await LabProfile.updateOne(
      { userId, guildId },
      { $set: { labLevel: level, labXp: xpLeft }, $inc: { labTokens: tokensGained } },
    );
  }

  return { level, leveledUp: tokensGained > 0, tokensGained };
}

export type ReactResult =
  | { ok: true; success: true; compound: CompoundDef; discoveredNow: boolean; xpResult: GrantXpResult }
  | { ok: true; success: false; kind: "near"; compound: CompoundDef; hints: string[] }
  | { ok: true; success: false; kind: "fail" }
  | { ok: false; reason: "empty_mix" | "missing" };

export async function attemptReaction(userId: string, guildId: string): Promise<ReactResult> {
  const session = await getSession(userId, guildId);
  const mixEntries = Object.entries(session.mix).filter(([, qty]) => qty > 0);
  if (mixEntries.length === 0) return { ok: false, reason: "empty_mix" };

  const sameIngredients = (c: CompoundDef) => {
    const recipeEntries = Object.entries(c.recipe);
    if (recipeEntries.length !== mixEntries.length) return false;
    return recipeEntries.every(([id, qty]) => (session.mix[id] ?? 0) === qty);
  };

  const candidate = COMPOUNDS.find(sameIngredients);

  // المكونات صح لكن الحرارة/الضغط غلط: نعطي تلميحاً ولا نستهلك شيئاً
  if (candidate) {
    const [tMin, tMax] = candidate.tempRange;
    const [pMin, pMax] = candidate.pressureRange;
    const hints: string[] = [];
    if (session.temp < tMin) hints.push("🌡️ الحرارة منخفضة، ارفعها");
    if (session.temp > tMax) hints.push("🌡️ الحرارة عالية، خفّضها");
    if (session.pressure < pMin) hints.push("💨 الضغط منخفض، ارفعه");
    if (session.pressure > pMax) hints.push("💨 الضغط عالٍ، خفّضه");
    if (hints.length > 0) return { ok: true, success: false, kind: "near", compound: candidate, hints };
  }

  // خصم المكونات بشرط أنها موجودة فعلاً (حماية من التزامن)
  const filter: Record<string, string | { $gte: number }> = { userId, guildId };
  const decrements: Record<string, number> = {};
  for (const [id, qty] of mixEntries) {
    const path = COMPOUND_MAP[id] ? `compounds.${id}` : `inventory.${id}`;
    filter[path] = { $gte: qty };
    decrements[path] = -qty;
  }
  const consumed = await LabProfile.findOneAndUpdate(filter, { $inc: decrements });
  if (!consumed) {
    await resetSession(userId, guildId);
    return { ok: false, reason: "missing" };
  }
  await resetSession(userId, guildId);

  if (!candidate) return { ok: true, success: false, kind: "fail" };

  const profile = await getLabProfile(userId, guildId);
  const discoveredNow = !profile.discovered.includes(candidate.id);

  await LabProfile.updateOne(
    { userId, guildId },
    {
      $inc: { [`compounds.${candidate.id}`]: 1 },
      ...(discoveredNow ? { $addToSet: { discovered: candidate.id } } : {}),
    },
  );

  const xpResult = await grantLabXp(userId, guildId, candidate.xp);
  return { ok: true, success: true, compound: candidate, discoveredNow, xpResult };
}

export const ARTICLE_REPUTATION = 50;

export async function publishArticle(userId: string, guildId: string, compoundId: string): Promise<{ ok: boolean; reputation?: number; total?: number }> {
  const compound = COMPOUND_MAP[compoundId];
  if (!compound || compound.rarity !== "legendary") return { ok: false };

  // شرط واحد ذرّي: مكتشف + ما نُشر عنه من قبل (يمنع تكرار السمعة بالضغط المزدوج)
  const updated = await LabProfile.findOneAndUpdate(
    { userId, guildId, discovered: compoundId, published: { $ne: compoundId } },
    { $inc: { reputation: ARTICLE_REPUTATION }, $addToSet: { published: compoundId } },
    { new: true },
  );
  if (!updated) return { ok: false };
  return { ok: true, reputation: ARTICLE_REPUTATION, total: updated.reputation };
}

/** مكافأة السمعة على أسعار البيع: +1% لكل 10 سمعة، بحد أقصى 30% */
export function reputationBonus(reputation: number): number {
  return Math.min(0.3, Math.floor(reputation / 10) / 100);
}

export async function getTopScientists(guildId: string, limit = 10): Promise<ILabProfile[]> {
  return (await LabProfile.find({ guildId }).sort({ reputation: -1, labLevel: -1 }).limit(limit).lean()) as unknown as ILabProfile[];
}
