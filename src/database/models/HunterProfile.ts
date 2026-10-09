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
  license: boolean;
  /** 0 = ما بدأ، 2 = مرحلة الصيد، 3 = المباراة الأخيرة */
  examStage: number;
  lastExamAt?: Date | null;
  pvpDay: string;
  pvpToday: number;
  /** الشخصيات المملوكة والنشطة */
  chars: string[];
  active: string;
  /** تطوير كل شخصية: { gon: { atk, def, dod } } */
  upg: Record<string, { atk?: number; def?: number; dod?: number }>;
  /** عدد فصول القصة المكتملة */
  story: number;
  lang: "en" | "ar";
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
    license: { type: Boolean, default: false },
    examStage: { type: Number, default: 0 },
    lastExamAt: { type: Date, default: null },
    pvpDay: { type: String, default: "" },
    pvpToday: { type: Number, default: 0 },
    chars: { type: [String], default: [] },
    active: { type: String, default: "" },
    upg: { type: Schema.Types.Mixed, default: {} },
    story: { type: Number, default: 0 },
    lang: { type: String, default: "en" },
  },
  { timestamps: true },
);

schema.index({ guildId: 1, userId: 1 }, { unique: true });
schema.index({ guildId: 1, wins: -1 });

export const HunterProfile = model<IHunterProfile>("HunterProfile", schema);
