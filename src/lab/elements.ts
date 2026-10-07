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
}

export const ELEMENTS: ElementDef[] = [
  { id: "water", name: "ماء", icon: "💧", tier: 1, price: 5, color: "#38bdf8" },
  { id: "hydrogen", name: "هيدروجين", icon: "⚛️", tier: 1, price: 8, color: "#e0f2fe" },
  { id: "oxygen", name: "أكسجين", icon: "🅾️", tier: 1, price: 8, color: "#fca5a5" },
  { id: "carbon", name: "كربون", icon: "⚫", tier: 1, price: 10, color: "#475569" },
  { id: "iron", name: "حديد", icon: "🔩", tier: 1, price: 12, color: "#94a3b8" },
  { id: "salt", name: "ملح", icon: "🧂", tier: 1, price: 6, color: "#f1f5f9" },
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
  { id: "waste", name: "نفايات كيميائية", icon: "☣️", tier: 3, price: 0, color: "#65a30d" },
];

export const ELEMENT_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));
