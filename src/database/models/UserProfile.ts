import { Schema, model } from "mongoose";

export interface IUserProfile {
  userId: string;
  guildId: string;
  coins: number;
  wins: number;
  xp: number;
  level: number;
  lastDaily?: Date;
  /** رصيد البنك (آمن من السرقة، عكس coins اللي هي المحفظة) */
  bank: number;
  /** رقم الحساب البنكي، يتولد تلقائياً أول مرة يفتح فيها حساب */
  accountNumber?: string;
  /** تجزئة الرقم السري (4 أرقام) + ملح عشوائي، ما نخزن الرقم نفسه أبداً */
  pinHash?: string;
  pinSalt?: string;
  /** آخر مرة سرق فيها هذا العضو (كولداون /rob) */
  lastRobAt?: Date;
  /** يوم وشهر الميلاد (بدون سنة، للخصوصية) */
  birthdayDay?: number;
  birthdayMonth?: number;
  /** محمي من السرقة لين هذا الوقت (بعد ما يُسرق، أو بعد شراء حماية من المتجر) */
  robImmuneUntil?: Date;
}

const schema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    coins: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    lastDaily: { type: Date },
    bank: { type: Number, default: 0 },
    accountNumber: { type: String },
    pinHash: { type: String },
    pinSalt: { type: String },
    lastRobAt: { type: Date },
    birthdayDay: { type: Number },
    birthdayMonth: { type: Number },
  },
  { timestamps: true },
);

// ملف واحد لكل عضو في كل سيرفر
schema.index({ userId: 1, guildId: 1 }, { unique: true });
// لسرعة أمر /top
schema.index({ guildId: 1, coins: -1 });
// رقم الحساب لازم يكون فريد على مستوى البوت كامل (لو مو undefined)
schema.index({ accountNumber: 1 }, { unique: true, sparse: true });

export const UserProfile = model<IUserProfile>("UserProfile", schema);
