export interface ElementDef {
  id: string;
  name: string;
  icon: string;
  tier: 1 | 2;
  price: number;
  unlockCost?: number;
}

export const ELEMENTS: ElementDef[] = [
  { id: "water", name: "ماء", icon: "💧", tier: 1, price: 5 },
  { id: "hydrogen", name: "هيدروجين", icon: "⚛️", tier: 1, price: 8 },
  { id: "oxygen", name: "أكسجين", icon: "🅾️", tier: 1, price: 8 },
  { id: "carbon", name: "كربون", icon: "⚫", tier: 1, price: 10 },
  { id: "iron", name: "حديد", icon: "🔩", tier: 1, price: 12 },
  { id: "salt", name: "ملح", icon: "🧂", tier: 1, price: 6 },
  { id: "sulfur", name: "كبريت", icon: "🟡", tier: 2, price: 25, unlockCost: 2 },
  { id: "nitrogen", name: "نيتروجين", icon: "💨", tier: 2, price: 25, unlockCost: 2 },
  { id: "sodium", name: "صوديوم", icon: "🧪", tier: 2, price: 28, unlockCost: 2 },
  { id: "copper", name: "نحاس", icon: "🟠", tier: 2, price: 30, unlockCost: 3 },
];

export const ELEMENT_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));
