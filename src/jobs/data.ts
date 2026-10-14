export const JOB_RULES = {
  /** رسوم التقديم على وظيفة */
  applyFee: 200,
  /** الوقت بين دوامين في الوظائف المهنية */
  shiftCooldownMs: 3 * 60 * 60 * 1000,
  /** مدة الدوام الكامل */
  fullDayMs: 24 * 60 * 60 * 1000,
  /** لو ما داوم هذي المدة ينفصل من وظيفته */
  inactiveFireMs: 7 * 24 * 60 * 60 * 1000,
  /** الانتظار بعد الاستقالة أو الفصل قبل التقديم على وظيفة جديدة */
  reapplyCooldownMs: 24 * 60 * 60 * 1000,
  /** مكافأة الترقية */
  promotionBonus: 500,
  /** عدد أيام الدوام المتتالية المطلوبة للترقية */
  promotionStreakDays: 30,
} as const;

export interface JobReq {
  /** مستوى العضو في السيرفر */
  level?: number;
  /** مستوى المختبر */
  labLevel?: number;
  /** يحتاج حساب بنكي */
  bank?: boolean;
}

export interface JobRank {
  title: string;
  /** الراتب لكل دوام */
  pay: number;
  /** (قديم، ما عاد يُستخدم للترقية — الترقية الآن بسلسلة 30 يوم) */
  shiftsNeeded: number;
  /** شرط إضافي للترقية: عدد المركبات المكتشفة في المختبر */
  labDiscoveries?: number;
}

export interface JobDef {
  id: string;
  name: string;
  icon: string;
  kind: "career" | "fullday";
  desc: string;
  req: JobReq;
  ranks: JobRank[];
  /** الدوام الكامل: احتمال إصابة تخسّرك نسبة من الراتب */
  accident?: { chance: number; lossPct: number };
}

export const JOBS: JobDef[] = [
  {
    id: "courier", name: "موصل طلبات", icon: "🛵", kind: "career", desc: "توصيل بسيط، مفتوح للجميع. ترقياته بطيئة.",
    req: {},
    ranks: [
      { title: "موصل", pay: 60, shiftsNeeded: 0 },
      { title: "موصل خبير", pay: 90, shiftsNeeded: 25 },
      { title: "مشرف توصيل", pay: 140, shiftsNeeded: 60 },
      { title: "مدير فرع", pay: 220, shiftsNeeded: 120 },
    ],
  },
  {
    id: "lab_assistant", name: "مساعد مختبر", icon: "🧪", kind: "career", desc: "اشتغل في الأبحاث. الرتبة الأخيرة تحتاج اكتشافات في المختبر.",
    req: { labLevel: 2 },
    ranks: [
      { title: "مساعد مختبر", pay: 90, shiftsNeeded: 0 },
      { title: "كيميائي", pay: 140, shiftsNeeded: 30 },
      { title: "رئيس أبحاث", pay: 220, shiftsNeeded: 80, labDiscoveries: 15 },
    ],
  },
  {
    id: "bank_clerk", name: "موظف بنك", icon: "🏦", kind: "career", desc: "تحتاج حساب بنكي. رواتب جيدة وترقيات بطيئة.",
    req: { level: 5, bank: true },
    ranks: [
      { title: "موظف", pay: 100, shiftsNeeded: 0 },
      { title: "محاسب", pay: 160, shiftsNeeded: 35 },
      { title: "مدير فرع", pay: 250, shiftsNeeded: 90 },
    ],
  },
  {
    id: "truck_driver", name: "سائق شاحنة", icon: "🚛", kind: "fullday", desc: "رحلة يوم كامل. راتب ثابت بدون ترقيات.",
    req: { level: 5 },
    ranks: [{ title: "سائق", pay: 700, shiftsNeeded: 0 }],
  },
  {
    id: "fisherman", name: "صياد سمك", icon: "🎣", kind: "fullday", desc: "يوم كامل في البحر. راتب أعلى بدون ترقيات.",
    req: { level: 8 },
    ranks: [{ title: "صياد", pay: 900, shiftsNeeded: 0 }],
  },
  {
    id: "miner", name: "عامل منجم", icon: "⛏️", kind: "fullday", desc: "أعلى راتب لكن فيه خطر إصابة (10%) تخسّرك 30% من الراتب.",
    req: { level: 12 },
    ranks: [{ title: "عامل منجم", pay: 1200, shiftsNeeded: 0 }],
    accident: { chance: 0.1, lossPct: 0.3 },
  },
];

export const JOB_MAP: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.id, j]));
