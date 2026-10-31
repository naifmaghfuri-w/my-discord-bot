import { Schema, model } from "mongoose";

const schema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  unlocked: { type: [{ id: String, at: { type: Date, default: Date.now }, _id: false }], default: [] },
  /** عدّادات التقدم */
  jails: { type: Number, default: 0 },
  firstStreak: { type: Number, default: 0 },
  lastStreak: { type: Number, default: 0 },
});
schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const Achievement = model("Achievement", schema);
