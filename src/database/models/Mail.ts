import { Schema, model } from "mongoose";

/** ايميل أرسله مالك البوت (يظهر لكل اللاعبين في /mail) */
const mailSchema = new Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  /** جوائز: عملة + أغراض */
  coins: { type: Number, default: 0 },
  items: { type: [{ _id: false, id: String, count: Number }], default: [] },
  by: { type: String, default: "" },
  createdAt: { type: Date, default: () => new Date(), index: true },
});
export const Mail = model("Mail", mailSchema);

/** حالة كل لاعب مع كل ايميل (مقروء، مستلم الجوائز، محذوف) */
const stateSchema = new Schema({
  userId: { type: String, required: true },
  mailId: { type: String, required: true },
  read: { type: Boolean, default: false },
  claimed: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
});
stateSchema.index({ userId: 1, mailId: 1 }, { unique: true });
export const MailState = model("MailState", stateSchema);
