import { COMPOUND_MAP, COMPOUNDS, type CompoundDef } from "./compounds";
import { ELEMENT_MAP } from "./elements";
import { LabProfile, type ILabProfile } from "../database/models/LabProfile";
import { LabSession, type ILabSession } from "../database/models/LabSession";
import { UserProfile } from "../database/models/UserProfile";

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

export async function addToMix(userId: string, guildId: string, elementId: string): Promise<{ ok: boolean; reason?: string }> {
  const profile = await getLabProfile(userId, guildId);
  const owned = profile.inventory[elementId] ?? 0;
  const session = await getSession(userId, guildId);
  const inMix = session.mix[elementId] ?? 0;

  if (inMix >= owned) return { ok: false, reason: "insufficient" };

  await LabSession.updateOne(
    { userId, guildId },
    { $inc: { [`mix.${elementId}`]: 1 }, $set: { updatedAt: new Date() } },
  );
  return { ok: true };
}

export async function adjustTemp(userId: string, guildId: string, delta: number, min: number, max: number): Promise<number> {
  const session = await getSession(userId, guildId);
  const next = Math.min(max, Math.max(min, session.temp + delta));
  await LabSession.updateOne({ userId, guildId }, { $set: { temp: next, updatedAt: new Date() } });
  return next;
}

export async function adjustPressure(userId: string, guildId: string, delta: number, min: number, max: number): Promise<number> {
  const session = await getSession(userId, guildId);
  const next = Math.min(max, Math.max(min, session.pressure + delta));
  await LabSession.updateOne({ userId, guildId }, { $set: { pressure: next, updatedAt: new Date() } });
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

function xpNeeded(level: number): number {
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
  | { ok: true; success: false }
  | { ok: false; reason: "empty_mix" };

export async function attemptReaction(userId: string, guildId: string): Promise<ReactResult> {
  const session = await getSession(userId, guildId);
  const mixEntries = Object.entries(session.mix).filter(([, qty]) => qty > 0);
  if (mixEntries.length === 0) return { ok: false, reason: "empty_mix" };

  const match = COMPOUNDS.find((c) => {
    const recipeEntries = Object.entries(c.recipe);
    if (recipeEntries.length !== mixEntries.length) return false;
    const sameIngredients = recipeEntries.every(([id, qty]) => (session.mix[id] ?? 0) === qty);
    if (!sameIngredients) return false;
    const [tMin, tMax] = c.tempRange;
    const [pMin, pMax] = c.pressureRange;
    return session.temp >= tMin && session.temp <= tMax && session.pressure >= pMin && session.pressure <= pMax;
  });

  const compoundDecrements: Record<string, number> = {};
  for (const [id, qty] of mixEntries) {
    if (COMPOUND_MAP[id]) compoundDecrements[`compounds.${id}`] = -qty;
    else compoundDecrements[`inventory.${id}`] = -qty;
  }
  await LabProfile.updateOne({ userId, guildId }, { $inc: compoundDecrements });
  await resetSession(userId, guildId);

  if (!match) return { ok: true, success: false };

  const profile = await getLabProfile(userId, guildId);
  const discoveredNow = !profile.discovered.includes(match.id);

  await LabProfile.updateOne(
    { userId, guildId },
    {
      $inc: { [`compounds.${match.id}`]: 1 },
      ...(discoveredNow ? { $addToSet: { discovered: match.id } } : {}),
    },
  );

  const xpResult = await grantLabXp(userId, guildId, match.xp);
  return { ok: true, success: true, compound: match, discoveredNow, xpResult };
}

export async function publishArticle(userId: string, guildId: string, compoundId: string): Promise<{ ok: boolean; reputation?: number }> {
  const compound = COMPOUND_MAP[compoundId];
  if (!compound || compound.rarity !== "legendary") return { ok: false };

  const profile = await getLabProfile(userId, guildId);
  if (!profile.discovered.includes(compoundId)) return { ok: false };

  const gain = 50;
  await LabProfile.updateOne({ userId, guildId }, { $inc: { reputation: gain } });
  return { ok: true, reputation: gain };
}
