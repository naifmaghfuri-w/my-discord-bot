import { Schema, model } from "mongoose";

export interface IDailyQuest {
  guildId: string;
  userId: string;
  /** تاريخ اليوم حسب المنطقة الزمنية، مثل 2026-09-21 */
  dateKey: string;
  /** تقدم كل مهمة: { emojis: 12, messages: 3 } */
  progress?: Record<string, number>;
  /** المهام المكتملة (+ "all" عند إكمال الكل) */
  completed: string[];
  createdAt: Date;
}

const schema = new Schema<IDailyQuest>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    dateKey: { type: String, required: true },
    progress: { type: Schema.Types.Mixed },
    completed: { type: [String] },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
);

// وثيقة واحدة لكل عضو في اليوم (نعتمد عليها لمنع التكرار)
schema.index({ guildId: 1, userId: 1, dateKey: 1 }, { unique: true });
// تنظيف تلقائي بعد 3 أيام حتى لا تمتلئ قاعدة البيانات المجانية
schema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

export const DailyQuest = model<IDailyQuest>("DailyQuest", schema);
