import { JobProfile, type IJobProfile } from "../database/models/JobProfile";
import { LabProfile } from "../database/models/LabProfile";
import { UserProfile } from "../database/models/UserProfile";
import { getProfile } from "../services/economy";
import { logTransaction } from "../services/transactions";
import { JOB_MAP, JOB_RULES, type JobDef, type JobReq } from "./data";

/** يجلب ملف الوظيفة، وينفصل الموظف تلقائياً لو ما داوم أسبوع */
export async function getJob(userId: string, guildId: string): Promise<IJobProfile> {
  let doc = await JobProfile.findOneAndUpdate({ userId, guildId }, { $setOnInsert: { userId, guildId } }, { upsert: true, new: true });
  if (!doc) throw new Error("Failed to load job profile");

  if (doc.jobId) {
    const last = doc.lastActiveAt ? new Date(doc.lastActiveAt).getTime() : 0;
    const onShift = Boolean(doc.shiftStartedAt);
    if (!onShift && Date.now() - last > JOB_RULES.inactiveFireMs) {
      const job = JOB_MAP[doc.jobId];
      const fired = await JobProfile.findOneAndUpdate(
        { userId, guildId, jobId: doc.jobId },
        {
          $set: {
            jobId: "", rank: 0, shifts: 0, lastShiftAt: null, shiftStartedAt: null,
            blockedUntil: new Date(Date.now() + JOB_RULES.reapplyCooldownMs),
            notice: `📉 تم فصلك من وظيفة **${job?.name ?? "عملك"}** لأنك ما داومت أكثر من أسبوع.`,
          },
        },
        { new: true },
      );
      if (fired) doc = fired;
    }
  }
  return doc;
}

/** يمسح رسالة الإشعار بعد عرضها */
export async function clearNotice(userId: string, guildId: string): Promise<void> {
  await JobProfile.updateOne({ userId, guildId }, { $set: { notice: "" } });
}

export interface JobContext {
  level: number;
  labLevel: number;
  labDiscoveries: number;
  hasBank: boolean;
  coins: number;
}

export async function loadContext(userId: string, guildId: string): Promise<JobContext> {
  const [profile, lab] = await Promise.all([getProfile(userId, guildId), LabProfile.findOne({ userId, guildId }, { labLevel: 1, discovered: 1 })]);
  return {
    level: profile.level ?? 1,
    labLevel: lab?.labLevel ?? 0,
    labDiscoveries: lab?.discovered?.length ?? 0,
    hasBank: Boolean(profile.accountNumber),
    coins: profile.coins ?? 0,
  };
}

/** الشروط الناقصة (قائمة نصوص، فاضية = مؤهّل) */
export function missingReqs(req: JobReq, ctx: JobContext): string[] {
  const out: string[] = [];
  if (req.level && ctx.level < req.level) out.push(`مستوى ${req.level}`);
  if (req.labLevel && ctx.labLevel < req.labLevel) out.push(`مستوى مختبر ${req.labLevel}`);
  if (req.bank && !ctx.hasBank) out.push("حساب بنكي");
  return out;
}

export type ApplyResult =
  | { ok: true; job: JobDef }
  | { ok: false; reason: "has_job" | "blocked" | "unknown" | "reqs" | "coins" | "race"; msLeft?: number; missing?: string[] };

export async function applyForJob(userId: string, guildId: string, jobId: string): Promise<ApplyResult> {
  const job = JOB_MAP[jobId];
  if (!job) return { ok: false, reason: "unknown" };
  const jp = await getJob(userId, guildId);
  if (jp.jobId) return { ok: false, reason: "has_job" };
  const blocked = jp.blockedUntil ? new Date(jp.blockedUntil).getTime() - Date.now() : 0;
  if (blocked > 0) return { ok: false, reason: "blocked", msLeft: blocked };
  const ctx = await loadContext(userId, guildId);
  const missing = missingReqs(job.req, ctx);
  if (missing.length) return { ok: false, reason: "reqs", missing };

  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: JOB_RULES.applyFee } }, { $inc: { coins: -JOB_RULES.applyFee } });
  if (!paid) return { ok: false, reason: "coins" };

  const hired = await JobProfile.findOneAndUpdate(
    { userId, guildId, jobId: "" },
    { $set: { jobId, rank: 0, shifts: 0, lastShiftAt: null, shiftStartedAt: null, lastActiveAt: new Date(), notice: "" } },
    { new: true },
  );
  if (!hired) {
    await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: JOB_RULES.applyFee } });
    return { ok: false, reason: "race" };
  }
  await logTransaction(guildId, userId, "job_fee", JOB_RULES.applyFee);
  return { ok: true, job };
}

export async function resign(userId: string, guildId: string): Promise<boolean> {
  const r = await JobProfile.updateOne(
    { userId, guildId, jobId: { $ne: "" } },
    { $set: { jobId: "", rank: 0, shifts: 0, lastShiftAt: null, shiftStartedAt: null, blockedUntil: new Date(Date.now() + JOB_RULES.reapplyCooldownMs) } },
  );
  return r.modifiedCount > 0;
}

export type WorkResult =
  | { ok: false; reason: "no_job" }
  | { ok: false; reason: "cooldown"; msLeft: number }
  | { ok: false; reason: "on_shift"; msLeft: number }
  | { ok: true; kind: "shift"; pay: number; shifts: number; rankTitle: string; promoReady: boolean }
  | { ok: true; kind: "started"; endsAt: Date }
  | { ok: true; kind: "claimed"; pay: number; accident: boolean };

async function payOut(userId: string, guildId: string, amount: number): Promise<void> {
  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: amount } }, { upsert: true });
  await logTransaction(guildId, userId, "salary", amount);
}

export function nextRankOf(jp: IJobProfile) {
  const job = JOB_MAP[jp.jobId];
  return job ? job.ranks[jp.rank + 1] ?? null : null;
}

/** دوام: وظيفة مهنية = راتب فوري، دوام كامل = يبدأ ثم يُستلم بعد 24 ساعة */
export async function work(userId: string, guildId: string): Promise<WorkResult> {
  const jp = await getJob(userId, guildId);
  const job = JOB_MAP[jp.jobId];
  if (!job) return { ok: false, reason: "no_job" };
  const now = Date.now();

  if (job.kind === "career") {
    const cutoff = new Date(now - JOB_RULES.shiftCooldownMs);
    const updated = await JobProfile.findOneAndUpdate(
      { userId, guildId, jobId: job.id, $or: [{ lastShiftAt: null }, { lastShiftAt: { $lte: cutoff } }] },
      { $set: { lastShiftAt: new Date(now), lastActiveAt: new Date(now) }, $inc: { shifts: 1 } },
      { new: true },
    );
    if (!updated) {
      const last = jp.lastShiftAt ? new Date(jp.lastShiftAt).getTime() : 0;
      return { ok: false, reason: "cooldown", msLeft: Math.max(0, JOB_RULES.shiftCooldownMs - (now - last)) };
    }
    const rank = job.ranks[updated.rank] ?? job.ranks[0];
    await payOut(userId, guildId, rank.pay);
    const next = job.ranks[updated.rank + 1];
    const promoReady = Boolean(next) && updated.shifts >= next.shiftsNeeded;
    return { ok: true, kind: "shift", pay: rank.pay, shifts: updated.shifts, rankTitle: rank.title, promoReady };
  }

  // دوام كامل
  if (!jp.shiftStartedAt) {
    const started = await JobProfile.findOneAndUpdate(
      { userId, guildId, jobId: job.id, shiftStartedAt: null },
      { $set: { shiftStartedAt: new Date(now), lastActiveAt: new Date(now) } },
      { new: true },
    );
    if (!started) return { ok: false, reason: "on_shift", msLeft: JOB_RULES.fullDayMs };
    return { ok: true, kind: "started", endsAt: new Date(now + JOB_RULES.fullDayMs) };
  }
  const endsAt = new Date(jp.shiftStartedAt).getTime() + JOB_RULES.fullDayMs;
  if (now < endsAt) return { ok: false, reason: "on_shift", msLeft: endsAt - now };

  const claimed = await JobProfile.findOneAndUpdate(
    { userId, guildId, jobId: job.id, shiftStartedAt: jp.shiftStartedAt },
    { $set: { shiftStartedAt: null, lastActiveAt: new Date(now) }, $inc: { shifts: 1 } },
    { new: true },
  );
  if (!claimed) return { ok: false, reason: "no_job" };
  let pay = job.ranks[0].pay;
  const accident = Boolean(job.accident) && Math.random() < (job.accident?.chance ?? 0);
  if (accident && job.accident) pay = Math.round(pay * (1 - job.accident.lossPct));
  await payOut(userId, guildId, pay);
  return { ok: true, kind: "claimed", pay, accident };
}

export type PromoResult =
  | { ok: true; title: string; pay: number; bonus: number }
  | { ok: false; reason: "no_job" | "max" | "not_ready" | "discoveries"; shiftsLeft?: number; need?: number };

/** طلب ترقية: اللاعب يطلبها بنفسه لما يحقق الشروط */
export async function requestPromotion(userId: string, guildId: string): Promise<PromoResult> {
  const jp = await getJob(userId, guildId);
  const job = JOB_MAP[jp.jobId];
  if (!job || job.kind !== "career") return { ok: false, reason: "no_job" };
  const next = job.ranks[jp.rank + 1];
  if (!next) return { ok: false, reason: "max" };
  if (jp.shifts < next.shiftsNeeded) return { ok: false, reason: "not_ready", shiftsLeft: next.shiftsNeeded - jp.shifts };
  if (next.labDiscoveries) {
    const ctx = await loadContext(userId, guildId);
    if (ctx.labDiscoveries < next.labDiscoveries) return { ok: false, reason: "discoveries", need: next.labDiscoveries - ctx.labDiscoveries };
  }
  const up = await JobProfile.findOneAndUpdate({ userId, guildId, jobId: job.id, rank: jp.rank }, { $inc: { rank: 1 }, $set: { lastActiveAt: new Date() } }, { new: true });
  if (!up) return { ok: false, reason: "not_ready" };
  await payOut(userId, guildId, JOB_RULES.promotionBonus);
  return { ok: true, title: next.title, pay: next.pay, bonus: JOB_RULES.promotionBonus };
}
