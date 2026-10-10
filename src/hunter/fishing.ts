/** صيد السمكة العملاقة: لعبة توتر الخيط (منطق نقي قابل للاختبار) */

export type FishAction = "pull" | "balance" | "relax";
export type FishMood = "thrash" | "steady" | "tired";

export const FISH_MAX_ROUNDS = 18;
export const FISH_START_TENSION = 10;

export interface FishState {
  tension: number;
  progress: number;
  round: number;
  /** سلوك السمكة المعروض للاعب قبل اختياره */
  mood: FishMood;
}

export type FishOutcome = "ongoing" | "won" | "snapped" | "escaped";

type Rng = () => number;

/** الحركة × سلوك السمكة → [تقدم، توتر] */
const TABLE: Record<FishAction, Record<FishMood, [number, number]>> = {
  pull: { thrash: [8, 38], steady: [16, 22], tired: [22, 14] },
  balance: { thrash: [3, 18], steady: [9, 4], tired: [14, -2] },
  relax: { thrash: [-3, -6], steady: [1, -24], tired: [3, -28] },
};

export function rollMood(rng: Rng): FishMood {
  const r = rng();
  return r < 0.35 ? "thrash" : r < 0.75 ? "steady" : "tired";
}

export function newFishState(rng: Rng = Math.random): FishState {
  return { tension: FISH_START_TENSION, progress: 0, round: 0, mood: rollMood(rng) };
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function stepFishing(s: FishState, action: FishAction, rng: Rng = Math.random): { state: FishState; outcome: FishOutcome } {
  const [dp, dt] = TABLE[action][s.mood];
  const jp = Math.round((rng() - 0.5) * 6);
  const jt = Math.round((rng() - 0.5) * 6);
  const progress = clamp(s.progress + dp + jp);
  const rawTension = s.tension + dt + jt;
  const tension = clamp(rawTension);
  const round = s.round + 1;
  const state: FishState = { tension, progress, round, mood: rollMood(rng) };
  if (rawTension >= 100) return { state, outcome: "snapped" };
  if (progress >= 100) return { state, outcome: "won" };
  if (round >= FISH_MAX_ROUNDS) return { state, outcome: "escaped" };
  return { state, outcome: "ongoing" };
}
