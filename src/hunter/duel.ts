import { HunterDuel, type IHunterDuel } from "../database/models/HunterDuel";
import { HunterProfile, type IHunterProfile } from "../database/models/HunterProfile";
import { UserProfile } from "../database/models/UserProfile";
import { todayKey } from "../quests/time";
import { grantHunterXp, getHunter, playerFighter } from "./service";
import { MAX_ROUNDS, maxAura, maxHp, outcomeOf, resolveRound, type Action } from "./engine";

export const DUEL_MAX_BET = 100_000;
export const DUEL_XP = 40;
export const DUEL_DAILY_REWARDED = 10;
const ACTIONS = ["attack", "guard", "nen", "dodge"];

export type ChallengeResult =
  | { ok: true; duel: IHunterDuel }
  | { ok: false; reason: "self" | "no_hunter_a" | "no_hunter_b" | "busy" | "bet_a" | "bet_b" | "bad_bet" };

const busyFilter = (guildId: string, id: string) => ({ guildId, $or: [{ aId: id }, { bId: id }] });

export async function createChallenge(
  guildId: string,
  channelId: string,
  a: { id: string; name: string },
  b: { id: string; name: string },
  bet: number,
): Promise<ChallengeResult> {
  if (a.id === b.id) return { ok: false, reason: "self" };
  if (!Number.isInteger(bet) || bet < 0 || bet > DUEL_MAX_BET) return { ok: false, reason: "bad_bet" };
  const [pa, pb] = await Promise.all([getHunter(a.id, guildId), getHunter(b.id, guildId)]);
  if (!pa) return { ok: false, reason: "no_hunter_a" };
  if (!pb) return { ok: false, reason: "no_hunter_b" };
  if ((await HunterDuel.exists(busyFilter(guildId, a.id))) || (await HunterDuel.exists(busyFilter(guildId, b.id)))) {
    return { ok: false, reason: "busy" };
  }
  if (bet > 0) {
    const [ua, ub] = await Promise.all([
      UserProfile.findOne({ userId: a.id, guildId }, { coins: 1 }),
      UserProfile.findOne({ userId: b.id, guildId }, { coins: 1 }),
    ]);
    if ((ua?.coins ?? 0) < bet) return { ok: false, reason: "bet_a" };
    if ((ub?.coins ?? 0) < bet) return { ok: false, reason: "bet_b" };
  }
  const duel = await HunterDuel.create({
    guildId,
    channelId,
    aId: a.id,
    bId: b.id,
    aName: a.name,
    bName: b.name,
    bet,
    status: "pending",
    aHp: maxHp(pa.end),
    aAura: maxAura(pa.aura),
    bHp: maxHp(pb.end),
    bAura: maxAura(pb.aura),
  });
  return { ok: true, duel };
}

export async function acceptDuel(duelId: string, userId: string): Promise<IHunterDuel | null> {
  return HunterDuel.findOneAndUpdate(
    { _id: duelId, bId: userId, status: "pending" },
    { $set: { status: "active", updatedAt: new Date() } },
    { new: true },
  );
}

export async function declineDuel(duelId: string, userId: string): Promise<IHunterDuel | null> {
  return HunterDuel.findOneAndDelete({ _id: duelId, status: "pending", $or: [{ aId: userId }, { bId: userId }] });
}

export interface DuelEnd {
  winnerId: string | null;
  loserId: string | null;
  draw: boolean;
  bet: number;
  xp: number;
  capped: boolean;
  forfeit?: boolean;
}

export type DuelStep =
  | { status: "stale" }
  | { status: "waiting" }
  | { status: "ongoing"; duel: IHunterDuel; log: string[] }
  | { status: "ended"; duel: IHunterDuel; log: string[]; end: DuelEnd };

export async function duelChoose(duelId: string, userId: string, action: string, roundSeen: number): Promise<DuelStep> {
  if (!ACTIONS.includes(action)) return { status: "stale" };
  const d0 = await HunterDuel.findById(duelId);
  if (!d0 || d0.status !== "active" || d0.round !== roundSeen) return { status: "stale" };
  const isA = d0.aId === userId;
  if (!isA && d0.bId !== userId) return { status: "stale" };
  const field = isA ? "aChoice" : "bChoice";

  const d1 = await HunterDuel.findOneAndUpdate(
    { _id: duelId, round: roundSeen, status: "active", [field]: null },
    { $set: { [field]: action, updatedAt: new Date() } },
    { new: true },
  );
  if (!d1) return { status: "stale" }; // اختار قبل
  if (!d1.aChoice || !d1.bChoice) return { status: "waiting" };

  const [pa, pb] = await Promise.all([getHunter(d1.aId, d1.guildId), getHunter(d1.bId, d1.guildId)]);
  if (!pa || !pb) {
    await HunterDuel.deleteOne({ _id: duelId });
    return { status: "stale" };
  }
  const fa = playerFighter(pa, d1.aName, d1.aHp, d1.aAura);
  const fb = playerFighter(pb, d1.bName, d1.bHp, d1.bAura);
  const { log } = resolveRound(fa, fb, d1.aChoice as Action, d1.bChoice as Action);
  const round = roundSeen + 1;
  const outcome = outcomeOf(fa, fb, round);

  if (outcome === "ongoing") {
    const updated = await HunterDuel.findOneAndUpdate(
      { _id: duelId, round: roundSeen, aChoice: { $ne: null }, bChoice: { $ne: null } },
      { $set: { aHp: fa.hp, aAura: fa.aura, bHp: fb.hp, bAura: fb.aura, round, aChoice: null, bChoice: null, lastLog: log, updatedAt: new Date() } },
      { new: true },
    );
    if (!updated) return { status: "stale" };
    return { status: "ongoing", duel: updated, log };
  }

  const removed = await HunterDuel.findOneAndDelete({ _id: duelId, round: roundSeen, aChoice: { $ne: null }, bChoice: { $ne: null } });
  if (!removed) return { status: "stale" };
  const end = await settleDuel(removed, outcome === "win" ? d1.aId : outcome === "loss" ? d1.bId : null);
  return { status: "ended", duel: { ...removed.toObject(), aHp: fa.hp, bHp: fb.hp } as IHunterDuel, log, end };
}

export async function duelForfeit(duelId: string, userId: string): Promise<DuelStep> {
  const d = await HunterDuel.findOneAndDelete({ _id: duelId, status: "active", $or: [{ aId: userId }, { bId: userId }] });
  if (!d) return { status: "stale" };
  const winner = d.aId === userId ? d.bId : d.aId;
  const end = await settleDuel(d, winner);
  return { status: "ended", duel: d, log: [`🏳️ <@${userId}> forfeited the duel.`], end: { ...end, forfeit: true } };
}

async function takeCoins(userId: string, guildId: string, want: number): Promise<number> {
  if (want <= 0) return 0;
  const u = await UserProfile.findOne({ userId, guildId }, { coins: 1 });
  const amt = Math.min(want, Math.max(0, u?.coins ?? 0));
  if (amt <= 0) return 0;
  const ok = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: amt } }, { $inc: { coins: -amt } });
  return ok ? amt : 0;
}

async function settleDuel(d: IHunterDuel, winnerId: string | null): Promise<DuelEnd> {
  if (!winnerId) return { winnerId: null, loserId: null, draw: true, bet: 0, xp: 0, capped: false };
  const loserId = winnerId === d.aId ? d.bId : d.aId;
  const taken = await takeCoins(loserId, d.guildId, d.bet);
  if (taken > 0) await UserProfile.updateOne({ userId: winnerId, guildId: d.guildId }, { $inc: { coins: taken } }, { upsert: true });

  const day = todayKey();
  const w = (await getHunter(winnerId, d.guildId)) as IHunterProfile | null;
  const count = w && w.pvpDay === day ? w.pvpToday : 0;
  const capped = count >= DUEL_DAILY_REWARDED;
  await HunterProfile.updateOne({ userId: winnerId, guildId: d.guildId }, { $set: { pvpDay: day, pvpToday: count + 1 }, $inc: { wins: 1 } });
  await HunterProfile.updateOne({ userId: loserId, guildId: d.guildId }, { $inc: { losses: 1 } });
  const xp = capped ? 0 : DUEL_XP;
  if (xp > 0) await grantHunterXp(winnerId, d.guildId, xp);
  return { winnerId, loserId, draw: false, bet: taken, xp, capped };
}

export const duelRoundsLeft = (round: number) => Math.max(0, MAX_ROUNDS - round);
