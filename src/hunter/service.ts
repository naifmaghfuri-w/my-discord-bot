import { HunterFight, type IHunterFight } from "../database/models/HunterFight";
import { HunterProfile, type IHunterProfile } from "../database/models/HunterProfile";
import { UserProfile } from "../database/models/UserProfile";
import { todayKey } from "../quests/time";
import {
  ENEMY_MAP,
  NEN,
  NEN_TYPES,
  STAT_KEYS,
  levelGain,
  startingStats,
  xpNeeded,
  type EnemyDef,
  type NenType,
  type StatKey,
} from "./data";
import {
  MAX_ROUNDS,
  chooseEnemyAction,
  effectiveAction,
  maxAura,
  maxHp,
  outcomeOf,
  resolveRound,
  type Action,
  type Fighter,
  type Outcome,
} from "./engine";

export const FIGHT_COOLDOWN_MS = 15_000;
export const TRAIN_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export const TRAIN_COST = 100;
export const DAILY_REWARDED_FIGHTS = 20;
export const EXAM_MIN_LEVEL = 5;
export const EXAM_FEE = 500;
export const EXAM_COOLDOWN_MS = 6 * 60 * 60 * 1000;
export const EXAM_REWARD = { xp: 200, coins: 1000 };

export const getHunter = (userId: string, guildId: string) => HunterProfile.findOne({ userId, guildId });

function rollNen(): NenType {
  let roll = Math.random() * NEN_TYPES.reduce((a, t) => a + NEN[t].weight, 0);
  for (const t of NEN_TYPES) {
    roll -= NEN[t].weight;
    if (roll <= 0) return t;
  }
  return "enhancer";
}

/** اختبار الماء والورقة: يحدد نوع النن ويُنشئ الصياد (لو موجود يرجعه كما هو) */
export async function createHunter(userId: string, guildId: string): Promise<IHunterProfile> {
  const nen = rollNen();
  const s = startingStats(nen);
  const doc = await HunterProfile.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId, nen, ...s, level: 1, xp: 0 } },
    { upsert: true, new: true },
  );
  if (!doc) throw new Error("Failed to create hunter");
  return doc;
}

export const statsOf = (p: IHunterProfile) => ({ str: p.str, spd: p.spd, end: p.end, aura: p.aura });

/* ───────────── الخبرة والمستويات ───────────── */

export interface GrantResult {
  level: number;
  leveledUp: boolean;
  levelsGained: number;
}

export async function grantHunterXp(userId: string, guildId: string, xp: number): Promise<GrantResult> {
  const doc = await HunterProfile.findOneAndUpdate({ userId, guildId }, { $inc: { xp } }, { new: true });
  if (!doc) return { level: 1, leveledUp: false, levelsGained: 0 };

  let level = doc.level;
  let left = doc.xp;
  const gains = { str: 0, spd: 0, end: 0, aura: 0 };
  let gained = 0;
  while (left >= xpNeeded(level)) {
    left -= xpNeeded(level);
    level++;
    gained++;
    const g = levelGain(doc.nen);
    for (const k of STAT_KEYS) gains[k] += g[k];
  }
  if (gained > 0) {
    await HunterProfile.updateOne({ userId, guildId }, { $set: { level, xp: left }, $inc: gains });
  }
  return { level, leveledUp: gained > 0, levelsGained: gained };
}

/* ───────────── التدريب ───────────── */

export type TrainResult =
  | { ok: true; stat: StatKey; value: number }
  | { ok: false; reason: "no_hunter" | "cooldown" | "coins"; msLeft?: number };

export async function trainStat(userId: string, guildId: string, stat: StatKey): Promise<TrainResult> {
  if (!STAT_KEYS.includes(stat)) return { ok: false, reason: "cooldown" };
  const now = Date.now();
  const cutoff = new Date(now - TRAIN_COOLDOWN_MS);

  const profile = await getHunter(userId, guildId);
  if (!profile) return { ok: false, reason: "no_hunter" };
  const last = profile.lastTrainAt ? new Date(profile.lastTrainAt).getTime() : 0;
  if (now - last < TRAIN_COOLDOWN_MS) return { ok: false, reason: "cooldown", msLeft: TRAIN_COOLDOWN_MS - (now - last) };

  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: TRAIN_COST } }, { $inc: { coins: -TRAIN_COST } });
  if (!paid) return { ok: false, reason: "coins" };

  // ذرّي: ما يتدرب مرتين بنفس اللحظة
  const updated = await HunterProfile.findOneAndUpdate(
    { userId, guildId, $or: [{ lastTrainAt: null }, { lastTrainAt: { $lte: cutoff } }] },
    { $inc: { [stat]: 1 }, $set: { lastTrainAt: new Date(now) } },
    { new: true },
  );
  if (!updated) {
    await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: TRAIN_COST } });
    return { ok: false, reason: "cooldown", msLeft: TRAIN_COOLDOWN_MS };
  }
  return { ok: true, stat, value: updated[stat] };
}

/* ───────────── القتال ضد البوتات ───────────── */

export function playerFighter(p: IHunterProfile, name: string, hp?: number, aura?: number): Fighter {
  const s = statsOf(p);
  return { name, nen: p.nen, stats: s, hp: hp ?? maxHp(s.end), aura: aura ?? maxAura(s.aura) };
}

export function enemyFighter(e: EnemyDef, hp?: number, aura?: number): Fighter {
  return { name: e.name, nen: e.nen, stats: e.stats, hp: hp ?? maxHp(e.stats.end), aura: aura ?? maxAura(e.stats.aura) };
}

export type StartResult =
  | { ok: true; fight: IHunterFight; enemy: EnemyDef }
  | { ok: false; reason: "no_hunter" | "unknown" | "locked" | "cooldown"; msLeft?: number; minLevel?: number; license?: boolean };

export async function startFight(userId: string, guildId: string, enemyId: string): Promise<StartResult> {
  const profile = await getHunter(userId, guildId);
  if (!profile) return { ok: false, reason: "no_hunter" };
  const enemy = ENEMY_MAP[enemyId];
  if (!enemy) return { ok: false, reason: "unknown" };
  if (enemy.exam && profile.examStage !== enemy.exam) return { ok: false, reason: "unknown" };
  if (enemy.needsLicense && !profile.license) return { ok: false, reason: "locked", minLevel: enemy.minLevel, license: true };
  if (profile.level < enemy.minLevel) return { ok: false, reason: "locked", minLevel: enemy.minLevel };

  const last = profile.lastFightAt ? new Date(profile.lastFightAt).getTime() : 0;
  const since = Date.now() - last;
  if (since < FIGHT_COOLDOWN_MS) return { ok: false, reason: "cooldown", msLeft: FIGHT_COOLDOWN_MS - since };

  const me = playerFighter(profile, "You");
  const foe = enemyFighter(enemy);
  const fight = await HunterFight.findOneAndUpdate(
    { userId, guildId },
    { $set: { enemyId, hp: me.hp, aura: me.aura, eHp: foe.hp, eAura: foe.aura, round: 0, lastLog: [], updatedAt: new Date() } },
    { upsert: true, new: true },
  );
  if (!fight) throw new Error("Failed to start fight");
  return { ok: true, fight, enemy };
}

export interface FightEnd {
  outcome: Exclude<Outcome, "ongoing">;
  xp: number;
  coins: number;
  capped: boolean;
  level: number;
  leveledUp: boolean;
  note?: string;
}

export type RoundResult =
  | { status: "stale" }
  | { status: "ongoing"; fight: IHunterFight; enemy: EnemyDef; log: string[] }
  | { status: "ended"; enemy: EnemyDef; log: string[]; end: FightEnd; finalHp: number; finalEHp: number };

export async function playRound(userId: string, guildId: string, action: Action, roundSeen: number): Promise<RoundResult> {
  const [fight, profile] = await Promise.all([HunterFight.findOne({ userId, guildId }), getHunter(userId, guildId)]);
  if (!fight || !profile || fight.round !== roundSeen) return { status: "stale" };
  const enemy = ENEMY_MAP[fight.enemyId];
  if (!enemy) return { status: "stale" };

  const me = playerFighter(profile, "You", fight.hp, fight.aura);
  const foe = enemyFighter(enemy, fight.eHp, fight.eAura);
  const foeAction = chooseEnemyAction(foe, enemy.personality, Math.random);
  const { log } = resolveRound(me, foe, action, foeAction);

  const round = roundSeen + 1;
  const outcome = outcomeOf(me, foe, round);

  if (outcome === "ongoing") {
    const updated = await HunterFight.findOneAndUpdate(
      { userId, guildId, round: roundSeen },
      { $set: { hp: me.hp, aura: me.aura, eHp: foe.hp, eAura: foe.aura, round, lastLog: log, updatedAt: new Date() } },
      { new: true },
    );
    if (!updated) return { status: "stale" };
    return { status: "ongoing", fight: updated, enemy, log };
  }

  // ننهي القتال مرة واحدة فقط (حذف ذرّي يمنع الجائزة المزدوجة)
  const removed = await HunterFight.findOneAndDelete({ userId, guildId, round: roundSeen });
  if (!removed) return { status: "stale" };
  const end = await settleFight(userId, guildId, profile, enemy, outcome);
  return { status: "ended", enemy, log, end, finalHp: me.hp, finalEHp: foe.hp };
}

async function settleFight(
  userId: string,
  guildId: string,
  profile: IHunterProfile,
  enemy: EnemyDef,
  outcome: Exclude<Outcome, "ongoing">,
): Promise<FightEnd> {
  if (enemy.exam) return settleExam(userId, guildId, profile, enemy, outcome);
  const day = todayKey();
  const sameDay = profile.fightDay === day;
  const count = sameDay ? profile.fightsToday : 0;
  const capped = count >= DAILY_REWARDED_FIGHTS;

  let xp = 0;
  let coins = 0;
  if (outcome === "win") {
    xp = capped ? Math.floor(enemy.xp * 0.25) : enemy.xp;
    coins = capped ? 0 : enemy.coins;
  } else if (outcome === "loss") {
    xp = Math.floor(enemy.xp * 0.25);
  }

  await HunterProfile.updateOne(
    { userId, guildId },
    {
      $set: { lastFightAt: new Date(), fightDay: day, fightsToday: count + 1 },
      $inc: { wins: outcome === "win" ? 1 : 0, losses: outcome === "loss" ? 1 : 0 },
    },
  );
  if (coins > 0) await UserProfile.updateOne({ userId, guildId }, { $inc: { coins } }, { upsert: true });
  const grant = xp > 0 ? await grantHunterXp(userId, guildId, xp) : { level: profile.level, leveledUp: false, levelsGained: 0 };
  return { outcome, xp, coins, capped, level: grant.level, leveledUp: grant.leveledUp };
}

/** الانسحاب: ينهي القتال بدون عقوبة ولا مكافأة (إلا الاختبار: الانسحاب = رسوب) */
export async function retreat(userId: string, guildId: string): Promise<boolean> {
  const res = await HunterFight.findOneAndDelete({ userId, guildId });
  if (res && ENEMY_MAP[res.enemyId]?.exam) await failExam(userId, guildId);
  return Boolean(res);
}

/* ───────────── اختبار الصياد ───────────── */

async function failExam(userId: string, guildId: string): Promise<void> {
  await HunterProfile.updateOne({ userId, guildId }, { $set: { examStage: 0, lastExamAt: new Date() } });
}

async function settleExam(
  userId: string,
  guildId: string,
  profile: IHunterProfile,
  enemy: EnemyDef,
  outcome: Exclude<Outcome, "ongoing">,
): Promise<FightEnd> {
  const base = { xp: 0, coins: 0, capped: false, level: profile.level, leveledUp: false, outcome };
  if (outcome !== "win") {
    await failExam(userId, guildId);
    return { ...base, note: `❌ You failed the exam. You can try again in ${Math.round(EXAM_COOLDOWN_MS / 3_600_000)}h.` };
  }
  if (enemy.exam === 2) {
    await HunterProfile.updateOne({ userId, guildId }, { $set: { examStage: 3 } });
    return { ...base, note: "✅ **Stage 2 cleared!** On to the Final Match." };
  }
  await HunterProfile.updateOne({ userId, guildId }, { $set: { examStage: 0, license: true } });
  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: EXAM_REWARD.coins } }, { upsert: true });
  const grant = await grantHunterXp(userId, guildId, EXAM_REWARD.xp);
  return {
    ...base,
    xp: EXAM_REWARD.xp,
    coins: EXAM_REWARD.coins,
    level: grant.level,
    leveledUp: grant.leveledUp,
    note: "🎴 **You passed the Hunter Exam!** You are now a licensed Hunter. Tougher opponents are unlocked.",
  };
}

export type ExamStart =
  | { ok: true; kind: "endurance"; passed: boolean; score: number; need: number }
  | { ok: true; kind: "fight"; fight: IHunterFight; enemy: EnemyDef }
  | { ok: false; reason: "no_hunter" | "licensed" | "level" | "cooldown" | "coins" | "fight"; msLeft?: number };

/** يبدأ أو يكمل الاختبار حسب المرحلة الحالية */
export async function advanceExam(userId: string, guildId: string): Promise<ExamStart> {
  const p = await getHunter(userId, guildId);
  if (!p) return { ok: false, reason: "no_hunter" };
  if (p.license) return { ok: false, reason: "licensed" };

  if (p.examStage === 2 || p.examStage === 3) {
    const r = await startFight(userId, guildId, p.examStage === 2 ? "exam_beast" : "exam_rival");
    if (!r.ok) return r.reason === "cooldown" ? { ok: false, reason: "cooldown", msLeft: r.msLeft } : { ok: false, reason: "fight" };
    return { ok: true, kind: "fight", fight: r.fight, enemy: r.enemy };
  }

  if (p.level < EXAM_MIN_LEVEL) return { ok: false, reason: "level" };
  const last = p.lastExamAt ? new Date(p.lastExamAt).getTime() : 0;
  if (Date.now() - last < EXAM_COOLDOWN_MS) return { ok: false, reason: "cooldown", msLeft: EXAM_COOLDOWN_MS - (Date.now() - last) };

  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: EXAM_FEE } }, { $inc: { coins: -EXAM_FEE } });
  if (!paid) return { ok: false, reason: "coins" };

  // المرحلة 1: سباق التحمل (فحص إحصائيات + حظ)
  const need = 34;
  const score = p.end + p.spd + Math.floor(Math.random() * 16);
  const passed = score >= need;
  await HunterProfile.updateOne(
    { userId, guildId },
    passed ? { $set: { examStage: 2 } } : { $set: { examStage: 0, lastExamAt: new Date() } },
  );
  return { ok: true, kind: "endurance", passed, score, need };
}

export const roundsLeft = (round: number): number => Math.max(0, MAX_ROUNDS - round);
export const canUseNen = (p: IHunterProfile, aura: number): boolean =>
  effectiveAction(playerFighter(p, "You", 1, aura), "nen") === "nen";
