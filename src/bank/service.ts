import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { UserProfile } from "../database/models/UserProfile";
import { getProfile } from "../services/economy";
import { logTransaction } from "../services/transactions";

const PIN_REGEX = /^\d{4}$/;

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 32).toString("hex");
}

/** يولّد رقم حساب فريد من 8 أرقام (يتأكد ما فيه تكرار على مستوى البوت كامل) */
async function generateAccountNumber(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
    const exists = await UserProfile.exists({ accountNumber: candidate });
    if (!exists) return candidate;
  }
  throw new Error("تعذّر توليد رقم حساب فريد");
}

export interface OpenResult {
  accountNumber: string;
  alreadyExisted: boolean;
}

/** يفتح حساباً بنكياً للعضو إن لم يكن عنده، ويرجع رقم الحساب */
export async function openAccount(userId: string, guildId: string): Promise<OpenResult> {
  const profile = await getProfile(userId, guildId);
  if (profile.accountNumber) return { accountNumber: profile.accountNumber, alreadyExisted: true };

  const accountNumber = await generateAccountNumber();
  await UserProfile.updateOne({ userId, guildId }, { $set: { accountNumber } });
  return { accountNumber, alreadyExisted: false };
}

export function isValidPin(pin: string): boolean {
  return PIN_REGEX.test(pin);
}

/** يحفظ رقماً سرياً جديداً (يفتح حساباً تلقائياً لو ما عنده) */
export async function setPin(userId: string, guildId: string, pin: string): Promise<void> {
  await openAccount(userId, guildId);
  const salt = randomBytes(16).toString("hex");
  const pinHash = hashPin(pin, salt);
  await UserProfile.updateOne({ userId, guildId }, { $set: { pinHash, pinSalt: salt } });
}

export async function hasPin(userId: string, guildId: string): Promise<boolean> {
  const profile = await UserProfile.findOne({ userId, guildId }, { pinHash: 1 });
  return !!profile?.pinHash;
}

export async function verifyPin(userId: string, guildId: string, pin: string): Promise<boolean> {
  const profile = await UserProfile.findOne({ userId, guildId }, { pinHash: 1, pinSalt: 1 });
  if (!profile?.pinHash || !profile.pinSalt) return false;

  const attempt = hashPin(pin, profile.pinSalt);
  const stored = Buffer.from(profile.pinHash, "hex");
  const attemptBuf = Buffer.from(attempt, "hex");
  if (stored.length !== attemptBuf.length) return false;
  return timingSafeEqual(stored, attemptBuf);
}

/** يحذف الرمز السري (عرض الرصيد بعدها ما يطلب رمز لين يحدد وحد جديد) */
export async function removePin(userId: string, guildId: string): Promise<void> {
  await UserProfile.updateOne({ userId, guildId }, { $unset: { pinHash: "", pinSalt: "" } });
}

export type TransferResult =
  | { ok: true }
  | { ok: false; reason: "self" }
  | { ok: false; reason: "insufficient" };

/** تحويل مباشر من محفظتك لمحفظة عضو ثاني (بدون المرور على البنك) */
export async function transferWallet(fromId: string, toId: string, guildId: string, amount: number): Promise<TransferResult> {
  if (fromId === toId) return { ok: false, reason: "self" };

  const updated = await UserProfile.findOneAndUpdate(
    { userId: fromId, guildId, coins: { $gte: amount } },
    { $inc: { coins: -amount } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "insufficient" };

  await UserProfile.updateOne({ userId: toId, guildId }, { $inc: { coins: amount } }, { upsert: true });
  await logTransaction(guildId, fromId, "pay_sent", amount, toId);
  await logTransaction(guildId, toId, "pay_received", amount, fromId);
  return { ok: true };
}

export type MoveResult = { ok: true; coins: number; bank: number } | { ok: false; reason: "insufficient" };

/** يحوّل من المحفظة (coins) للبنك (bank)، بشكل ذري */
export async function deposit(userId: string, guildId: string, amount: number): Promise<MoveResult> {
  const updated = await UserProfile.findOneAndUpdate(
    { userId, guildId, coins: { $gte: amount } },
    { $inc: { coins: -amount, bank: amount } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "insufficient" };
  await logTransaction(guildId, userId, "deposit", amount);
  return { ok: true, coins: updated.coins, bank: updated.bank };
}

/** يحوّل من البنك للمحفظة، بشكل ذري */
export async function withdraw(userId: string, guildId: string, amount: number): Promise<MoveResult> {
  const updated = await UserProfile.findOneAndUpdate(
    { userId, guildId, bank: { $gte: amount } },
    { $inc: { bank: -amount, coins: amount } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "insufficient" };
  await logTransaction(guildId, userId, "withdraw", amount);
  return { ok: true, coins: updated.coins, bank: updated.bank };
}

export const ROB = {
  cooldownMs: 60 * 60 * 1000,
  /** أقل رصيد لازم يكون عند الضحية بمحفظتها حتى تُسرق */
  minVictimWallet: 50,
  /** أقل رصيد لازم يكون عند السارق بمحفظته حتى يقدر يسرق */
  minRobberWallet: 20,
  successChance: 0.5,
  /** أعلى نسبة من محفظة الضحية ممكن تُسرق */
  maxStealPercent: 0.3,
  /** نسبة الغرامة من محفظة السارق لو فشل */
  finePercent: 0.15,
  /** مناعة تلقائية بعد التعرض للسرقة بنجاح (ساعات) */
  victimImmunityHours: 24,
} as const;

export type RobResult =
  | { ok: true; success: true; amount: number }
  | { ok: true; success: false; fine: number }
  | { ok: false; reason: "cooldown"; msLeft: number }
  | { ok: false; reason: "self" }
  | { ok: false; reason: "victim_too_poor" }
  | { ok: false; reason: "victim_immune"; msLeft: number }
  | { ok: false; reason: "robber_too_poor" };

/** يمنح حماية مؤقتة من السرقة (يُستخدم من المتجر) */
export async function grantRobProtection(userId: string, guildId: string, hours: number): Promise<void> {
  const profile = await getProfile(userId, guildId);
  const base = profile.robImmuneUntil && profile.robImmuneUntil.getTime() > Date.now() ? profile.robImmuneUntil.getTime() : Date.now();
  const until = new Date(base + hours * 60 * 60 * 1000);
  await UserProfile.updateOne({ userId, guildId }, { $set: { robImmuneUntil: until } });
}

/** يحاول سرقة محفظة عضو ثاني (مو البنك). كل النتائج تُطبّق بشكل ذري */
export async function attemptRob(robberId: string, victimId: string, guildId: string): Promise<RobResult> {
  if (robberId === victimId) return { ok: false, reason: "self" };

  const robber = await getProfile(robberId, guildId);
  const now = Date.now();
  if (robber.lastRobAt) {
    const msLeft = ROB.cooldownMs - (now - robber.lastRobAt.getTime());
    if (msLeft > 0) return { ok: false, reason: "cooldown", msLeft };
  }
  if (robber.coins < ROB.minRobberWallet) return { ok: false, reason: "robber_too_poor" };

  const victim = await getProfile(victimId, guildId);
  if (victim.robImmuneUntil && victim.robImmuneUntil.getTime() > now) {
    return { ok: false, reason: "victim_immune", msLeft: victim.robImmuneUntil.getTime() - now };
  }
  if (victim.coins < ROB.minVictimWallet) return { ok: false, reason: "victim_too_poor" };

  await UserProfile.updateOne({ userId: robberId, guildId }, { $set: { lastRobAt: new Date(now) } });

  const success = Math.random() < ROB.successChance;
  if (success) {
    const amount = Math.max(1, Math.floor(victim.coins * (Math.random() * ROB.maxStealPercent)));
    const immuneUntil = new Date(now + ROB.victimImmunityHours * 60 * 60 * 1000);
    await UserProfile.updateOne({ userId: victimId, guildId }, { $inc: { coins: -amount }, $set: { robImmuneUntil: immuneUntil } });
    await UserProfile.updateOne({ userId: robberId, guildId }, { $inc: { coins: amount } });
    await logTransaction(guildId, robberId, "rob_gain", amount, victimId);
    await logTransaction(guildId, victimId, "rob_loss", amount, robberId);
    return { ok: true, success: true, amount };
  }

  const fine = Math.max(1, Math.floor(robber.coins * ROB.finePercent));
  await UserProfile.updateOne({ userId: robberId, guildId }, { $inc: { coins: -fine } });
  await logTransaction(guildId, robberId, "rob_fine", fine, victimId);
  return { ok: true, success: false, fine };
}
