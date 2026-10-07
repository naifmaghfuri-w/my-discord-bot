import { Schema, model } from "mongoose";

export interface ILabMarketPrice {
  guildId: string;
  compoundId: string;
  price: number;
  /** السعر السابق لعرض اتجاه السوق ▲▼ */
  prevPrice: number;
  updatedAt: Date;
}

const schema = new Schema<ILabMarketPrice>({
  guildId: { type: String, required: true },
  compoundId: { type: String, required: true },
  price: { type: Number, required: true },
  prevPrice: { type: Number, default: 0 },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.index({ guildId: 1, compoundId: 1 }, { unique: true });

export const LabMarketPrice = model<ILabMarketPrice>("LabMarketPrice", schema);
