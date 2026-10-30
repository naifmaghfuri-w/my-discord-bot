export const JOB_RULES = {
  /** رسوم التقديم على وظيفة (0 = مجاني) */
  applyFee: 0,
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

/** حُذفت: موصل طلبات، موظف بنك، سائق شاحنة، صياد سمك، عامل منجم (اللاعب اللي عنده وحدة منها ينفصل تلقائيًا بدون مهلة) */
export const JOBS: JobDef[] = [];

JOBS.push({
  id: "police", name: "شرطي", icon: "👮", kind: "fullday",
  desc: "تحذّر الحرامية والنهّابين (زر تحت السرقة خلال نص ساعة)، والتحذير الثالث = سجن. راتب 600 كل يوم، وعمولة على كل تحذير. سجلاتك في `!مركز شرطة`.",
  req: {},
  ranks: [{ title: "شرطي", pay: 600, shiftsNeeded: 0 }],
});

JOBS.push({
  id: "thief", name: "حرامي", icon: "🦹", kind: "thief",
  desc: "اكتب `!سرقة` واختر: سرقة عضو أو شركة (تختارها بنفسك)، أو محل صغير، أو سرقة كبيرة (سطو البنك).",
  req: {},
  ranks: [{ title: "حرامي", pay: 0, shiftsNeeded: 0 }],
});

export const JOB_MAP: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.id, j]));
