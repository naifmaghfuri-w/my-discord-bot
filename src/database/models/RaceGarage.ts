import { Schema, model } from "mongoose";

/** قطع السيارات: اللي يملكها اللاعب، واللي مركّبة على كل سيارة (tier: 0 = أصلي) */
const schema = new Schema(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    owned: { type: [String], default: [] },
    installed: { type: Schema.Types.Mixed, default: {} },
  },
  { minimize: false },
);
schema.index({ userId: 1, guildId: 1 }, { unique: true });

export const RaceGarage = model("RaceGarage", schema);
