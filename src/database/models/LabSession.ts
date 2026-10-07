import { Schema, model } from "mongoose";

export interface ILabSession {
  guildId: string;
  userId: string;
  /** خليط التفاعل الحالي: { elementId: الكمية } */
  mix: Record<string, number>;
  temp: number;
  pressure: number;
  updatedAt: Date;
}

const schema = new Schema<ILabSession>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    mix: { type: Schema.Types.Mixed, default: {} },
    temp: { type: Number, default: 20 },
    pressure: { type: Number, default: 1 },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { minimize: false },
);

schema.index({ guildId: 1, userId: 1 }, { unique: true });
schema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 });

export const LabSession = model<ILabSession>("LabSession", schema);
