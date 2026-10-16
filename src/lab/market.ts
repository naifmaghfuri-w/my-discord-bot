import { COMPOUND_MAP } from "./compounds";
import { reputationBonus } from "./service";
import { passive } from "./tree";
import { LabMarketPrice } from "../database/models/LabMarketPrice";
import { LabProfile } from "../database/models/LabProfile";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";

const REFRESH_MS = 2 * 60 * 60 * 1000;
const MIN_FACTOR = 0.5;
const MAX_FACTOR = 2;
const WALK_PERCENT = 0.15;
/** كل وحدة تنباع تنزّل السعر 3% (عرض وطلب)، ويتعافى مع تحديثات السوق */
const SELL_IMPACT = 0.03;

export interface MarketQuote {
  price: number;
  prev: number;
}

export function trendIcon(q: MarketQuote): string {
  if (!q.prev || q.price === q.prev) return "➖";
  return q.price > q.prev ? "🟢▲" : "🔴▼";
}

export async function getMarketQuote(guildId: string, compoundId: string): Promise<MarketQuote> {
  const def = COMPOUND_MAP[compoundId];
  if (!def) return { price: 0, prev: 0 };

  const existing = await LabMarketPrice.findOne({ guildId, compoundId });
  const now = Date.now();

  if (existing && now - existing.updatedAt.getTime() < REFRESH_MS) {
    return { price: existing.price, prev: existing.prevPrice || existing.price };
  }

  const base = existing?.price ?? def.basePrice;
  // ميل خفيف للرجوع لسعر الأساس حتى ما يلصق السوق بالحد الأدنى أو الأعلى
  const pull = (def.basePrice - base) * 0.1;
  const change = base * WALK_PERCENT * (Math.random() * 2 - 1) + pull;
  const next = Math.round(Math.min(def.basePrice * MAX_FACTOR, Math.max(def.basePrice * MIN_FACTOR, base + change)));

  await LabMarketPrice.findOneAndUpdate(
    { guildId, compoundId },
    { $set: { price: next, prevPrice: base, updatedAt: new Date() } },
    { upsert: true },
  );
  return { price: next, prev: base };
}

export async function getMarketPrice(guildId: string, compoundId: string): Promise<number> {
  return (await getMarketQuote(guildId, compoundId)).price;
}

export type SellResult =
  | { ok: true; earned: number; sold: number; bonus: number; newPrice: number }
  | { ok: false; reason: "insufficient" | "unknown" };

export async function sellCompound(userId: string, guildId: string, compoundId: string, qty: number): Promise<SellResult> {
  const def = COMPOUND_MAP[compoundId];
  if (!def || qty <= 0) return { ok: false, reason: "unknown" };

  const price = await getMarketPrice(guildId, compoundId);

  const updated = await LabProfile.findOneAndUpdate(
    { userId, guildId, [`compounds.${compoundId}`]: { $gte: qty } },
    { $inc: { [`compounds.${compoundId}`]: -qty } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "insufficient" };

  // مكافأة السمعة + تأثير آلات شجرة الفتح
  const bonus = reputationBonus(updated.reputation) + passive(updated, "sell");
  const earned = Math.round(price * qty * (1 + bonus));

  // البيع المتتالي يضغط السعر للأسفل (مع حد أدنى)
  const newPrice = Math.max(Math.round(def.basePrice * MIN_FACTOR), Math.round(price * Math.pow(1 - SELL_IMPACT, qty)));
  await LabMarketPrice.updateOne({ guildId, compoundId }, { $set: { price: newPrice, prevPrice: price } });

  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: earned } }, { upsert: true });
  await logTransaction(guildId, userId, "lab_sale", earned);
  return { ok: true, earned, sold: qty, bonus, newPrice };
}

export async function sellAllCompound(userId: string, guildId: string, compoundId: string): Promise<SellResult> {
  const profile = await LabProfile.findOne({ userId, guildId });
  const qty = profile?.compounds?.[compoundId] ?? 0;
  if (qty <= 0) return { ok: false, reason: "insufficient" };
  return sellCompound(userId, guildId, compoundId, qty);
}
