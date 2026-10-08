import { Schema, model } from "mongoose";

export interface IChatConfig {
  guildId: string;
  /** الكاتيجوري اللي تنشأ فيه الدردشات الخاصة */
  categoryId: string;
  bannerUrl: string | null;
}

const schema = new Schema<IChatConfig>({
  guildId: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true },
  bannerUrl: { type: String, default: null },
});

export const ChatConfig = model<IChatConfig>("ChatConfig", schema);
