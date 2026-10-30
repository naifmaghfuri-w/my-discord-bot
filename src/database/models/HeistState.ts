import { Schema, model } from "mongoose";

/** مهلة السرقة الكبيرة (سطو البنك) للقائد */
const schema = new Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  at: { type: Date, default: null },
});
schema.index({ userId: 1, guildId: 1 }, { unique: true });

export const HeistState = model("HeistState", schema);
