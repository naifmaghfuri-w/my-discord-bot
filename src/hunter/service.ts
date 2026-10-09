import { HunterFight, type IHunterFight } from "../database/models/HunterFight";
import { HunterProfile, type IHunterProfile } from "../database/models/HunterProfile";
import { UserProfile } from "../database/models/UserProfile";
import { todayKey } from "../quests/time";
import {
  CHAPTERS,
  CHAR_MAP,
  ENEMY_MAP,
  UPG_KEYS,
  UPG_MAX,
  charStats,
  upgCost,
  xpNeeded,
  type Chapter,
  type EnemyDef,
  type Lang,
  type UpgKey,
} from "./data";
import {
  chooseEnemyAction,
  maxAura,
  maxHp,
  outcomeOf,
  resolveRound,
  type Action,
  type Fighter,
  type Outcome,
} from "./engine";

export const FIGHT_COOLDOWN_MS = 15_000;
export const DAILY_REWARDED_FIGHTS = 20;

export const getHunter = (userId: string, guildId: string) => HunterProfile.findOne({ userId, guildId });

/** ينشئ ملف الصياد أول مرة (بدون شخصيات؛ تنفتح من القصة) */
export async function ensureHunter(userId: string, guildId: string): Promise<IHunterProfile> {
  const doc = await HunterProfile.findOneAndUpdate(
    { userId, guildId },
    { $setOnInsert: { userId, guildId, nen: "enhancer", level: 1, xp: 0 } },
    { upsert: true, new: true },
  );
  if (!doc) throw new Error("Failed to create hunter");
  return doc;
}

export const langOf = (p: IHunterProfile | null | undefined): Lang => (p?.lang === "ar" ? "ar" : "en");

export async function setLang(userId: string, guildId: string, lang: Lang): Promise<void> {
  await HunterProfile.updateOne({ userId, guildId }, { $set: { lang } });
}

/* ───────────── الشخصيات ───────────── */

export const upgOf = (p: IHunterProfile, charId: string) => (p.upg?.[charId] ?? {}) as Partial<Record<UpgKey, number>>;

/** الشخصية النشطة (أو أول شخصية مملوكة) */
export function activeCharId(p: IHunterProfile): string | null {
  if (p.active && p.chars.includes(p.active)) return p.active;
  return p.chars[0] ?? null;
}

export function fighterFor(p: IHunterProfile, charId: string, name: string, hp?: number, aura?: number): Fighter {
  const c = CHAR_MAP[charId];
  const s = charStats(c, p.level, upgOf(p, charId));
  return { name, nen: c.nen, stats: s, hp: hp ?? maxHp(s.end), aura: aura ?? maxAura(s.aura) };
}

export function enemyFighter(e: EnemyDef, hp?: number, aura?: number): Fighter {
  return { name: e.name, nen: e.nen, stats: e.stats, hp: hp ?? maxHp(e.stats.end), aura: aura ?? maxAura(e.stats.aura) };
}

export async function setActive(userId: string, guildId: string, charId: string): Promise<boolean> {
  const r = await HunterProfile.updateOne({ userId, guildId, chars: charId }, { $set: { active: charId } });
  return r.matchedCount > 0;
}

export async function unlockChar(userId: string, guildId: string, charId: string): Promise<boolean> {
  const r = await HunterProfile.updateOne({ userId, guildId, chars: { $ne: charId } }, { $addToSet: { chars: charId } });
  if (r.modifiedCount > 0) {
    await HunterProfile.updateOne({ userId, guildId, active: "" }, { $set: { active: charId } });
    return true;
  }
  return false;
}

export type BuyResult = { ok: true } | { ok: false; reason: "owned" | "coins" | "unavailable"; price?: number };

export async function buyChar(userId: string, guildId: string, charId: string): Promise<BuyResult> {
  const c = CHAR_MAP[charId];
  if (!c || c.unlock.type !== "shop") return { ok: false, reason: "unavailable" };
  const price = c.unlock.price;
  const p = await getHunter(userId, guildId);
  if (!p) return { ok: false, reason: "unavailable" };
  if (p.chars.includes(charId)) return { ok: false, reason: "owned" };
  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: price } }, { $inc: { coins: -price } });
  if (!paid) return { ok: false, reason: "coins", price };
  const got = await unlockChar(userId, guildId, charId);
  if (!got) {
    await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: price } });
    return { ok: false, reason: "owned" };
  }
  return { ok: true };
}

export type UpgradeResult = { ok: true; level: number } | { ok: false; reason: "max" | "coins" | "fail"; cost?: number };

export async function upgradeChar(userId: string, guildId: string, charId: string, key: UpgKey): Promise<UpgradeResult> {
  if (!UPG_KEYS.includes(key)) return { ok: false, reason: "fail" };
  const p = await getHunter(userId, guildId);
  if (!p || !p.chars.includes(charId)) return { ok: false, reason: "fail" };
  const cur = upgOf(p, charId)[key] ?? 0;
  if (cur >= UPG_MAX) return { ok: false, reason: "max" };
  const cost = upgCost(cur);
  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: cost } }, { $inc: { coins: -cost } });
  if (!paid) return { ok: false, reason: "coins", cost };
  const field = `upg.${charId}.${key}`;
  const filter = cur === 0 ? { $or: [{ [field]: { $exists: false } }, { [field]: 0 }] } : { [field]: cur };
  const r = await HunterProfile.updateOne({ userId, guildId, ...filter }, { $inc: { [field]: 1 } });
  if (r.modifiedCount === 0) {
    await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: cost } });
    return { ok: false, reason: "fail" };
  }
  return { ok: true, level: cur + 1 };
}

/* ───────────── الخبرة ───────────── */

export interface GrantResult {
  level: number;
  leveledUp: boolean;
}

export async function grantHunterXp(userId: string, guildId: string, xp: number): Promise<GrantResult> {
  const doc = await HunterProfile.findOneAndUpdate({ userId, guildId }, { $inc: { xp } }, { new: true });
  if (!doc) return { level: 1, leveledUp: false };
  let level = doc.level;
  let left = doc.xp;
  let gained = 0;
  while (left >= xpNeeded(level)) {
    left -= xpNeeded(level);
    level++;
    gained++;
  }
  if (gained > 0) await HunterProfile.updateOne({ userId, guildId }, { $set: { level, xp: left } });
  return { level, leveledUp: gained > 0 };
}

/* ───────────── القتال ضد البوتات + القصة ───────────── */

export type StartResult =
  | { ok: true; fight: IHunterFight; enemy: EnemyDef; charId: string }
  | { ok: false; reason: "no_hunter" | "no_char" | "unknown" | "locked" | "cooldown"; msLeft?: number; minLevel?: number; license?: boolean };

async function beginFight(p: IHunterProfile, enemy: EnemyDef, charId: string, story: number): Promise<IHunterFight> {
  const me = fighterFor(p, charId, "You");
  const foe = enemyFighter(enemy);
  const fight = await HunterFight.findOneAndUpdate(
    { userId: p.userId, guildId: p.guildId },
    { $set: { enemyId: enemy.id, charId, story, hp: me.hp, aura: me.aura, eHp: foe.hp, eAura: foe.aura, round: 0, lastLog: [], updatedAt: new Date() } },
    { upsert: true, new: true },
  );
  if (!fight) throw new Error("Failed to start fight");
  return fight;
}

function cooldownLeft(p: IHunterProfile): number {
  const last = p.lastFightAt ? new Date(p.lastFightAt).getTime() : 0;
  return Math.max(0, FIGHT_COOLDOWN_MS - (Date.now() - last));
}

export async function startFight(userId: string, guildId: string, enemyId: string): Promise<StartResult> {
  const p = await getHunter(userId, guildId);
  if (!p) return { ok: false, reason: "no_hunter" };
  const charId = activeCharId(p);
  if (!charId) return { ok: false, reason: "no_char" };
  const enemy = ENEMY_MAP[enemyId];
  if (!enemy || enemy.exam) return { ok: false, reason: "unknown" };
  if (enemy.needsLicense && !p.license) return { ok: false, reason: "locked", minLevel: enemy.minLevel, license: true };
  if (p.level < enemy.minLevel) return { ok: false, reason: "locked", minLevel: enemy.minLevel };
  const wait = cooldownLeft(p);
  if (wait > 0) return { ok: false, reason: "cooldown", msLeft: wait };
  const fight = await beginFight(p, enemy, charId, 0);
  return { ok: true, fight, enemy, charId };
}

export async function startStory(userId: string, guildId: string, chapterId: number): Promise<StartResult> {
  const p = await getHunter(userId, guildId);
  if (!p) return { ok: false, reason: "no_hunter" };
  const ch = CHAPTERS.find((c) => c.id === chapterId);
  if (!ch || chapterId !== p.story + 1) return { ok: false, reason: "unknown" };
  const enemy = ENEMY_MAP[ch.enemyId];
  if (p.level < ch.minLevel) return { ok: false, reason: "locked", minLevel: ch.minLevel };
  const wait = cooldownLeft(p);
  if (wait > 0) return { ok: false, reason: "cooldown", msLeft: wait };
  // الفصل الأول: غون يقاتل حتى لو ما عندك شخصية بعد
  const charId = activeCharId(p) ?? "gon";
  const fight = await beginFight(p, enemy, charId, chapterId);
  return { ok: true, fight, enemy, charId };
}

export interface FightEnd {
  outcome: Exclude<Outcome, "ongoing">;
  xp: number;
  coins: number;
  capped: boolean;
  level: number;
  leveledUp: boolean;
  /** نتائج القصة */
  chapter?: Chapter;
  cleared?: boolean;
  unlocked?: string;
  license?: boolean;
}

export type RoundResult =
  | { status: "stale" }
  | { status: "ongoing"; fight: IHunterFight; enemy: EnemyDef; log: string[] }
  | { status: "ended"; enemy: EnemyDef; charId: string; log: string[]; end: FightEnd };

export async function playRound(userId: string, guildId: string, action: Action, roundSeen: number): Promise<RoundResult> {
  const [fight, p] = await Promise.all([HunterFight.findOne({ userId, guildId }), getHunter(userId, guildId)]);
  if (!fight || !p || fight.round !== roundSeen || !CHAR_MAP[fight.charId]) return { status: "stale" };
  const enemy = ENEMY_MAP[fight.enemyId];
  if (!enemy) return { status: "stale" };

  const me = fighterFor(p, fight.charId, "You", fight.hp, fight.aura);
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

  // حذف ذرّي: يمنع الجائزة المزدوجة
  const removed = await HunterFight.findOneAndDelete({ userId, guildId, round: roundSeen });
  if (!removed) return { status: "stale" };
  const end = fight.story > 0 ? await settleStory(p, fight.story, outcome) : await settleFight(p, enemy, outcome);
  return { status: "ended", enemy, charId: fight.charId, log, end };
}

async function settleFight(p: IHunterProfile, enemy: EnemyDef, outcome: Exclude<Outcome, "ongoing">): Promise<FightEnd> {
  const { userId, guildId } = p;
  const day = todayKey();
  const count = p.fightDay === day ? p.fightsToday : 0;
  const capped = count >= DAILY_REWARDED_FIGHTS;
  let xp = 0;
  let coins = 0;
  if (outcome === "win") {
    xp = capped ? Math.floor(enemy.xp * 0.25) : enemy.xp;
    coins = capped ? 0 : enemy.coins;
  } else if (outcome === "loss") xp = Math.floor(enemy.xp * 0.25);

  await HunterProfile.updateOne(
    { userId, guildId },
    { $set: { lastFightAt: new Date(), fightDay: day, fightsToday: count + 1 }, $inc: { wins: outcome === "win" ? 1 : 0, losses: outcome === "loss" ? 1 : 0 } },
  );
  if (coins > 0) await UserProfile.updateOne({ userId, guildId }, { $inc: { coins } }, { upsert: true });
  const g = xp > 0 ? await grantHunterXp(userId, guildId, xp) : { level: p.level, leveledUp: false };
  return { outcome, xp, coins, capped, level: g.level, leveledUp: g.leveledUp };
}

async function settleStory(p: IHunterProfile, chapterId: number, outcome: Exclude<Outcome, "ongoing">): Promise<FightEnd> {
  const { userId, guildId } = p;
  const ch = CHAPTERS.find((c) => c.id === chapterId)!;
  const base: FightEnd = { outcome, xp: 0, coins: 0, capped: false, level: p.level, leveledUp: false, chapter: ch };
  await HunterProfile.updateOne({ userId, guildId }, { $set: { lastFightAt: new Date() }, $inc: { wins: outcome === "win" ? 1 : 0, losses: outcome === "loss" ? 1 : 0 } });
  if (outcome !== "win") return base;

  // التقدم ذرّي: المكافأة تُعطى مرة واحدة فقط
  const adv = await HunterProfile.updateOne(
    { userId, guildId, story: chapterId - 1 },
    { $set: { story: chapterId, ...(ch.license ? { license: true } : {}) } },
  );
  if (adv.modifiedCount === 0) return base;
  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: ch.coins } }, { upsert: true });
  const g = await grantHunterXp(userId, guildId, ch.xp);
  let unlocked: string | undefined;
  if (ch.unlock && (await unlockChar(userId, guildId, ch.unlock))) unlocked = ch.unlock;
  return { ...base, xp: ch.xp, coins: ch.coins, level: g.level, leveledUp: g.leveledUp, cleared: true, unlocked, license: ch.license };
}

/** الانسحاب: بدون عقوبة ولا مكافأة */
export async function retreat(userId: string, guildId: string): Promise<boolean> {
  return Boolean(await HunterFight.findOneAndDelete({ userId, guildId }));
}
