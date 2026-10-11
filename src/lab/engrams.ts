import { ELEMENTS } from "./elements";

/**
 * نظام الفتح على طريقة ARK: كل مستوى جديد يعطيك نقاط فتح (🔬)،
 * وكل "إنجرام" له مستوى مطلوب وتكلفة نقاط وربما إنجرامات لازم تفتحها قبله.
 * العناصر القديمة (قبل التحديث) تبقى مفتوحة لمن فتحها.
 */
export type EngramKind = "element" | "device" | "tech";

export interface EngramDef {
  id: string;
  name: string;
  icon: string;
  kind: EngramKind;
  cost: number;
  level: number;
  requires: string[];
  desc: string;
}

export const KIND_LABEL: Record<EngramKind, { name: string; icon: string }> = {
  element: { name: "العناصر", icon: "🧱" },
  device: { name: "الأجهزة", icon: "🛠️" },
  tech: { name: "التقنيات", icon: "📜" },
};

const DEVICE_ENGRAMS: EngramDef[] = [
  { id: "analyzer", name: "المحلّل (المجهر)", icon: "🔬", kind: "device", cost: 2, level: 4, requires: [], desc: "يخفّض سعر التلميحات 50% ويلمّح لك لما يكون خليطك ناقصاً" },
  { id: "extinguisher", name: "طفاية الحريق", icon: "🧯", kind: "device", cost: 2, level: 3, requires: [], desc: "تقلل احتمال حوادث المختبر" },
  { id: "geiger", name: "عدّاد جايغر", icon: "📟", kind: "device", cost: 2, level: 6, requires: [], desc: "يقيس إشعاعك بدقة ويحذّرك قبل الخطر" },
  { id: "centrifuge", name: "الطرد المركزي", icon: "🌀", kind: "device", cost: 3, level: 5, requires: [], desc: "يستخلص عناصر من النفايات الكيميائية" },
  { id: "distiller", name: "وحدة التقطير", icon: "⚗️", kind: "device", cost: 3, level: 7, requires: ["centrifuge"], desc: "فرصة 25% لمضاعفة ناتج كل تفاعل ناجح" },
  { id: "robot", name: "الروبوت الآلي", icon: "🤖", kind: "device", cost: 4, level: 9, requires: ["distiller"], desc: "يصنّع لك مركبات تعرفها وأنت غايب" },
  { id: "cooler", name: "مبرّد المفاعل", icon: "🧊", kind: "device", cost: 3, level: 10, requires: ["geiger"], desc: "يبطّئ تراكم الإشعاع ويقصّر مدة الإصابة" },
];

const TECH_ENGRAMS: EngramDef[] = [
  { id: "chem_advanced", name: "الكيمياء المتقدمة", icon: "🧪", kind: "tech", cost: 3, level: 6, requires: ["fluorine"], desc: "الهيدروفلوريك والمحلول المطهّر" },
  { id: "metallurgy", name: "علم المعادن", icon: "⚒️", kind: "tech", cost: 3, level: 6, requires: ["tin"], desc: "النحاس الأصفر واللحام" },
  { id: "optics", name: "البصريات", icon: "🔭", kind: "tech", cost: 3, level: 8, requires: ["neon"], desc: "الزجاج البصري ومصباح النيون" },
  { id: "adv_metal", name: "السبائك المتقدمة", icon: "🛩️", kind: "tech", cost: 4, level: 12, requires: ["metallurgy", "titanium"], desc: "سبيكة الطيران وفتيلة التنغستن" },
  { id: "electronics", name: "الإلكترونيات", icon: "💾", kind: "tech", cost: 5, level: 14, requires: ["platinum", "optics"], desc: "المعالج الدقيق والمحفّز البلاتيني" },
  { id: "nuclear", name: "الكيمياء النووية", icon: "☢️", kind: "tech", cost: 6, level: 16, requires: ["geiger", "electronics"], desc: "المواد المشعة المتقدمة (بدلة الحماية مطلوبة)" },
];

const ELEMENT_ENGRAMS: EngramDef[] = ELEMENTS.filter((e) => e.tier === 2 && e.unlockCost).map((e) => ({
  id: e.id,
  name: e.name,
  icon: e.icon,
  kind: "element" as const,
  cost: e.unlockCost ?? 1,
  level: e.reqLevel ?? 1,
  requires: e.requires ?? [],
  desc: `عنصر من الدرجة الثانية (سعر ${e.price})`,
}));

export const ENGRAMS: EngramDef[] = [...ELEMENT_ENGRAMS, ...DEVICE_ENGRAMS, ...TECH_ENGRAMS];
export const ENGRAM_MAP: Record<string, EngramDef> = Object.fromEntries(ENGRAMS.map((e) => [e.id, e]));

interface HasEngrams {
  unlockedElements?: string[];
  engrams?: string[];
}

/** هل الإنجرام مفتوح؟ (العناصر تُخزّن في unlockedElements للتوافق مع القديم) */
export function hasEngram(p: HasEngrams, id: string): boolean {
  const def = ENGRAM_MAP[id];
  if (!def) return false;
  return def.kind === "element" ? (p.unlockedElements ?? []).includes(id) : (p.engrams ?? []).includes(id);
}

export type EngramState = "unlocked" | "ready" | "need_points" | "need_level" | "need_prereq";

export function engramState(p: HasEngrams & { labLevel: number; labTokens: number }, def: EngramDef): EngramState {
  if (hasEngram(p, def.id)) return "unlocked";
  if (p.labLevel < def.level) return "need_level";
  if (!def.requires.every((r) => hasEngram(p, r))) return "need_prereq";
  if (p.labTokens < def.cost) return "need_points";
  return "ready";
}

export const engramName = (id: string): string => ENGRAM_MAP[id]?.name ?? id;

/** نقاط الفتح اللي يكسبها اللاعب عند الوصول لمستوى جديد */
export function pointsForLevel(level: number): number {
  return level < 10 ? 1 : level < 20 ? 2 : 3;
}
