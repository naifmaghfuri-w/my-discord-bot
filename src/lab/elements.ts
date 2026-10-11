export interface ElementDef {
  id: string;
  name: string;
  icon: string;
  /** 1 = يُباع بالمتجر، 2 = يُفتح برموز المختبر، 3 = ناتج تجارب فاشلة (غير قابل للشراء) */
  tier: 1 | 2 | 3;
  price: number;
  unlockCost?: number;
  /** لون السائل في القارورة */
  color: string;
  /** عنصر مشع: يحتاج بدلة حماية */
  radioactive?: boolean;
  /** أقل مستوى مختبر لفتحه (نظام الإنجرام): العناصر القديمة بدون شرط */
  reqLevel?: number;
  /** إنجرامات لازم تكون مفتوحة قبله (شجرة الفتح) */
  requires?: string[];
}

export const ELEMENTS: ElementDef[] = [
  { id: "water", name: "ماء", icon: "💧", tier: 1, price: 5, color: "#38bdf8" },
  { id: "hydrogen", name: "هيدروجين", icon: "⚛️", tier: 1, price: 8, color: "#e0f2fe" },
  { id: "oxygen", name: "أكسجين", icon: "🅾️", tier: 1, price: 8, color: "#fca5a5" },
  { id: "carbon", name: "كربون", icon: "⚫", tier: 1, price: 10, color: "#475569" },
  { id: "iron", name: "حديد", icon: "🔩", tier: 1, price: 12, color: "#94a3b8" },
  { id: "salt", name: "ملح", icon: "🧂", tier: 1, price: 6, color: "#f1f5f9" },
  { id: "aluminum", name: "ألمنيوم", icon: "🥫", tier: 1, price: 14, color: "#cbd5e1" },
  { id: "zinc", name: "زنك", icon: "🔘", tier: 1, price: 14, color: "#93c5fd" },
  { id: "magnesium", name: "مغنيسيوم", icon: "🎇", tier: 1, price: 16, color: "#fef9c3" },
  { id: "silicon", name: "سيليكون", icon: "🧱", tier: 1, price: 16, color: "#a8a29e" },
  { id: "sulfur", name: "كبريت", icon: "🟡", tier: 2, price: 25, unlockCost: 2, color: "#facc15" },
  { id: "nitrogen", name: "نيتروجين", icon: "💨", tier: 2, price: 25, unlockCost: 2, color: "#a78bfa" },
  { id: "sodium", name: "صوديوم", icon: "🧪", tier: 2, price: 28, unlockCost: 2, color: "#fb923c" },
  { id: "copper", name: "نحاس", icon: "🟠", tier: 2, price: 30, unlockCost: 3, color: "#ea580c" },
  { id: "chlorine", name: "كلور", icon: "🟢", tier: 2, price: 30, unlockCost: 3, color: "#84cc16" },
  { id: "gold", name: "ذهب", icon: "🪙", tier: 2, price: 60, unlockCost: 4, color: "#fbbf24" },
  { id: "lithium", name: "ليثيوم", icon: "🔶", tier: 2, price: 35, unlockCost: 3, color: "#f87171" },
  { id: "silver", name: "فضة", icon: "🥈", tier: 2, price: 55, unlockCost: 4, color: "#e2e8f0" },
  { id: "phosphorus", name: "فوسفور", icon: "🔴", tier: 2, price: 32, unlockCost: 3, color: "#ef4444" },
  { id: "helium", name: "هيليوم", icon: "🎈", tier: 2, price: 45, unlockCost: 5, color: "#f0abfc" },
  { id: "calcium", name: "كالسيوم", icon: "🦴", tier: 2, price: 28, unlockCost: 3, color: "#fde68a" },
  { id: "potassium", name: "بوتاسيوم", icon: "🍌", tier: 2, price: 34, unlockCost: 2, reqLevel: 4, color: "#c084fc" },
  { id: "tin", name: "قصدير", icon: "🥫", tier: 2, price: 34, unlockCost: 2, reqLevel: 4, color: "#d4d4d8" },
  { id: "lead", name: "رصاص", icon: "🪨", tier: 2, price: 36, unlockCost: 2, reqLevel: 5, color: "#64748b" },
  { id: "mercury", name: "زئبق", icon: "🌡️", tier: 2, price: 45, unlockCost: 3, reqLevel: 6, color: "#e5e7eb" },
  { id: "fluorine", name: "فلور", icon: "🟨", tier: 2, price: 42, unlockCost: 3, reqLevel: 6, color: "#fef08a" },
  { id: "iodine", name: "يود", icon: "🟣", tier: 2, price: 42, unlockCost: 3, reqLevel: 6, color: "#7c3aed" },
  { id: "neon", name: "نيون", icon: "💡", tier: 2, price: 52, unlockCost: 3, reqLevel: 8, color: "#fb7185" },
  { id: "titanium", name: "تيتانيوم", icon: "🛩️", tier: 2, price: 58, unlockCost: 4, reqLevel: 8, color: "#a1a1aa" },
  { id: "platinum", name: "بلاتين", icon: "💠", tier: 2, price: 130, unlockCost: 6, reqLevel: 12, requires: ["gold"], color: "#e2e8f0" },
  { id: "tungsten", name: "تنغستن", icon: "🔩", tier: 2, price: 110, unlockCost: 6, reqLevel: 12, requires: ["titanium"], color: "#71717a" },
  { id: "uranium", name: "يورانيوم", icon: "☢️", tier: 3, price: 0, color: "#a3e635", radioactive: true },
  { id: "radium", name: "راديوم", icon: "🟢", tier: 3, price: 0, color: "#4ade80", radioactive: true },
  { id: "plutonium", name: "بلوتونيوم", icon: "☢️", tier: 3, price: 0, color: "#facc15", radioactive: true },
  { id: "waste", name: "نفايات كيميائية", icon: "☣️", tier: 3, price: 0, color: "#65a30d" },
];

export const ELEMENT_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));
