import { Schema, model } from "mongoose";

export interface IChatSettings {
  guildId: string;
  userId: string;
  /** استقبال رسائل زاجل */
  zajil: boolean;
  /** استقبال دعوات الانضمام للدردشات */
  invites: boolean;
  /** متواجد في رادار البحث حتى هذا الوقت */
  radarUntil: Date | null;
}

const schema = new Schema<IChatSettings>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  zajil: { type: Boolean, default: true },
  invites: { type: Boolean, default: true },
  radarUntil: { type: Date, default: null },
});

schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const ChatSettings = model<IChatSettings>("ChatSettings", schema);
