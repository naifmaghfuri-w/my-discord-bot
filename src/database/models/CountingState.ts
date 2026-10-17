import { Schema, model } from "mongoose";

/** آخر رقم صحيح لكل قناة عد */
export interface ICountingState {
  guildId: string;
  /** القناة (كل قناة لها عدّاد مستقل). الحالات القديمة بدون قناة تنربط بالقناة الرئيسية تلقائياً */
  channelId?: string;
  current: number;
  highScore: number;
  /** آخر شخص عدّ رقم صحيح (ما يقدر يعدّ مرتين ورا بعض) */
  lastUserId?: string;
}

const schema = new Schema<ICountingState>({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, unique: true, sparse: true },
  current: { type: Number, default: 0 },
  highScore: { type: Number, default: 0 },
  lastUserId: { type: String },
});

export const CountingState = model<ICountingState>("CountingState", schema);

// يحذف الفهرس القديم (guildId unique) ويبني الجديد
CountingState.syncIndexes().catch(() => undefined);
