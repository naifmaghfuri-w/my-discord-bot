import { Schema, model } from "mongoose";

export interface IAiSettings {
  guildId: string;
  enabled: boolean;
  /** الغرفة اللي يرد على كل رسالة فيها */
  channelId: string | null;
  /** يرد في أي غرفة عند منشنه أو الرد عليه */
  mention: boolean;
  persona: string;
  /** أقصى ردود باليوم للسيرفر (0 = بلا حد) */
  dailyLimit: number;
  /** ثواني بين ردّين للعضو نفسه */
  cooldown: number;
  /** فارغ = الافتراضي */
  model: string;
  voice: string;
  /** نسبة الرد بمقطع صوتي (0 = عند الطلب فقط) */
  voiceRate: number;
  useEmoji: boolean;
  /** كم دور يتذكر من كل عضو (0 = لا ذاكرة) */
  memory: number;
  protectionReply: string;
}

const settingsSchema = new Schema<IAiSettings>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String, default: null },
  mention: { type: Boolean, default: true },
  persona: { type: String, default: "" },
  dailyLimit: { type: Number, default: 200 },
  cooldown: { type: Number, default: 5 },
  model: { type: String, default: "" },
  voice: { type: String, default: "ar-SY-AmanyNeural" },
  voiceRate: { type: Number, default: 0 },
  useEmoji: { type: Boolean, default: true },
  memory: { type: Number, default: 6 },
  protectionReply: { type: String, default: "" },
});

export const AiSettings = model<IAiSettings>("AiSettings", settingsSchema);

/** دليل الشخصيات: من يعرفهم البوت وكيف */
export interface IAiPerson {
  guildId: string;
  userId: string;
  name: string;
  description: string;
}

const personSchema = new Schema<IAiPerson>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  name: { type: String, default: "" },
  description: { type: String, required: true },
});
personSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const AiPerson = model<IAiPerson>("AiPerson", personSchema);

export interface IAiMemory {
  guildId: string;
  userId: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

const memorySchema = new Schema<IAiMemory>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  messages: {
    type: [new Schema({ role: String, content: String }, { _id: false })],
    default: [],
  },
});
memorySchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const AiMemory = model<IAiMemory>("AiMemory", memorySchema);

export interface IAiUsage {
  guildId: string;
  day: string;
  count: number;
}

const usageSchema = new Schema<IAiUsage>({
  guildId: { type: String, required: true },
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
});
usageSchema.index({ guildId: 1, day: 1 }, { unique: true });

export const AiUsage = model<IAiUsage>("AiUsage", usageSchema);
