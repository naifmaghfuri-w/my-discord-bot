import { Schema, model } from "mongoose";

/** إعدادات تتبع الدعوات لكل سيرفر */
const configSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, default: "" },
  enabled: { type: Boolean, default: true },
});
export const InviteConfig = model("InviteConfig", configSchema);

/** سجل كل دخول: من دخل ومن دعاه */
const joinSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  /** null = ما عرفنا / رابط مخصص */
  inviterId: { type: String, default: null },
  code: { type: String, default: "" },
  kind: { type: String, default: "unknown" },
  at: { type: Date, default: () => new Date() },
});
joinSchema.index({ guildId: 1, userId: 1, at: -1 });
joinSchema.index({ guildId: 1, inviterId: 1 });
export const InviteJoin = model("InviteJoin", joinSchema);
