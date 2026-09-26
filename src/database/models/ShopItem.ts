import { Schema, model } from "mongoose";

export type ShopItemType = "role" | "rob_protection";

export interface IShopItem {
  guildId: string;
  /** معرف قصير يُستخدم بأمر /shop buy (بالإنجليزي، بدون مسافات) */
  itemId: string;
  name: string;
  price: number;
  type: ShopItemType;
  /** لو النوع role: الرتبة اللي تُعطى */
  roleId?: string;
  /** لو النوع rob_protection: مدة الحماية بالساعات */
  protectionHours?: number;
  createdAt: Date;
}

const schema = new Schema<IShopItem>(
  {
    guildId: { type: String, required: true },
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    type: { type: String, required: true },
    roleId: { type: String },
    protectionHours: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ guildId: 1, itemId: 1 }, { unique: true });

export const ShopItem = model<IShopItem>("ShopItem", schema);
