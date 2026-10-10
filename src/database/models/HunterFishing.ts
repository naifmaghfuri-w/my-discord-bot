import { Schema, model } from "mongoose";

/** صيد جارٍ (واحد لكل لاعب) */
export interface IHunterFishing {
  guildId: string;
  userId: string;
  chapter: number;
  tension: number;
  progress: number;
  round: number;
  mood: "thrash" | "steady" | "tired";
  updatedAt: Date;
}

const schema = new Schema<IHunterFishing>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  chapter: { type: Number, required: true },
  tension: { type: Number, default: 10 },
  progress: { type: Number, default: 0 },
  round: { type: Number, default: 0 },
  mood: { type: String, default: "steady" },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.index({ guildId: 1, userId: 1 }, { unique: true });
schema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 60 });

export const HunterFishing = model<IHunterFishing>("HunterFishing", schema);
