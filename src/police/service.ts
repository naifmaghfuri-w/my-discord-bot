import { JobProfile } from "../database/models/JobProfile";
import { PoliceCrime, PoliceRecord, PoliceState } from "../database/models/Police";
import { ThiefState } from "../database/models/ThiefState";
import { UserProfile } from "../database/models/UserProfile";
import { getJob } from "../jobs/service";
import { logTransaction } from "../services/transactions";
import { trackJail, type AchievementDef } from "../achievements/service";

const MIN = 60_000;

export const POLICE = {
  jobId: "police",
  /** المدة اللي يقدر الشرطي يحذّر فيها بعد السرقة/النهب */
  warnWindowMs: 30 * MIN,
  /** التحذير الثالث = سجن */
  maxWarns: 3,
  /** كفالة الخروج من سجن الشرطة */
  bail: 500,
  /** مكافأة الشرطي عن كل تحذير */
  reward: { rob: 30, theft: 70 },
  /** السجن بقرار الشرطة ما له مدة: بس الكفالة */
  jailMs: 10 * 365 * 24 * 60 * MIN,
} as const;

export type CrimeKind = "theft" | "rob";
export const KIND_LABEL: Record<CrimeKind, string> = { theft: "سرقة", rob: "نهب" };

export async function policeJail(userId: string, guildId: string): Promise<boolean> {
  return Boolean(await PoliceState.exists({ userId, guildId, jailed: true }));
}

export async function warnsOf(userId: string, guildId: string): Promise<number> {
  const st = await PoliceState.findOne({ userId, guildId }, { warns: 1 });
  return st?.warns ?? 0;
}

/** يسجّل سرقة/نهب ناجح ويرجّع id يتعلّق فيه زر التحذير */
export async function recordCrime(guildId: string, offenderId: string, kind: CrimeKind, place: string, amount: number): Promise<string | undefined> {
  try {
    const c = await PoliceCrime.create({ guildId, offenderId, kind, place, amount, at: new Date() });
    return String(c._id);
  } catch {
    return undefined;
  }
}

export type WarnResult =
  | { ok: true; offenderId: string; kind: CrimeKind; place: string; warnNo: number; jailed: boolean; reward: number; ach: AchievementDef[] }
  | { ok: false; reason: "not_police" | "unknown" | "self" | "expired" | "done" | "already_jailed" };

export async function giveWarning(guildId: string, policeId: string, crimeId: string): Promise<WarnResult> {
  const jp = await getJob(policeId, guildId);
  if (jp.jobId !== POLICE.jobId) return { ok: false, reason: "not_police" };
  if (!/^[a-f\d]{24}$/i.test(crimeId)) return { ok: false, reason: "unknown" };
  const crime = await PoliceCrime.findOne({ _id: crimeId, guildId });
  if (!crime) return { ok: false, reason: "unknown" };
  if (crime.offenderId === policeId) return { ok: false, reason: "self" };
  if (crime.warnedBy) return { ok: false, reason: "done" };
  if (Date.now() - new Date(crime.at).getTime() > POLICE.warnWindowMs) return { ok: false, reason: "expired" };
  if (await policeJail(crime.offenderId, guildId)) return { ok: false, reason: "already_jailed" };

  // نحجز التحذير ذريًا (تحذير واحد لكل جريمة)
  const claimed = await PoliceCrime.findOneAndUpdate({ _id: crimeId, warnedBy: null }, { $set: { warnedBy: policeId } });
  if (!claimed) return { ok: false, reason: "done" };

  const st = await PoliceState.findOneAndUpdate({ guildId, userId: crime.offenderId }, { $inc: { warns: 1 } }, { upsert: true, new: true });
  const warnNo = st?.warns ?? 1;
  const jailed = warnNo >= POLICE.maxWarns;
  if (jailed) {
    await PoliceState.updateOne({ guildId, userId: crime.offenderId }, { $set: { jailed: true } });
    await ThiefState.updateOne({ userId: crime.offenderId, guildId }, { $set: { jailUntil: new Date(Date.now() + POLICE.jailMs), caught: 0 } }, { upsert: true });
  }

  const kind = crime.kind as CrimeKind;
  const reward = POLICE.reward[kind];
  await UserProfile.updateOne({ userId: policeId, guildId }, { $inc: { coins: reward } }, { upsert: true });
  await logTransaction(guildId, policeId, "salary", reward).catch(() => undefined);
  await JobProfile.updateOne({ userId: policeId, guildId }, { $set: { lastActiveAt: new Date() } }).catch(() => undefined);
  await PoliceRecord.create({ guildId, policeId, offenderId: crime.offenderId, kind, place: crime.place ?? "", amount: crime.amount ?? 0, warnNo, jailed });
  const ach = jailed ? await trackJail(guildId, policeId).catch(() => []) : [];
  return { ok: true, offenderId: crime.offenderId, kind, place: crime.place ?? "", warnNo, jailed, reward, ach };
}

/** يدفع الكفالة ويطلّع من السجن. normalCost = كفالة السجن العادي (لو مو سجن شرطة) */
export async function payBail(userId: string, guildId: string, normalCost: number): Promise<{ ok: boolean; cost: number }> {
  const cost = (await policeJail(userId, guildId)) ? POLICE.bail : normalCost;
  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: cost } }, { $inc: { coins: -cost } });
  if (!paid) return { ok: false, cost };
  await ThiefState.updateOne({ userId, guildId }, { $set: { jailUntil: null, caught: 0 } }).catch(() => undefined);
  await PoliceState.updateOne({ userId, guildId }, { $set: { warns: 0, jailed: false } }).catch(() => undefined);
  return { ok: true, cost };
}

export async function listPolice(guildId: string): Promise<string[]> {
  const rows = await JobProfile.find({ guildId, jobId: POLICE.jobId }, { userId: 1 }).limit(25);
  return rows.map((r: { userId: string }) => r.userId);
}

export async function listRecords(guildId: string, policeId: string, limit = 10) {
  const [rows, total] = await Promise.all([PoliceRecord.find({ guildId, policeId }).sort({ at: -1 }).limit(limit), PoliceRecord.countDocuments({ guildId, policeId })]);
  return { rows, total };
}
