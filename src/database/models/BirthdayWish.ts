import { Schema, model } from "mongoose";

/** من هنّأ صاحب العيد في سنة معيّنة (زر التهنئة تحت الإعلان) */
export interface IBirthdayWish {
  guildId: string;
  userId: string;
  year: number;
  wisherIds: string[];
}

const schema = new Schema<IBirthdayWish>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  year: { type: Number, required: true },
  wisherIds: { type: [String], default: [] },
});

schema.index({ guildId: 1, userId: 1, year: 1 }, { unique: true });

export const BirthdayWish = model<IBirthdayWish>("BirthdayWish", schema);
