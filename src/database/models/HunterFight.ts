import { Schema, model } from "mongoose";

/** قتال جاري بين لاعب وبوت (واحد لكل لاعب) */
export interface IHunterFight {
  guildId: string;
  userId: string;
  enemyId: string;
  charId: string;
  /** رقم فصل القصة (0 = قتال عادي) */
  story: number;
  hp: number;
  aura: number;
  eHp: number;
  eAura: number;
  round: number;
  lastLog: string[];
  updatedAt: Date;
}

const schema = new Schema<IHunterFight>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  enemyId: { type: String, required: true },
  charId: { type: String, default: "gon" },
  story: { type: Number, default: 0 },
  hp: { type: Number, required: true },
  aura: { type: Number, required: true },
  eHp: { type: Number, required: true },
  eAura: { type: Number, required: true },
  round: { type: Number, default: 0 },
  lastLog: { type: [String], default: [] },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.index({ guildId: 1, userId: 1 }, { unique: true });
// القتال المتروك ينحذف بعد نصف ساعة
schema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 60 });

export const HunterFight = model<IHunterFight>("HunterFight", schema);
