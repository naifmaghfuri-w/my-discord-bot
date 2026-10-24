import { Schema, model } from "mongoose";

/** مقتنيات العضو (ورد وغيره): كل عنصر بعدده */
export interface IInventory {
  guildId: string;
  userId: string;
  items: Record<string, number>;
}

const schema = new Schema<IInventory>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  items: { type: Schema.Types.Mixed, default: {} },
});
schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const Inventory = model<IInventory>("Inventory", schema);
