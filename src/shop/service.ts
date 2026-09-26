import type { GuildMember } from "discord.js";
import { grantRobProtection } from "../bank/service";
import { ShopItem, type IShopItem, type ShopItemType } from "../database/models/ShopItem";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";

export async function listItems(guildId: string): Promise<IShopItem[]> {
  return ShopItem.find({ guildId }).sort({ price: 1 });
}

export async function getItem(guildId: string, itemId: string): Promise<IShopItem | null> {
  return ShopItem.findOne({ guildId, itemId: itemId.toLowerCase() });
}

export interface AddItemInput {
  itemId: string;
  name: string;
  price: number;
  type: ShopItemType;
  roleId?: string;
  protectionHours?: number;
}

export async function addItem(guildId: string, input: AddItemInput): Promise<void> {
  await ShopItem.findOneAndUpdate(
    { guildId, itemId: input.itemId.toLowerCase() },
    { $set: { ...input, itemId: input.itemId.toLowerCase(), guildId } },
    { upsert: true },
  );
}

export async function removeItem(guildId: string, itemId: string): Promise<boolean> {
  const res = await ShopItem.deleteOne({ guildId, itemId: itemId.toLowerCase() });
  return res.deletedCount > 0;
}

export type BuyResult =
  | { ok: true; item: IShopItem }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "insufficient" }
  | { ok: false; reason: "role_missing" };

/** يشتري عنصراً: يخصم من المحفظة ويطبّق أثره (رتبة أو حماية سرقة) */
export async function buyItem(member: GuildMember, guildId: string, itemId: string): Promise<BuyResult> {
  const item = await getItem(guildId, itemId);
  if (!item) return { ok: false, reason: "not_found" };

  const updated = await UserProfile.findOneAndUpdate(
    { userId: member.id, guildId, coins: { $gte: item.price } },
    { $inc: { coins: -item.price } },
    { new: true },
  );
  if (!updated) return { ok: false, reason: "insufficient" };

  if (item.type === "role" && item.roleId) {
    const role = member.guild.roles.cache.get(item.roleId);
    if (!role) {
      // نرجّع الفلوس لأن الرتبة ما عادت موجودة
      await UserProfile.updateOne({ userId: member.id, guildId }, { $inc: { coins: item.price } });
      return { ok: false, reason: "role_missing" };
    }
    await member.roles.add(role).catch(() => undefined);
  } else if (item.type === "rob_protection" && item.protectionHours) {
    await grantRobProtection(member.id, guildId, item.protectionHours);
  }

  await logTransaction(guildId, member.id, "shop_purchase", item.price, undefined);
  return { ok: true, item };
}
