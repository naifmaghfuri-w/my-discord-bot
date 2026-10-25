import { Schema, model } from "mongoose";

export interface IVipRole {
  guildId: string;
  userId: string;
  /** null لين تنشئ الرتبة بعد الاشتراك */
  roleId: string | null;
  expiresAt: Date;
}

const schema = new Schema<IVipRole>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  roleId: { type: String, default: null },
  expiresAt: { type: Date, required: true },
});
schema.index({ guildId: 1, userId: 1 }, { unique: true });
schema.index({ expiresAt: 1 });

export const VipRole = model<IVipRole>("VipRole", schema);
