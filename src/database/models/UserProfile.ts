import { Schema, model } from "mongoose";

export interface IUserProfile {
  userId: string;
  guildId: string;
  coins: number;
  wins: number;
  xp: number;
  level: number;
  lastDaily?: Date;
  /** شعلة النشاط: أيام متتالية أرسل فيها أي رسالة */
  streak?: number;
  bestStreak?: number;
  /** آخر يوم (بتوقيت الرياض) انحسب فيه الستريك، بصيغة YYYY-MM-DD */
  lastStreakDay?: string;
  /** يخفي الشعلة من الاسم */
  streakHidden?: boolean;
  /** الفاصل بين الاسم والرقم */
  streakSep?: string;
  /** false = بدون 🔥 ورسائل المراحل */
  streakNotify?: boolean;
  /** آخر مرة لعب فيها عملة صورة أو كتابة (مرة كل 24 ساعة) */
  lastCoinflipAt?: Date;
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
  birthdayYear?: number;
  /** يخفي العمر عن الآخرين (السنة اختيارية أصلاً) */
  birthdayHideAge?: boolean;
  /** آخر مرة أعطيناه رول عيد الميلاد (لمعرفة متى نشيله بعد 24 ساعة، ومنع تكراره بنفس السنة) */
  lastBirthdayRoleAt?: Date;
  /** الزوج/الزوجة الحالي (معرف مستخدم) */
  /** أزواج/زوجات العضو (مصفوفة: الذكر ممكن يوصل 4، الأنثى حد أقصى واحد) */
  spouseIds?: string[];
  /** الوالدان (أب/أم) — حتى شخصين */
  parentIds?: string[];
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
    streak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    lastStreakDay: { type: String },
    streakHidden: { type: Boolean, default: false },
    streakSep: { type: String, default: "»" },
    streakNotify: { type: Boolean, default: true },
    lastCoinflipAt: { type: Date },
    bank: { type: Number, default: 0 },
    accountNumber: { type: String },
    pinHash: { type: String },
    pinSalt: { type: String },
    lastRobAt: { type: Date },
    birthdayDay: { type: Number },
    birthdayMonth: { type: Number },
    birthdayYear: { type: Number },
    birthdayHideAge: { type: Boolean },
    lastBirthdayRoleAt: { type: Date },
    spouseIds: { type: [String], default: [] },
    parentIds: { type: [String], default: [] },
  },
  { timestamps: true },
);

// ملف واحد لكل عضو في كل سيرفر
schema.index({ userId: 1, guildId: 1 }, { unique: true });
// لسرعة أمر /top
schema.index({ guildId: 1, coins: -1 });
// رقم الحساب لازم يكون فريد على مستوى البوت كامل (لو مو undefined)
schema.index({ accountNumber: 1 }, { unique: true, sparse: true });
// لبحث أبناء عضو معيّن بسرعة (نظام العائلة)
schema.index({ guildId: 1, parentIds: 1 });

export const UserProfile = model<IUserProfile>("UserProfile", schema);
