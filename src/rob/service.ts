import { ROB } from "../bank/service";
import { ThiefState } from "../database/models/ThiefState";
import { UserProfile } from "../database/models/UserProfile";
import { getProfile } from "../services/economy";
import { logTransaction } from "../services/transactions";

export type Outcome = "loot" | "trap" | "empty";

/** التعويض اللي يدفعه الناهب للضحية لو اختار الفخ */
export const TRAP_FEE = 50;

export type StartResult =
  | { ok: true }
  | { ok: false; reason: "self" }
  | { ok: false; reason: "cooldown"; msLeft: number }
  | { ok: false; reason: "robber_too_poor" }
  | { ok: false; reason: "victim_immune"; until: number }
  | { ok: false; reason: "victim_too_poor" };

/** يتحقق من شروط النهب ويبدأ العدّاد (الكولداون يبدأ من بداية اللعبة) */
export async function startRob(robberId: string, victimId: string, guildId: string): Promise<StartResult> {
  if (robberId === victimId) return { ok: false, reason: "self" };

  const now = Date.now();
  const robber = await getProfile(robberId, guildId);
  if (robber.lastRobAt) {
    const msLeft = ROB.cooldownMs - (now - robber.lastRobAt.getTime());
    if (msLeft > 0) return { ok: false, reason: "cooldown", msLeft };
  }
  if (robber.coins < ROB.minRobberWallet) return { ok: false, reason: "robber_too_poor" };

  const victim = await getProfile(victimId, guildId);
  if (victim.robImmuneUntil && victim.robImmuneUntil.getTime() > now) {
    return { ok: false, reason: "victim_immune", until: victim.robImmuneUntil.getTime() };
  }
  if (victim.coins < ROB.minVictimWallet) return { ok: false, reason: "victim_too_poor" };

  await UserProfile.updateOne({ userId: robberId, guildId }, { $set: { lastRobAt: new Date(now) } });
  return { ok: true };
}

export type ResolveResult =
  | { outcome: "loot"; amount: number; coins: number }
  | { outcome: "trap"; fee: number; coins: number }
  | { outcome: "empty"; coins: number };

/** يطبّق نتيجة الخيار اللي اختاره الناهب (كله بعمليات ذرية) */
export async function resolveRob(
  robberId: string,
  victimId: string,
  guildId: string,
  outcome: Outcome,
): Promise<ResolveResult> {
  if (outcome === "loot") {
    const victim = await getProfile(victimId, guildId);
    const amount = Math.max(1, Math.floor(victim.coins * (Math.random() * ROB.maxStealPercent)));
    const immuneUntil = new Date(Date.now() + ROB.victimImmunityHours * 60 * 60 * 1000);

    const took = await UserProfile.findOneAndUpdate(
      { userId: victimId, guildId, coins: { $gte: amount } },
      { $inc: { coins: -amount }, $set: { robImmuneUntil: immuneUntil } },
    );
    if (took) {
      const robber = await UserProfile.findOneAndUpdate(
        { userId: robberId, guildId },
        { $inc: { coins: amount } },
        { new: true },
      );
      // يُحسب في قائمة أشهر الحرامية (!توب)
      await ThiefState.updateOne({ userId: robberId, guildId }, { $inc: { total: amount } }, { upsert: true }).catch(() => undefined);
      await logTransaction(guildId, robberId, "rob_gain", amount, victimId);
      await logTransaction(guildId, victimId, "rob_loss", amount, robberId);
      return { outcome: "loot", amount, coins: robber?.coins ?? 0 };
    }
    // الضحية صرفت فلوسها قبل لحظة: نعتبرها فارغة
    const me = await getProfile(robberId, guildId);
    return { outcome: "empty", coins: me.coins };
  }

  if (outcome === "trap") {
    const me = await getProfile(robberId, guildId);
    const fee = Math.min(TRAP_FEE, me.coins);
    if (fee > 0) {
      const paid = await UserProfile.findOneAndUpdate(
        { userId: robberId, guildId, coins: { $gte: fee } },
        { $inc: { coins: -fee } },
        { new: true },
      );
      if (paid) {
        await UserProfile.updateOne({ userId: victimId, guildId }, { $inc: { coins: fee } }, { upsert: true });
        await logTransaction(guildId, robberId, "rob_fine", fee, victimId);
        await logTransaction(guildId, victimId, "pay_received", fee, robberId);
        return { outcome: "trap", fee, coins: paid.coins };
      }
    }
    return { outcome: "trap", fee: 0, coins: me.coins };
  }

  const me = await getProfile(robberId, guildId);
  return { outcome: "empty", coins: me.coins };
}
