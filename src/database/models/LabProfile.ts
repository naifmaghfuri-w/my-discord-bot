import { Schema, model } from "mongoose";

export interface ILabProfile {
  guildId: string;
  userId: string;
  labXp: number;
  labLevel: number;
  /** رموز المختبر: عملة فتح منفصلة، تُكتسب عند كل مستوى جديد */
  labTokens: number;
  /** سمعة علمية: تُكتسب من نشر مقالات عن مركبات نادرة جداً */
  reputation: number;
  /** مخزون العناصر: { elementId: الكمية } */
  inventory: Record<string, number>;
  /** مخزون المركبات المصنّعة: { compoundId: الكمية } */
  compounds: Record<string, number>;
  /** كل المركبات اللي اكتشفها هذا العضو ولو مرة */
  discovered: string[];
  /** العناصر من الدرجة الثانية اللي فتحها برموز المختبر */
  unlockedElements: string[];
  /** المركبات النادرة جداً اللي نُشر عنها مقال */
  published: string[];
  /** عدّادات للإنجازات والمهام: crafts, fails, experiments, sold, trades, bought, hints */
  stats: Record<string, number>;
  /** مهام اليوم */
  questDay: string;
  questProgress: Record<string, number>;
  questDone: string[];
  achievements: string[];
  /** عدد التلميحات المشتراة لكل مركب مجهول: { compoundId: عدد } */
  hinted: Record<string, number>;
}

const schema = new Schema<ILabProfile>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    labXp: { type: Number, default: 0 },
    labLevel: { type: Number, default: 1 },
    labTokens: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },
    inventory: { type: Schema.Types.Mixed, default: {} },
    compounds: { type: Schema.Types.Mixed, default: {} },
    discovered: { type: [String], default: [] },
    unlockedElements: { type: [String], default: [] },
    published: { type: [String], default: [] },
    stats: { type: Schema.Types.Mixed, default: {} },
    questDay: { type: String, default: "" },
    questProgress: { type: Schema.Types.Mixed, default: {} },
    questDone: { type: [String], default: [] },
    achievements: { type: [String], default: [] },
    hinted: { type: Schema.Types.Mixed, default: {} },
  },
  { minimize: false },
);

schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const LabProfile = model<ILabProfile>("LabProfile", schema);
