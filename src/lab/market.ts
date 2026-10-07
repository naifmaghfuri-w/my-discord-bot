import { COMPOUND_MAP } from "./compounds";
import { LabMarketPrice } from "../database/models/LabMarketPrice";
import { LabProfile } from "../database/models/LabProfile";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";

const REFRESH_MS = 2 * 60 * 60 * 1000;
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2;
const WALK_PERCENT = 0.15;

export async function getMarketPrice(guildId: string, compoundId: string): Promise<number> {
  const def = COMPOUND_MAP[compoundId];
  if (!def) return 0;

  const existing = await LabMarketPrice.findOne({ guildId, compoundId });
  const now = Date.now();

  if (existing && now - existing.updatedAt.getTime() < REFRESH_MS) {
    return existing.price;
  }

  const base = existing?.price ?? def.basePrice;
  const change = base * WALK_PERCENT * (Math.random() * 2 - 1);
  const next = Math.round(Math.min(def.basePrice * MAX_FACTOR, Math.max(def.basePrice * MIN_FACTOR, base + change)));

  await LabMarketPrice.findOneAndUpdate(
    { guildId, compoundId },
    { $set: { price: next, updatedAt: new Date() } },
    { upsert: true },
  );
  return next;
}

export async function getAllMarketPrices(guildId: string): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  for (const id of Object.keys(COMPOUND_MAP)) prices[id] = await getMarketPrice(guildId, id);
  return prices;
}

export type SellResult = { ok: true; earned: number } | { ok: false; reason: "insufficient" | "unknown" };

export async function sellCompound(userId: string, guildId: string, compoundId: string, qty: number): Promise<SellResult> {
  if (!COMPOUND_MAP[compoundId]) return { ok: false, reason: "unknown" };

  const price = await getMarketPrice(guildId, compoundId);
  const earned = price * qty;

  const updated = await LabProfile.findOneAndUpdate(
    { userId, guildId, [`compounds.${compoundId}`]: { $gte: qty } },
    { $inc: { [`compounds.${compoundId}`]: -qty } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "insufficient" };

  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: earned } }, { upsert: true });
  await logTransaction(guildId, userId, "lab_sale", earned);
  return { ok: true, earned };
}
