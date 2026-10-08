import { Schema, model } from "mongoose";

/** آخر رقم صحيح في قناة العد لكل سيرفر */
export interface ICountingState {
  guildId: string;
  current: number;
  highScore: number;
  /** آخر شخص عدّ رقم صحيح (ما يقدر يعدّ مرتين ورا بعض) */
  lastUserId?: string;
}

const schema = new Schema<ICountingState>({
  guildId: { type: String, required: true, unique: true },
  current: { type: Number, default: 0 },
  highScore: { type: Number, default: 0 },
  lastUserId: { type: String },
});

export const CountingState = model<ICountingState>("CountingState", schema);
