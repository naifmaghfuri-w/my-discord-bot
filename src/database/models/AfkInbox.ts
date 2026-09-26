import { Schema, model } from "mongoose";
import type { IAfkMessage } from "./AfkStatus";

export interface IAfkInbox {
  guildId: string;
  userId: string;
  messages: IAfkMessage[];
  createdAt: Date;
}

const messageSchema = new Schema<IAfkMessage>(
  {
    fromUserId: { type: String, required: true },
    content: { type: String, required: true, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, _id: false },
);

const schema = new Schema<IAfkInbox>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  messages: { type: [messageSchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

// صندوق واحد لكل عضو بكل سيرفر: رجوع جديد يستبدل الصندوق القديم لو ما فتحه
schema.index({ guildId: 1, userId: 1 }, { unique: true });
// تنظيف تلقائي بعد 3 أيام لو ما فتح صندوقه
schema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export const AfkInbox = model<IAfkInbox>("AfkInbox", schema);
