import { Schema, model } from "mongoose";

export interface IWarning {
  guildId: string;
  userId: string;
  moderatorId: string;
  reason: string;
  createdAt: Date;
}

const schema = new Schema<IWarning>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ guildId: 1, userId: 1 });

export const Warning = model<IWarning>("Warning", schema);
