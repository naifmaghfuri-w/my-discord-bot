import { config } from "../config";
import { BirthdayConfig } from "../database/models/BirthdayConfig";

export interface GuildBirthdayConfig {
  channelId?: string;
  roleId?: string;
}

/** إعدادات السيرفر؛ لو ما انضبط شيء نرجع لقيم .env القديمة (القناة تتحقق إنها من نفس السيرفر عند الإرسال) */
export async function getBirthdayConfig(guildId: string): Promise<GuildBirthdayConfig> {
  const doc = await BirthdayConfig.findOne({ guildId }).lean();
  return {
    channelId: doc?.channelId ?? config.birthdayChannelId,
    roleId: doc?.roleId ?? config.birthdayRoleId,
  };
}

export async function updateBirthdayConfig(guildId: string, patch: GuildBirthdayConfig): Promise<void> {
  await BirthdayConfig.findOneAndUpdate({ guildId }, { $set: patch }, { upsert: true });
}

export async function resetBirthdayConfig(guildId: string): Promise<void> {
  await BirthdayConfig.deleteOne({ guildId });
}
