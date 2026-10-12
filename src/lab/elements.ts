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
  { id: "water", name: "Water", icon: "H₂O", tier: 1, price: 5, color: "#38bdf8" },
  { id: "hydrogen", name: "Hydrogen", icon: "H", tier: 1, price: 8, color: "#e0f2fe" },
  { id: "oxygen", name: "Oxygen", icon: "O", tier: 1, price: 8, color: "#fca5a5" },
  { id: "carbon", name: "Carbon", icon: "C", tier: 1, price: 10, color: "#475569" },
  { id: "iron", name: "Iron", icon: "Fe", tier: 1, price: 12, color: "#94a3b8" },
  { id: "salt", name: "Salt", icon: "NaCl", tier: 1, price: 6, color: "#f1f5f9" },
  { id: "aluminum", name: "Aluminum", icon: "Al", tier: 1, price: 14, color: "#cbd5e1" },
  { id: "zinc", name: "Zinc", icon: "Zn", tier: 1, price: 14, color: "#93c5fd" },
  { id: "magnesium", name: "Magnesium", icon: "Mg", tier: 1, price: 16, color: "#fef9c3" },
  { id: "silicon", name: "Silicon", icon: "Si", tier: 1, price: 16, color: "#a8a29e" },
  { id: "sulfur", name: "Sulfur", icon: "S", tier: 2, price: 25, unlockCost: 2, color: "#facc15" },
  { id: "nitrogen", name: "Nitrogen", icon: "N", tier: 2, price: 25, unlockCost: 2, color: "#a78bfa" },
  { id: "sodium", name: "Sodium", icon: "Na", tier: 2, price: 28, unlockCost: 2, color: "#fb923c" },
  { id: "copper", name: "Copper", icon: "Cu", tier: 2, price: 30, unlockCost: 3, color: "#ea580c" },
  { id: "chlorine", name: "Chlorine", icon: "Cl", tier: 2, price: 30, unlockCost: 3, color: "#84cc16" },
  { id: "gold", name: "Gold", icon: "Au", tier: 2, price: 60, unlockCost: 4, color: "#fbbf24" },
  { id: "lithium", name: "Lithium", icon: "Li", tier: 2, price: 35, unlockCost: 3, color: "#f87171" },
  { id: "silver", name: "Silver", icon: "Ag", tier: 2, price: 55, unlockCost: 4, color: "#e2e8f0" },
  { id: "phosphorus", name: "Phosphorus", icon: "P", tier: 2, price: 32, unlockCost: 3, color: "#ef4444" },
  { id: "helium", name: "Helium", icon: "He", tier: 2, price: 45, unlockCost: 5, color: "#f0abfc" },
  { id: "calcium", name: "Calcium", icon: "Ca", tier: 2, price: 28, unlockCost: 3, color: "#fde68a" },
  { id: "potassium", name: "Potassium", icon: "K", tier: 2, price: 34, unlockCost: 2, reqLevel: 4, color: "#c084fc" },
  { id: "tin", name: "Tin", icon: "Sn", tier: 2, price: 34, unlockCost: 2, reqLevel: 4, color: "#d4d4d8" },
  { id: "lead", name: "Lead", icon: "Pb", tier: 2, price: 36, unlockCost: 2, reqLevel: 5, color: "#64748b" },
  { id: "mercury", name: "Mercury", icon: "Hg", tier: 2, price: 45, unlockCost: 3, reqLevel: 6, color: "#e5e7eb" },
  { id: "fluorine", name: "Fluorine", icon: "F", tier: 2, price: 42, unlockCost: 3, reqLevel: 6, color: "#fef08a" },
  { id: "iodine", name: "Iodine", icon: "I", tier: 2, price: 42, unlockCost: 3, reqLevel: 6, color: "#7c3aed" },
  { id: "neon", name: "Neon", icon: "Ne", tier: 2, price: 52, unlockCost: 3, reqLevel: 8, color: "#fb7185" },
  { id: "titanium", name: "Titanium", icon: "Ti", tier: 2, price: 58, unlockCost: 4, reqLevel: 8, color: "#a1a1aa" },
  { id: "platinum", name: "Platinum", icon: "Pt", tier: 2, price: 130, unlockCost: 6, reqLevel: 12, requires: ["gold"], color: "#e2e8f0" },
  { id: "tungsten", name: "Tungsten", icon: "W", tier: 2, price: 110, unlockCost: 6, reqLevel: 12, requires: ["titanium"], color: "#71717a" },
  { id: "uranium", name: "Uranium", icon: "U", tier: 3, price: 0, color: "#a3e635", radioactive: true },
  { id: "radium", name: "Radium", icon: "Ra", tier: 3, price: 0, color: "#4ade80", radioactive: true },
  { id: "plutonium", name: "Plutonium", icon: "Pu", tier: 3, price: 0, color: "#facc15", radioactive: true },
  { id: "waste", name: "Chemical Waste", icon: "∅", tier: 3, price: 0, color: "#65a30d" },
];

export const ELEMENT_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));
