import { Schema, model } from "mongoose";

/** إعدادات الميلاد لكل سيرفر (قناة التهنئة + رتبة اليوم) */
export interface IBirthdayConfig {
  guildId: string;
  channelId?: string;
  roleId?: string;
}

const schema = new Schema<IBirthdayConfig>({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String },
  roleId: { type: String },
});

export const BirthdayConfig = model<IBirthdayConfig>("BirthdayConfig", schema);
