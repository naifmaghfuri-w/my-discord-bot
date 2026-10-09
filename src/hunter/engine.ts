import { affinity, type NenType, type Personality, type Stats } from "./data";

export type Action = "attack" | "guard" | "nen" | "dodge";

export const NEN_COST = 30;
export const AURA_REGEN = 8;
export const GUARD_AURA_BONUS = 6;
export const MAX_ROUNDS = 15;

export const maxHp = (end: number): number => 70 + end * 3;
export const maxAura = (aura: number): number => 40 + aura * 2;

export interface Fighter {
  name: string;
  nen: NenType | null;
  stats: Stats;
  hp: number;
  aura: number;
}

export type Rng = () => number;

const jitter = (rng: Rng, spread: number) => 1 - spread + rng() * spread * 2;

export function dodgeChance(defSpd: number, attSpd: number): number {
  return Math.min(0.75, Math.max(0.1, 0.25 + (defSpd - attSpd) * 0.02));
}

function canNen(f: Fighter): boolean {
  return f.nen !== null && f.stats.aura > 0 && f.aura >= NEN_COST;
}

/** لو اللاعب طلب Nen وما عنده أورا يكفي، يتحول لهجوم عادي */
export function effectiveAction(f: Fighter, a: Action): Action {
  return a === "nen" && !canNen(f) ? "attack" : a;
}

/** اختيار حركة الخصم حسب شخصيته وحالته */
export function chooseEnemyAction(e: Fighter, personality: Personality, rng: Rng): Action {
  const w: Record<Action, number> = {
    brute: { attack: 0.6, guard: 0.15, dodge: 0.1, nen: 0.15 },
    trickster: { attack: 0.3, guard: 0.1, dodge: 0.3, nen: 0.3 },
    wild: { attack: 0.7, guard: 0.1, dodge: 0.2, nen: 0 },
    tank: { attack: 0.35, guard: 0.35, dodge: 0.1, nen: 0.2 },
  }[personality] as Record<Action, number>;
  const weights = { ...w };
  if (!canNen(e)) weights.nen = 0;
  const hpRatio = e.hp / maxHp(e.stats.end);
  if (hpRatio < 0.3) {
    weights.guard += 0.15;
    weights.dodge += 0.1;
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (const [action, weight] of Object.entries(weights) as [Action, number][]) {
    roll -= weight;
    if (roll <= 0) return action;
  }
  return "attack";
}

interface Hit {
  damage: number;
  text: string;
  /** ضرر مرتد على المهاجم لو الخصم تفادى */
  counter: number;
}

function strike(att: Fighter, def: Fighter, act: Action, defAct: Action, rng: Rng): Hit {
  if (act !== "attack" && act !== "nen") return { damage: 0, text: "", counter: 0 };

  let raw: number;
  let verb: string;
  if (act === "nen") {
    const aff = affinity(att.nen, def.nen);
    raw = (att.stats.aura + att.stats.str * 0.4) * aff * jitter(rng, 0.1);
    verb = aff > 1 ? "unleashes a **super-effective Nen** attack" : aff < 1 ? "unleashes a resisted Nen attack" : "unleashes a Nen attack";
  } else {
    raw = att.stats.str * jitter(rng, 0.15);
    verb = "strikes";
  }

  if (defAct === "dodge" && rng() < dodgeChance(def.stats.spd, att.stats.spd)) {
    return { damage: 0, counter: Math.round(def.stats.str * 0.4), text: `${att.name} ${verb}, but ${def.name} **dodges** and counters!` };
  }
  if (defAct === "guard") raw *= 0.5;

  const damage = Math.max(1, Math.round(raw - def.stats.end * 0.2));
  const suffix = defAct === "guard" ? " (guarded)" : defAct === "dodge" ? " (dodge failed)" : "";
  return { damage, counter: 0, text: `${att.name} ${verb} for **${damage}**${suffix}.` };
}

export interface RoundOutcome {
  log: string[];
  playerAction: Action;
  enemyAction: Action;
}

/** يحسم جولة كاملة (حركتان متزامنتان) ويعدّل المقاتلين مباشرة */
export function resolveRound(p: Fighter, e: Fighter, pAct: Action, eAct: Action, rng: Rng = Math.random): RoundOutcome {
  const pa = effectiveAction(p, pAct);
  const ea = effectiveAction(e, eAct);

  if (pa === "nen") p.aura -= NEN_COST;
  if (ea === "nen") e.aura -= NEN_COST;

  const hitOnEnemy = strike(p, e, pa, ea, rng);
  const hitOnPlayer = strike(e, p, ea, pa, rng);

  e.hp -= hitOnEnemy.damage + hitOnPlayer.counter;
  p.hp -= hitOnPlayer.damage + hitOnEnemy.counter;

  const log: string[] = [];
  const stance = (f: Fighter, a: Action) => {
    if (a === "guard") log.push(`🛡️ ${f.name} braces for impact.`);
    if (a === "dodge") log.push(`💨 ${f.name} prepares to evade.`);
  };
  stance(p, pa);
  stance(e, ea);
  if (hitOnEnemy.text) log.push(hitOnEnemy.text);
  if (hitOnPlayer.text) log.push(hitOnPlayer.text);

  p.hp = Math.max(0, p.hp);
  e.hp = Math.max(0, e.hp);

  const regen = (f: Fighter, a: Action) => {
    f.aura = Math.min(maxAura(f.stats.aura), f.aura + AURA_REGEN + (a === "guard" ? GUARD_AURA_BONUS : 0));
  };
  regen(p, pa);
  regen(e, ea);

  return { log, playerAction: pa, enemyAction: ea };
}

export type Outcome = "ongoing" | "win" | "loss" | "draw";

export function outcomeOf(p: Fighter, e: Fighter, round: number): Outcome {
  const pDead = p.hp <= 0;
  const eDead = e.hp <= 0;
  if (pDead && eDead) return p.hp === e.hp ? "draw" : "draw";
  if (eDead) return "win";
  if (pDead) return "loss";
  if (round >= MAX_ROUNDS) {
    const pr = p.hp / maxHp(p.stats.end);
    const er = e.hp / maxHp(e.stats.end);
    return pr > er ? "win" : pr < er ? "loss" : "draw";
  }
  return "ongoing";
}
