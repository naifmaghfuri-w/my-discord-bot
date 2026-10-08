import { Schema, model } from "mongoose";

/** آخر رقم صحيح في قناة العد لكل سيرفر */
export interface ICountingState {
  guildId: string;
  current: number;
  highScore: number;
}

const schema = new Schema<ICountingState>({
  guildId: { type: String, required: true, unique: true },
  current: { type: Number, default: 0 },
  highScore: { type: Number, default: 0 },
});

export const CountingState = model<ICountingState>("CountingState", schema);
