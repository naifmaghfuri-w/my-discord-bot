import { COMPOUND_MAP, COMPOUNDS, PRESSURE, STEP_MULTIPLIERS, TEMP, type CompoundDef } from "./compounds";
import { ELEMENT_MAP } from "./elements";
import { LabProfile, type ILabProfile } from "../database/models/LabProfile";
import { LabSession, type ILabSession } from "../database/models/LabSession";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";
import { ENGRAM_MAP, engramName, engramState, hasEngram, pointsForLevel } from "./engrams";
import { accidentChance, applyRadiation, consumableCount, consumeOne, hasGear, sickMinutesLeft, tolerance } from "./workshop";

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
  return el.tier !== 2 || profile.unlockedElements.includes(elementId);
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

export async function setTemp(userId: string, guildId: string, value: number): Promise<void> {
  const v = Math.min(TEMP.max, Math.max(TEMP.min, Math.round(value)));
  await getSession(userId, guildId);
  await LabSession.updateOne({ userId, guildId }, { $set: { temp: v, updatedAt: new Date() } });
}

export async function setPressure(userId: string, guildId: string, value: number): Promise<void> {
  const v = Math.min(PRESSURE.max, Math.max(PRESSURE.min, Math.round(value)));
  await getSession(userId, guildId);
  await LabSession.updateOne({ userId, guildId }, { $set: { pressure: v, updatedAt: new Date() } });
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
  if (el.tier === 3 || (el.tier === 2 && !profile.unlockedElements.includes(elementId))) return { ok: false, reason: "locked" };

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

export type UnlockResult =
  | { ok: true; name: string }
  | { ok: false; reason: "already" | "points" | "level" | "prereq" | "unknown"; need?: string };

/** فتح إنجرام (عنصر/جهاز/تقنية): يتحقق من المستوى والمتطلبات والنقاط، وخصم النقاط ذرّي */
export async function unlockEngram(userId: string, guildId: string, engramId: string): Promise<UnlockResult> {
  const def = ENGRAM_MAP[engramId];
  if (!def) return { ok: false, reason: "unknown" };

  const profile = await getLabProfile(userId, guildId);
  const state = engramState(profile, def);
  if (state === "unlocked") return { ok: false, reason: "already" };
  if (state === "need_level") return { ok: false, reason: "level", need: String(def.level) };
  if (state === "need_prereq") {
    const missing = def.requires.filter((r) => !hasEngram(profile, r)).map(engramName);
    return { ok: false, reason: "prereq", need: missing.join("، ") };
  }
  if (state === "need_points") return { ok: false, reason: "points", need: String(def.cost) };

  const field = def.kind === "element" ? "unlockedElements" : "engrams";
  const updated = await LabProfile.findOneAndUpdate(
    { userId, guildId, labTokens: { $gte: def.cost }, labLevel: { $gte: def.level }, [field]: { $ne: engramId } },
    { $inc: { labTokens: -def.cost }, $addToSet: { [field]: engramId } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "points", need: String(def.cost) };
  return { ok: true, name: def.name };
}

export function xpNeeded(level: number): number {
  return 100 + level * 80;
}

export interface GrantXpResult {
  level: number;
  leveledUp: boolean;
  tokensGained: number;
}

export async function grantLabXp(userId: string, guildId: string, xp: number): Promise<GrantXpResult> {
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
    tokensGained += pointsForLevel(level);
  }

  if (tokensGained > 0) {
    // نظام الإنجرام: نقاط الفتح تزيد مع المستويات العالية
    await LabProfile.updateOne(
      { userId, guildId },
      { $set: { labLevel: level, labXp: xpLeft }, $inc: { labTokens: tokensGained } },
    );
  }

  return { level, leveledUp: tokensGained > 0, tokensGained };
}

/** سمعة تُكتسب عند أول اكتشاف (النادر جداً يُكتسب بنشر مقال) */
export const DISCOVERY_REPUTATION: Record<string, number> = { common: 0, uncommon: 1, rare: 3, epic: 8, legendary: 0 };

export interface ReactionSnapshot {
  mix: Record<string, number>;
  temp: number;
  pressure: number;
}

export type ReactResult =
  | { ok: true; success: true; compound: CompoundDef; discoveredNow: boolean; xpResult: GrantXpResult; snapshot: ReactionSnapshot; notes: string[]; qty: number }
  | { ok: true; success: false; kind: "near"; compound: CompoundDef; hints: string[] }
  | { ok: true; success: false; kind: "fail"; xp: number; waste: number; snapshot: ReactionSnapshot; notes: string[] }
  | { ok: true; success: false; kind: "accident"; compound: CompoundDef; xp: number; waste: number; snapshot: ReactionSnapshot; notes: string[] }
  | { ok: false; reason: "empty_mix" | "missing" | "sick" | "locked_recipe"; minutes?: number; engram?: string };

const CATALYST_TEMP = 20;
const CATALYST_PRESSURE = 3;
const DISTILLER_CHANCE = 0.25;
const ENERGY_XP_MULT = 1.5;

/** أسباب خروج الظروف عن النطاق (فاضي = ضمن النطاق) */
function conditionHints(c: CompoundDef, temp: number, pressure: number, tol: { temp: number; pressure: number }): string[] {
  const hints: string[] = [];
  if (temp < c.tempRange[0] - tol.temp) hints.push("🌡️ الحرارة منخفضة، ارفعها");
  if (temp > c.tempRange[1] + tol.temp) hints.push("🌡️ الحرارة عالية، خفّضها");
  if (pressure < c.pressureRange[0] - tol.pressure) hints.push("💨 الضغط منخفض، ارفعه");
  if (pressure > c.pressureRange[1] + tol.pressure) hints.push("💨 الضغط عالٍ، خفّضه");
  return hints;
}

/** المحلّل: لو الخليط جزء من وصفة مجهولة نلمّح (بدون كشف التفاصيل) */
function analyzerNote(mix: Record<string, number>, discovered: string[]): string | null {
  const entries = Object.entries(mix);
  const partial = COMPOUNDS.find(
    (c) =>
      !discovered.includes(c.id) &&
      Object.keys(c.recipe).length > entries.length &&
      entries.every(([id, q]) => (c.recipe[id] ?? 0) === q),
  );
  return partial ? "🔬 المحلّل: خليطك يطابق جزءاً من وصفة مجهولة، ينقصه مكوّن أو أكثر." : null;
}

export async function attemptReaction(userId: string, guildId: string): Promise<ReactResult> {
  const session = await getSession(userId, guildId);
  const mixEntries = Object.entries(session.mix).filter(([, qty]) => qty > 0);
  if (mixEntries.length === 0) return { ok: false, reason: "empty_mix" };

  // مصاب بالإشعاع: المختبر معطّل
  const gear = await getLabProfile(userId, guildId);
  const sick = sickMinutesLeft(gear);
  if (sick > 0) return { ok: false, reason: "sick", minutes: sick };
  const tol = tolerance(gear);
  const snapshot: ReactionSnapshot = { mix: Object.fromEntries(mixEntries), temp: session.temp, pressure: session.pressure };

  const sameIngredients = (c: CompoundDef) => {
    const recipeEntries = Object.entries(c.recipe);
    if (recipeEntries.length !== mixEntries.length) return false;
    return recipeEntries.every(([id, qty]) => (session.mix[id] ?? 0) === qty);
  };

  const candidate = COMPOUNDS.find(sameIngredients);
  const notes: string[] = [];

  // وصفة مقفلة بإنجرام: ما ننفّذ التفاعل ولا نستهلك شيئاً
  if (candidate?.engram && !hasEngram(gear, candidate.engram)) {
    return { ok: false, reason: "locked_recipe", engram: engramName(candidate.engram) };
  }

  // المكونات صح لكن الحرارة/الضغط غلط: نعطي تلميحاً ولا نستهلك شيئاً (إلا لو المحفّز ينقذ التفاعل)
  if (candidate && !candidate.byproduct) {
    const hints = conditionHints(candidate, session.temp, session.pressure, tol);
    if (hints.length > 0) {
      const widened = { temp: tol.temp + CATALYST_TEMP, pressure: tol.pressure + CATALYST_PRESSURE };
      const rescued =
        consumableCount(gear, "catalyst") > 0 &&
        conditionHints(candidate, session.temp, session.pressure, widened).length === 0 &&
        (await consumeOne(userId, guildId, "catalyst"));
      if (!rescued) return { ok: true, success: false, kind: "near", compound: candidate, hints };
      notes.push("🧫 المحفّز أنقذ التفاعل رغم أن الظروف كانت خارج النطاق!");
    }
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

  // تعرّض للإشعاع لو الخليط فيه مادة مشعة (يحميك منه البدلة)
  const radiationNote = await applyRadiation(userId, guildId, mixEntries.map(([id]) => id));
  if (radiationNote) notes.push(radiationNote);

  if (!candidate) {
    // التجربة الفاشلة ما تروح بدون فايدة: خبرة صغيرة + نفايات كيميائية قابلة لإعادة التدوير
    const waste = Math.max(1, Math.min(3, mixEntries.reduce((a, [, q]) => a + q, 0) - 1));
    await LabProfile.updateOne({ userId, guildId }, { $inc: { "inventory.waste": waste } });
    const xp = 4;
    await grantLabXp(userId, guildId, xp);
    if (hasGear(gear, "analyzer")) {
      const hint = analyzerNote(snapshot.mix, gear.discovered);
      if (hint) notes.push(hint);
    }
    return { ok: true, success: false, kind: "fail", xp, waste, snapshot, notes };
  }

  // حادث مختبر: التفاعلات الخطرة قد تنفجر، ومعدات السلامة تقلل الاحتمال، والمثبّت يمنعه
  if (Math.random() < accidentChance(candidate, gear)) {
    if (consumableCount(gear, "stabilizer") > 0 && (await consumeOne(userId, guildId, "stabilizer"))) {
      notes.push("🛡️ المثبّت منع انفجاراً في اللحظة الأخيرة!");
    } else {
      const waste = 1 + Math.floor(Math.random() * 2);
      const xp = 4;
      await LabProfile.updateOne({ userId, guildId }, { $inc: { "inventory.waste": waste } });
      await grantLabXp(userId, guildId, xp);
      return { ok: true, success: false, kind: "accident", compound: candidate, xp, waste, snapshot, notes };
    }
  }

  const profile = await getLabProfile(userId, guildId);
  const discoveredNow = !profile.discovered.includes(candidate.id);

  // وحدة التقطير: فرصة لمضاعفة الناتج
  let qty = 1;
  if (hasGear(profile, "distiller") && Math.random() < DISTILLER_CHANCE) {
    qty = 2;
    notes.push("⚗️ وحدة التقطير ضاعفت الناتج ×2!");
  }

  await LabProfile.updateOne(
    { userId, guildId },
    {
      $inc: { [`compounds.${candidate.id}`]: qty },
      ...(discoveredNow ? { $addToSet: { discovered: candidate.id } } : {}),
    },
  );

  // مشروب الطاقة: ×1.5 خبرة لهذا التفاعل
  let xp = candidate.xp;
  if (consumableCount(profile, "energy") > 0 && (await consumeOne(userId, guildId, "energy"))) {
    xp = Math.round(xp * ENERGY_XP_MULT);
    notes.push("🥤 مشروب الطاقة رفع خبرتك ×1.5!");
  }

  const xpResult = await grantLabXp(userId, guildId, xp);
  if (discoveredNow && DISCOVERY_REPUTATION[candidate.rarity]) {
    await LabProfile.updateOne({ userId, guildId }, { $inc: { reputation: DISCOVERY_REPUTATION[candidate.rarity] } });
  }
  return { ok: true, success: true, compound: candidate, discoveredNow, xpResult, snapshot, notes, qty };
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

/** سعر التلميح حسب ندرة المركب */
export const HINT_PRICE: Record<string, number> = { common: 50, uncommon: 100, rare: 200, epic: 400, legendary: 800 };

/** رمز المكوّن للوصفات (Fe، NaCl...)، وإذا ما له رمز يرجع الاسم */
export function recipeSymbol(id: string): string {
  const item = ELEMENT_MAP[id] ?? COMPOUND_MAP[id];
  if (!item) return id;
  return item.icon === "✦" || item.icon === "∅" ? item.name : item.icon;
}

/** كل التلميحات الممكنة لمركب: كل مكوّن، ثم الحرارة، ثم الضغط */
export function hintClues(c: CompoundDef): string[] {
  const clues = Object.entries(c.recipe).map(([id, q]) => `${recipeSymbol(id)}${q}`);
  clues.push(`🌡️ ${c.tempRange[0]}-${c.tempRange[1]}°`);
  clues.push(`💨 ${c.pressureRange[0]}-${c.pressureRange[1]}`);
  return clues;
}

export type HintResult =
  | { ok: true; clue: string; price: number; left: number }
  | { ok: false; reason: "unknown" | "discovered" | "no_more" | "coins" };

export async function buyHint(userId: string, guildId: string, compoundId: string): Promise<HintResult> {
  const def = COMPOUND_MAP[compoundId];
  if (!def) return { ok: false, reason: "unknown" };

  const profile = await getLabProfile(userId, guildId);
  if (profile.discovered.includes(compoundId)) return { ok: false, reason: "discovered" };

  const clues = hintClues(def);
  const bought = profile.hinted?.[compoundId] ?? 0;
  if (bought >= clues.length) return { ok: false, reason: "no_more" };

  const price = Math.round(HINT_PRICE[def.rarity] * (hasGear(profile, "analyzer") ? 0.5 : 1));
  const paid = await UserProfile.findOneAndUpdate(
    { userId, guildId, coins: { $gte: price } },
    { $inc: { coins: -price } },
    { new: true },
  );
  if (!paid) return { ok: false, reason: "coins" };

  await LabProfile.updateOne({ userId, guildId }, { $inc: { [`hinted.${compoundId}`]: 1 } });
  await logTransaction(guildId, userId, "lab_purchase", price);
  return { ok: true, clue: clues[bought], price, left: clues.length - bought - 1 };
}
