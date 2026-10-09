import { Schema, model } from "mongoose";

export interface ITicket {
  guildId: string;
  channelId: string;
  ownerId: string;
  number: number;
  subject: string;
  /** نوع التذكرة (التذاكر القديمة بدون نوع تُعتبر help) */
  type: "help" | "report";
  claimedBy: string | null;
  status: "open" | "closed";
  createdAt: Date;
  closedAt: Date | null;
}

const schema = new Schema<ITicket>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true },
    number: { type: Number, required: true },
    subject: { type: String, required: true },
    type: { type: String, enum: ["help", "report"], default: "help" },
    claimedBy: { type: String, default: null },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    closedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ guildId: 1, ownerId: 1, status: 1 });

export const Ticket = model<ITicket>("Ticket", schema);
