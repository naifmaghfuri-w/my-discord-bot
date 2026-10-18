import { Schema, model } from "mongoose";

/** همسة (رسالة خاصة بين عضوين داخل السيرفر). تنحذف تلقائياً بعد 3 أيام */
export interface IWhisper {
  guildId: string;
  fromId: string;
  toId: string;
  text: string;
  /** رابط المرفق (صورة أو فيديو) */
  imageUrl?: string;
  mediaType?: "image" | "video";
  /** لو هذي همسة رد: معرّف الهمسة الأصلية */
  replyTo?: string;
  readAt?: Date;
  createdAt: Date;
}

const whisperSchema = new Schema<IWhisper>({
  guildId: { type: String, required: true },
  fromId: { type: String, required: true },
  toId: { type: String, required: true },
  text: { type: String, required: true },
  imageUrl: { type: String },
  mediaType: { type: String, enum: ["image", "video"] },
  replyTo: { type: String },
  readAt: { type: Date },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 3 },
});

export const Whisper = model<IWhisper>("Whisper", whisperSchema);

/** حظر مرسل: blockerId ما يستقبل همسات من blockedId */
export interface IWhisperBlock {
  guildId: string;
  blockerId: string;
  blockedId: string;
}

const blockSchema = new Schema<IWhisperBlock>({
  guildId: { type: String, required: true },
  blockerId: { type: String, required: true },
  blockedId: { type: String, required: true },
});
blockSchema.index({ guildId: 1, blockerId: 1, blockedId: 1 }, { unique: true });

export const WhisperBlock = model<IWhisperBlock>("WhisperBlock", blockSchema);
