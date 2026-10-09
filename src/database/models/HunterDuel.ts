import { Schema, model } from "mongoose";

/** مبارزة بين لاعبين: A = المتحدّي، B = المُتحدَّى */
export interface IHunterDuel {
  guildId: string;
  channelId: string;
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  bet: number;
  status: "pending" | "active";
  round: number;
  aHp: number;
  aAura: number;
  bHp: number;
  bAura: number;
  aChoice: string | null;
  bChoice: string | null;
  lastLog: string[];
  updatedAt: Date;
}

const schema = new Schema<IHunterDuel>({
  guildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true },
  aId: { type: String, required: true },
  bId: { type: String, required: true },
  aName: { type: String, default: "Challenger" },
  bName: { type: String, default: "Opponent" },
  bet: { type: Number, default: 0 },
  status: { type: String, default: "pending" },
  round: { type: Number, default: 0 },
  aHp: { type: Number, default: 0 },
  aAura: { type: Number, default: 0 },
  bHp: { type: Number, default: 0 },
  bAura: { type: Number, default: 0 },
  aChoice: { type: String, default: null },
  bChoice: { type: String, default: null },
  lastLog: { type: [String], default: [] },
  updatedAt: { type: Date, default: () => new Date() },
});

schema.index({ aId: 1, guildId: 1 });
schema.index({ bId: 1, guildId: 1 });
// مبارزة متروكة تنحذف بعد 30 دقيقة (الرهان ما يُسحب إلا عند النهاية، فما يضيع شيء)
schema.index({ updatedAt: 1 }, { expireAfterSeconds: 30 * 60 });

export const HunterDuel = model<IHunterDuel>("HunterDuel", schema);
