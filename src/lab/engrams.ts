import { ELEMENT_MAP } from "./elements";
import {
  ELEMENTS_BY_PAGE,
  HELPER_BY_PAGE,
  MACHINE_BY_PAGE,
  TECH_BY_PAGE,
  TREE_LEVELS,
  pageCost,
  pageKey,
} from "./tree";

/**
 * شجرة الفتح: 50 صفحة، كل صفحة مستوى. فتح الصفحة (بنقاط الفتح) يعطيك كل اللي فيها:
 * عناصر + آلة + مساعد (+ تقنية أحياناً). اللي فتحه اللاعب قديماً بشكل فردي يبقى مفتوحاً.
 */
export type EngramKind = "element" | "device" | "machine" | "helper" | "tech";

export interface EngramDef {
  id: string;
  name: string;
  icon: string;
  kind: EngramKind;
  /** تكلفة فتح الصفحة كاملة بنقاط الفتح */
  cost: number;
  /** المستوى (الصفحة) المطلوب */
  level: number;
  page: number;
  requires: string[];
  desc: string;
}

const defs: EngramDef[] = [];

for (let page = 1; page <= TREE_LEVELS; page++) {
  const cost = pageCost(page);
  for (const id of ELEMENTS_BY_PAGE[page - 1]) {
    const e = ELEMENT_MAP[id];
    if (!e) continue;
    defs.push({ id, name: e.name, icon: e.icon, kind: "element", cost, level: page, page, requires: [], desc: `عنصر (سعر ${e.price})` });
  }
  for (const [item, kind] of [
    [MACHINE_BY_PAGE[page - 1], "machine"],
    [HELPER_BY_PAGE[page - 1], "helper"],
  ] as const) {
    defs.push({ id: item.id, name: item.name, icon: item.icon, kind: item.legacy ? "device" : kind, cost, level: page, page, requires: [], desc: item.desc });
  }
  for (const t of TECH_BY_PAGE[page] ?? []) {
    defs.push({ id: t.id, name: t.name, icon: t.icon, kind: "tech", cost, level: page, page, requires: [], desc: t.desc });
  }
}

export const ENGRAMS: EngramDef[] = defs;
export const ENGRAM_MAP: Record<string, EngramDef> = Object.fromEntries(ENGRAMS.map((e) => [e.id, e]));

interface HasEngrams {
  unlockedElements?: string[];
  engrams?: string[];
}

/** هل العنصر/الجهاز/التقنية مفتوح؟ (صفحته مفتوحة، أو فتحه اللاعب فردياً بالنظام القديم) */
export function hasEngram(p: HasEngrams, id: string): boolean {
  const def = ENGRAM_MAP[id];
  if (!def) return false;
  if ((p.engrams ?? []).includes(pageKey(def.page))) return true;
  return def.kind === "element" ? (p.unlockedElements ?? []).includes(id) : (p.engrams ?? []).includes(id);
}

export type EngramState = "unlocked" | "ready" | "need_points" | "need_level" | "need_prereq";

export function engramState(p: HasEngrams & { labLevel: number; labTokens: number }, def: EngramDef): EngramState {
  if (hasEngram(p, def.id)) return "unlocked";
  if (p.labLevel < def.level) return "need_level";
  if (p.labTokens < def.cost) return "need_points";
  return "ready";
}

export const engramName = (id: string): string => ENGRAM_MAP[id]?.name ?? id;

/**
 * نقاط الفتح اللي يكسبها اللاعب عند الوصول لمستوى جديد:
 * 5 للمستويات 2-10، ثم تقل (4، 3، 2، 1 كل 10 مستويات)، وبعد المستوى 50 ما فيه نقاط.
 * المجموع (145) يكفي لفتح الشجرة كاملة (140).
 */
export function pointsForLevel(level: number): number {
  if (level > TREE_LEVELS) return 0;
  return Math.max(1, 5 - Math.floor((level - 1) / 10));
}
