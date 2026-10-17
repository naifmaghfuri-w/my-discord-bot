import { Schema, model } from "mongoose";

/** حالة البوت العامة (نص الحالة المخصصة). وثيقة وحدة فقط */
export interface IBotStatus {
  key: string;
  text: string;
}

const schema = new Schema<IBotStatus>({
  key: { type: String, required: true, unique: true, default: "main" },
  text: { type: String, default: "" },
});

export const BotStatus = model<IBotStatus>("BotStatus", schema);
