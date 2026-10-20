import { Schema, model } from "mongoose";

/** إعدادات البوت المتحدث لكل سيرفر */
export interface ITalkConfig {
  guildId: string;
  enabled: boolean;
  /** الغرفة اللي يرد فيها على كل رسالة */
  roomId: string;
  /** يرد في أي غرفة عند منشنه أو الرد على رسالته */
  mention: boolean;
  personality: string;
  /** أقصى عدد ردود في اليوم للسيرفر */
  dailyLimit: number;
  /** ثواني الانتظار بين رديّن للعضو نفسه */
  cooldownSec: number;
  /** اسم النموذج (فارغ = الافتراضي) */
  model: string;
  voice: string;
  /** نسبة الردود الصوتية 0-100 (0 = عند الطلب فقط) */
  voiceRatio: number;
  /** يستعمل إيموجيات السيرفر */
  emojis: boolean;
  /** كم دور يتذكر من كل عضو (0 = لا ذاكرة) */
  memory: number;
  /** رده على محاولات كشف التعليمات */
  protectReply: string;
}

const configSchema = new Schema<ITalkConfig>({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  roomId: { type: String, default: "" },
  mention: { type: Boolean, default: true },
  personality: { type: String, default: "" },
  dailyLimit: { type: Number, default: 300 },
  cooldownSec: { type: Number, default: 6 },
  model: { type: String, default: "" },
  voice: { type: String, default: "narin" },
  voiceRatio: { type: Number, default: 0 },
  emojis: { type: Boolean, default: true },
  memory: { type: Number, default: 6 },
  protectReply: { type: String, default: "😏 حاول مرة ثانية، أسراري ما تنكشف." },
});

export const TalkConfig = model<ITalkConfig>("TalkConfig", configSchema);

/** شخصية عضو: وصف يعرف البوت العضو به وكيف يكلمه */
export interface ITalkPersona {
  guildId: string;
  userId: string;
  name: string;
  description: string;
}

const personaSchema = new Schema<ITalkPersona>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  name: { type: String, default: "" },
  description: { type: String, default: "" },
});
personaSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const TalkPersona = model<ITalkPersona>("TalkPersona", personaSchema);

/** ذاكرة المحادثة لكل عضو (تنحذف بعد 7 أيام من آخر نشاط) */
export interface ITalkMemory {
  guildId: string;
  userId: string;
  turns: { role: "user" | "assistant"; content: string }[];
  updatedAt: Date;
}

const memorySchema = new Schema<ITalkMemory>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  turns: { type: [{ _id: false, role: String, content: String }], default: [] },
  updatedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 7 },
});
memorySchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const TalkMemory = model<ITalkMemory>("TalkMemory", memorySchema);

/** عدّاد الردود اليومي للسيرفر */
export interface ITalkUsage {
  guildId: string;
  day: string;
  count: number;
  createdAt: Date;
}

const usageSchema = new Schema<ITalkUsage>({
  guildId: { type: String, required: true },
  day: { type: String, required: true },
  count: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 3 },
});
usageSchema.index({ guildId: 1, day: 1 }, { unique: true });

export const TalkUsage = model<ITalkUsage>("TalkUsage", usageSchema);
