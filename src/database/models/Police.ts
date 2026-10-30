import { Schema, model } from "mongoose";

/** سرقة/نهب صارت (تنحذف تلقائياً بعد يوم، والتحذير يحتاج خلال نص ساعة) */
const crimeSchema = new Schema({
  guildId: { type: String, required: true },
  offenderId: { type: String, required: true },
  kind: { type: String, enum: ["theft", "rob"], required: true },
  place: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  at: { type: Date, default: Date.now },
  warnedBy: { type: String, default: null },
});
crimeSchema.index({ at: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
export const PoliceCrime = model("PoliceCrime", crimeSchema);

/** سجل التحذيرات الدائم (يظهر في مركز الشرطة) */
const recordSchema = new Schema({
  guildId: { type: String, required: true },
  policeId: { type: String, required: true },
  offenderId: { type: String, required: true },
  kind: { type: String, enum: ["theft", "rob"], required: true },
  place: { type: String, default: "" },
  amount: { type: Number, default: 0 },
  warnNo: { type: Number, default: 1 },
  jailed: { type: Boolean, default: false },
  at: { type: Date, default: Date.now },
});
recordSchema.index({ guildId: 1, policeId: 1, at: -1 });
export const PoliceRecord = model("PoliceRecord", recordSchema);

/** عدد تحذيرات كل شخص وحالة السجن بقرار الشرطة */
const stateSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  warns: { type: Number, default: 0 },
  jailed: { type: Boolean, default: false },
});
stateSchema.index({ guildId: 1, userId: 1 }, { unique: true });
export const PoliceState = model("PoliceState", stateSchema);
