import { Schema, model } from "mongoose";

export type TransactionType =
  | "deposit"
  | "withdraw"
  | "interest"
  | "rob_gain"
  | "rob_loss"
  | "rob_fine"
  | "pay_sent"
  | "pay_received"
  | "shop_purchase"
  | "lab_sale"
  | "lab_purchase"
  | "salary"
  | "job_fee";

export interface ITransaction {
  guildId: string;
  userId: string;
  type: TransactionType;
  amount: number;
  /** الطرف الثاني في العملية (المرسل/المستلم/الضحية/السارق) إن وجد */
  counterpartyId?: string;
  note?: string;
  createdAt: Date;
}

const schema = new Schema<ITransaction>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, required: true },
    amount: { type: Number, required: true },
    counterpartyId: { type: String },
    note: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ guildId: 1, userId: 1, createdAt: -1 });
// تنظيف تلقائي بعد 30 يوم حتى ما تكبر قاعدة البيانات بلا داعي
schema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Transaction = model<ITransaction>("Transaction", schema);
