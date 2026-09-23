import { Schema, model } from "mongoose";

export interface IAfkMessage {
  fromUserId: string;
  content: string;
  createdAt: Date;
}

export interface IAfkStatus {
  guildId: string;
  userId: string;
  reason: string;
  /** الاسم المستعار الأصلي قبل إضافة [AFK] (null لو ما قدر البوت يقرأه أو يغيّره) */
  originalNickname: string | null;
  since: Date;
  /** من طلب يُنشن عند رجوعه */
  notify: string[];
  /** رسائل تُرسل له خاص عند رجوعه */
  messages: IAfkMessage[];
}

const messageSchema = new Schema<IAfkMessage>(
  {
    fromUserId: { type: String, required: true },
    content: { type: String, required: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false },
);

const schema = new Schema<IAfkStatus>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  reason: { type: String, default: "بدون سبب" },
  originalNickname: { type: String, default: null },
  since: { type: Date, default: () => new Date() },
  notify: { type: [String], default: [] },
  messages: { type: [messageSchema], default: [] },
});

// عضو واحد بحالة AFK واحدة لكل سيرفر
schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const AfkStatus = model<IAfkStatus>("AfkStatus", schema);
