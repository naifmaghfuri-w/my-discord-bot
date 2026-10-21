/** المستوى: 0 مجلس الإدارة والمالكون • 1 المدير التنفيذي • 2 مدير الفرع • 3 الباقي */
export type Level = 0 | 1 | 2 | 3;

export interface TitleDef {
  key: string;
  name: string;
  group: string;
  level: Level;
}

export const BOARD_TITLE = "مجلس الإدارة والمالكون";
export const CEO_TITLE = "المدير التنفيذي";
export const BRANCH_TITLE = "مدير الفرع";
export const GUARD_TITLE = "حارس بوابة";

/** المسميات المتاحة للتوظيف والترقية (المجلس يعيّنه المالك من زر خاص) */
export const TITLES: TitleDef[] = [
  { key: "ceo", name: CEO_TITLE, group: "الإدارة العليا", level: 1 },
  { key: "branch_mgr", name: BRANCH_TITLE, group: "إدارة فرع", level: 2 },
  { key: "branch_asst", name: "مساعد مدير الفرع", group: "إدارة فرع", level: 3 },
  { key: "chief_acct", name: "رئيس المحاسبين", group: "المحاسبة", level: 3 },
  { key: "acct", name: "محاسب", group: "المحاسبة", level: 3 },
  { key: "sales", name: "مندوب مبيعات", group: "المبيعات", level: 3 },
  { key: "cs", name: "موظف خدمة العملاء", group: "خدمة العملاء", level: 3 },
  { key: "reception", name: "موظف الاستقبال", group: "الاستقبال", level: 3 },
  { key: "warehouse", name: "مسؤول المستودع", group: "المستودع", level: 3 },
  { key: "qa", name: "تأمين الجودة", group: "المستودع", level: 3 },
  { key: "hr", name: "HR", group: "الموارد البشرية (HR)", level: 3 },
  { key: "coffee", name: "موظف القهوة", group: "عمال", level: 3 },
  { key: "guard", name: GUARD_TITLE, group: "عمال", level: 3 },
  { key: "cleaner", name: "عامل نظافة", group: "عمال", level: 3 },
];

export const titleByKey = (key: string): TitleDef | undefined => TITLES.find((t) => t.key === key);

export function titleLevel(name: string): Level {
  if (name === BOARD_TITLE) return 0;
  return TITLES.find((t) => t.name === name)?.level ?? 3;
}

export function levelOf(m: { role: string; title?: string }): Level {
  if (m.role === "owner" || m.role === "official") return 0;
  if (m.title === CEO_TITLE) return 1;
  if (m.title === BRANCH_TITLE) return 2;
  return 3;
}

/** المسميات اللي يقدر يعيّنها/يعلن عنها من مستواه (اللي تحته فقط) */
export const assignable = (actorLevel: number): TitleDef[] => TITLES.filter((t) => t.level > actorLevel);

/** مجلس الإدارة/المالكون، المدير التنفيذي، ومدير الفرع فقط يتحكمون، وكل واحد بمن هو تحته */
export function canControl(actor: { userId: string; role: string; title?: string }, target: { userId: string; role: string; title?: string }): boolean {
  if (actor.userId === target.userId) return false;
  const a = levelOf(actor);
  return a <= 2 && levelOf(target) > a;
}

export function badgeOf(m: { role: string; title?: string }): { label: string; color: string } {
  if (m.role === "owner") return { label: "المالك", color: "#f59e0b" };
  if (m.role === "official") return { label: "مجلس", color: "#f97316" };
  const l = levelOf(m);
  if (l === 1) return { label: "تنفيذي", color: "#3b82f6" };
  if (l === 2) return { label: "مدير فرع", color: "#8b5cf6" };
  return { label: "موظف", color: "#64748b" };
}
