import { Schema, model } from "mongoose";

/** سجل زواج: نحفظ المهر عشان الخلع يرجّع نصفه للزوج */
export interface IMarriage {
  guildId: string;
  husbandId: string;
  wifeId: string;
  dowry: number;
  /** مين دفع المهر (الزوج في الحالة الطبيعية) */
  paidBy: string;
  createdAt: Date;
}

const schema = new Schema<IMarriage>({
  guildId: { type: String, required: true },
  husbandId: { type: String, required: true },
  wifeId: { type: String, required: true },
  dowry: { type: Number, default: 0 },
  paidBy: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});

schema.index({ guildId: 1, husbandId: 1, wifeId: 1 }, { unique: true });

export const Marriage = model<IMarriage>("Marriage", schema);
