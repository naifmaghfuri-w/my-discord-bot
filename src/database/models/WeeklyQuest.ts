import { Schema, model } from "mongoose";

export interface IWeeklyQuest {
  guildId: string;
  userId: string;
  /** مفتاح الأسبوع مثل 2026-W39 */
  weekKey: string;
  progress?: Record<string, number>;
  completed: string[];
  createdAt: Date;
}

const schema = new Schema<IWeeklyQuest>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    weekKey: { type: String, required: true },
    progress: { type: Schema.Types.Mixed },
    completed: { type: [String] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

schema.index({ guildId: 1, userId: 1, weekKey: 1 }, { unique: true });
// تنظيف تلقائي بعد 10 أيام
schema.index({ createdAt: 1 }, { expireAfterSeconds: 10 * 24 * 60 * 60 });

export const WeeklyQuest = model<IWeeklyQuest>("WeeklyQuest", schema);
