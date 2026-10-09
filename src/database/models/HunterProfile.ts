import { Schema, model } from "mongoose";
import type { NenType } from "../../hunter/data";

export interface IHunterProfile {
  guildId: string;
  userId: string;
  nen: NenType;
  str: number;
  spd: number;
  end: number;
  aura: number;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  /** حد المكافآت اليومي */
  fightDay: string;
  fightsToday: number;
  lastTrainAt?: Date | null;
  lastFightAt?: Date | null;
}

const schema = new Schema<IHunterProfile>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    nen: { type: String, required: true },
    str: { type: Number, default: 10 },
    spd: { type: Number, default: 10 },
    end: { type: Number, default: 10 },
    aura: { type: Number, default: 10 },
    level: { type: Number, default: 1 },
    xp: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    fightDay: { type: String, default: "" },
    fightsToday: { type: Number, default: 0 },
    lastTrainAt: { type: Date, default: null },
    lastFightAt: { type: Date, default: null },
  },
  { timestamps: true },
);

schema.index({ guildId: 1, userId: 1 }, { unique: true });
schema.index({ guildId: 1, wins: -1 });

export const HunterProfile = model<IHunterProfile>("HunterProfile", schema);
