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

/** (غير مستخدم: الوظائف العادية بدون شروط) */
export interface JobReq {
  level?: number;
  labLevel?: number;
  bank?: boolean;
}

export interface JobRank {
  title: string;
  /** الراتب لكل دوام */
  pay: number;
  /** (قديم، ما عاد يُستخدم للترقية — الترقية الآن بسلسلة 30 يوم) */
  shiftsNeeded: number;
  /** (غير مستخدم) */
  labDiscoveries?: number;
}

export interface JobDef {
  id: string;
  name: string;
  icon: string;
  kind: "career" | "fullday" | "thief";
  desc: string;
  req: JobReq;
  ranks: JobRank[];
  /** الدوام الكامل: احتمال إصابة تخسّرك نسبة من الراتب */
  accident?: { chance: number; lossPct: number };
}

export const JOBS: JobDef[] = [
  {
    id: "courier", name: "موصل طلبات", icon: "🛵", kind: "career", desc: "توصيل بسيط. ترقياته بطيئة.",
    req: {},
    ranks: [
      { title: "موصل", pay: 60, shiftsNeeded: 0 },
      { title: "موصل خبير", pay: 90, shiftsNeeded: 25 },
      { title: "مشرف توصيل", pay: 140, shiftsNeeded: 60 },
      { title: "مدير فرع", pay: 220, shiftsNeeded: 120 },
    ],
  },
  {
    id: "bank_clerk", name: "موظف بنك", icon: "🏦", kind: "career", desc: "رواتب جيدة وترقيات بطيئة.",
    req: {},
    ranks: [
      { title: "موظف", pay: 100, shiftsNeeded: 0 },
      { title: "محاسب", pay: 160, shiftsNeeded: 35 },
      { title: "مدير فرع", pay: 250, shiftsNeeded: 90 },
    ],
  },
  {
    id: "truck_driver", name: "سائق شاحنة", icon: "🚛", kind: "fullday", desc: "رحلة يوم كامل. راتب ثابت بدون ترقيات.",
    req: {},
    ranks: [{ title: "سائق", pay: 700, shiftsNeeded: 0 }],
  },
  {
    id: "fisherman", name: "صياد سمك", icon: "🎣", kind: "fullday", desc: "يوم كامل في البحر. راتب أعلى بدون ترقيات.",
    req: {},
    ranks: [{ title: "صياد", pay: 900, shiftsNeeded: 0 }],
  },
  {
    id: "miner", name: "عامل منجم", icon: "⛏️", kind: "fullday", desc: "أعلى راتب لكن فيه خطر إصابة (10%) تخسّرك 30% من الراتب.",
    req: {},
    ranks: [{ title: "عامل منجم", pay: 1200, shiftsNeeded: 0 }],
    accident: { chance: 0.1, lossPct: 0.3 },
  },
];

JOBS.push({
  id: "thief", name: "حرامي", icon: "🦹", kind: "thief",
  desc: "اكتب `!سرقة` كل ساعة: تسرق 150 من لاعب عشوائي، و100 من شركة ما عندها حارس بوابة.",
  req: {},
  ranks: [{ title: "حرامي", pay: 150, shiftsNeeded: 0 }],
});

export const JOB_MAP: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.id, j]));
