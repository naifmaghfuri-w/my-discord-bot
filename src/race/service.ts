import { Inventory } from "../database/models/Inventory";
import { RaceGarage } from "../database/models/RaceGarage";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";
import { CAR_IDS, effectiveStats, partId, partInfo, type CarId, type CatId, type Installed, type Stats, type Tier } from "./data";

export async function ownedCars(userId: string, guildId: string): Promise<CarId[]> {
  const inv = await Inventory.findOne({ userId, guildId }, { items: 1 });
  const raw = inv?.items as unknown;
  const get = (k: string) => Number(raw instanceof Map ? raw.get(k) : (raw as Record<string, number> | undefined)?.[k]) || 0;
  return CAR_IDS.filter((c) => get(c) > 0);
}

export interface Garage {
  owned: Set<string>;
  installed: Partial<Record<CarId, Installed>>;
}

export async function getGarage(userId: string, guildId: string): Promise<Garage> {
  const doc = await RaceGarage.findOne({ userId, guildId });
  return { owned: new Set<string>(doc?.owned ?? []), installed: ((doc?.installed ?? {}) as Garage["installed"]) };
}

export async function statsOf(userId: string, guildId: string, car: CarId): Promise<Stats> {
  const g = await getGarage(userId, guildId);
  return effectiveStats(car, g.installed[car] ?? {});
}

export type BuyResult = "ok" | "no_car" | "have" | "coins";

/** شراء قطعة: نحجزها أول، وبعدها ندفع، ولو ما كفت الفلوس نرجّعها */
export async function buyPart(userId: string, guildId: string, car: CarId, cat: CatId, tier: Tier): Promise<{ result: BuyResult; price: number; autoInstalled: boolean }> {
  const p = partInfo(car, cat, tier);
  if (tier === 0) return { result: "have", price: 0, autoInstalled: false };
  if (!(await ownedCars(userId, guildId)).includes(car)) return { result: "no_car", price: p.price, autoInstalled: false };
  const reserved = await RaceGarage.findOneAndUpdate({ userId, guildId, owned: { $ne: p.id } }, { $addToSet: { owned: p.id } }, { upsert: true }).then(() => true, () => false);
  if (!reserved) return { result: "have", price: p.price, autoInstalled: false };
  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: p.price } }, { $inc: { coins: -p.price } });
  if (!paid) {
    await RaceGarage.updateOne({ userId, guildId }, { $pull: { owned: p.id } });
    return { result: "coins", price: p.price, autoInstalled: false };
  }
  await logTransaction(guildId, userId, "shop_purchase", p.price).catch(() => undefined);
  // لو الخانة أصلي نركّبها تلقائيًا
  const g = await getGarage(userId, guildId);
  const current = (g.installed[car]?.[cat] ?? 0) as number;
  let autoInstalled = false;
  if (current === 0) {
    await RaceGarage.updateOne({ userId, guildId }, { $set: { [`installed.${car}.${cat}`]: tier } });
    autoInstalled = true;
  }
  return { result: "ok", price: p.price, autoInstalled };
}

export async function installPart(userId: string, guildId: string, car: CarId, cat: CatId, tier: Tier): Promise<"ok" | "no_car" | "not_owned"> {
  if (!(await ownedCars(userId, guildId)).includes(car)) return "no_car";
  if (tier > 0) {
    const g = await getGarage(userId, guildId);
    if (!g.owned.has(partId(car, cat, tier))) return "not_owned";
  }
  await RaceGarage.updateOne({ userId, guildId }, { $set: { [`installed.${car}.${cat}`]: tier } }, { upsert: true });
  return "ok";
}
