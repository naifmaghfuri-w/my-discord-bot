import { Schema, model } from "mongoose";

export interface IJobProfile {
  guildId: string;
  userId: string;
  /** الوظيفة الحالية ("" = عاطل) */
  jobId: string;
  /** رقم الرتبة الحالية (0 = أول رتبة) */
  rank: number;
  /** عدد الدوامات منذ التوظيف */
  shifts: number;
  /** عدد الأيام المتتالية للدوام (للترقية) */
  streakDays?: number;
  /** آخر يوم داوم فيه، بصيغة YYYY-MM-DD حسب TIMEZONE */
  lastShiftDay?: string;
  lastShiftAt?: Date | null;
  /** آخر نشاط (لفصل من ما يداوم أسبوع) */
  lastActiveAt?: Date | null;
  /** بداية دوام كامل جاري */
  shiftStartedAt?: Date | null;
  /** ما يقدر يتقدّم على وظيفة قبل هذا الوقت */
  blockedUntil?: Date | null;
  /** رسالة تظهر مرة واحدة (مثل: تم فصلك) */
  notice: string;
}

const schema = new Schema<IJobProfile>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  jobId: { type: String, default: "" },
  rank: { type: Number, default: 0 },
  shifts: { type: Number, default: 0 },
  streakDays: { type: Number, default: 0 },
  lastShiftDay: { type: String, default: "" },
  lastShiftAt: { type: Date, default: null },
  lastActiveAt: { type: Date, default: null },
  shiftStartedAt: { type: Date, default: null },
  blockedUntil: { type: Date, default: null },
  notice: { type: String, default: "" },
});

schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const JobProfile = model<IJobProfile>("JobProfile", schema);
