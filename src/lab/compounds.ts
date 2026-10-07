export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const RARITY_INFO: Record<Rarity, { name: string; color: number }> = {
  common: { name: "شائع", color: 0x94a3b8 },
  uncommon: { name: "غير شائع", color: 0x22c55e },
  rare: { name: "نادر", color: 0x3b82f6 },
  epic: { name: "أسطوري", color: 0xa855f7 },
  legendary: { name: "نادر جداً", color: 0xf59e0b },
};

export interface CompoundDef {
  id: string;
  name: string;
  icon: string;
  rarity: Rarity;
  recipe: Record<string, number>;
  tempRange: [number, number];
  pressureRange: [number, number];
  xp: number;
  basePrice: number;
}

export const COMPOUNDS: CompoundDef[] = [
  { id: "co2", name: "ثاني أكسيد الكربون", icon: "🫧", rarity: "common", recipe: { carbon: 1, oxygen: 2 }, tempRange: [40, 70], pressureRange: [1, 3], xp: 10, basePrice: 30 },
  { id: "rust", name: "الصدأ", icon: "🟤", rarity: "common", recipe: { iron: 2, oxygen: 1 }, tempRange: [0, 30], pressureRange: [1, 2], xp: 10, basePrice: 25 },
  { id: "saline", name: "محلول ملحي", icon: "🌊", rarity: "common", recipe: { water: 1, salt: 1 }, tempRange: [0, 50], pressureRange: [1, 5], xp: 8, basePrice: 20 },
  { id: "methane", name: "الميثان", icon: "🔥", rarity: "common", recipe: { carbon: 1, hydrogen: 4 }, tempRange: [0, 20], pressureRange: [1, 2], xp: 10, basePrice: 30 },
  { id: "steam", name: "بخار الماء", icon: "☁️", rarity: "common", recipe: { water: 2 }, tempRange: [110, 150], pressureRange: [1, 2], xp: 8, basePrice: 20 },
  { id: "soap", name: "صابون بدائي", icon: "🧼", rarity: "common", recipe: { water: 1, carbon: 1, salt: 1 }, tempRange: [30, 60], pressureRange: [1, 3], xp: 12, basePrice: 35 },

  { id: "sulfuric_acid", name: "حمض الكبريتيك", icon: "⚗️", rarity: "uncommon", recipe: { hydrogen: 2, sulfur: 1, oxygen: 4 }, tempRange: [50, 90], pressureRange: [3, 6], xp: 20, basePrice: 60 },
  { id: "ammonia", name: "الأمونيا", icon: "💨", rarity: "uncommon", recipe: { nitrogen: 1, hydrogen: 3 }, tempRange: [0, 20], pressureRange: [6, 10], xp: 20, basePrice: 55 },
  { id: "ethanol", name: "الإيثانول", icon: "🍶", rarity: "uncommon", recipe: { carbon: 2, hydrogen: 6, oxygen: 1 }, tempRange: [60, 80], pressureRange: [1, 3], xp: 22, basePrice: 65 },
  { id: "quicklime", name: "الجير الحي", icon: "🪨", rarity: "uncommon", recipe: { salt: 1, carbon: 1 }, tempRange: [300, 400], pressureRange: [1, 2], xp: 25, basePrice: 70 },
  { id: "bronze", name: "البرونز", icon: "🥉", rarity: "uncommon", recipe: { copper: 2, iron: 1 }, tempRange: [150, 200], pressureRange: [1, 3], xp: 25, basePrice: 75 },
  { id: "fertilizer", name: "سماد كيميائي", icon: "🌱", rarity: "uncommon", recipe: { nitrogen: 1, oxygen: 2, sodium: 1 }, tempRange: [20, 50], pressureRange: [4, 8], xp: 22, basePrice: 60 },

  { id: "gunpowder", name: "البارود", icon: "💥", rarity: "rare", recipe: { sulfur: 1, carbon: 2, sodium: 1 }, tempRange: [80, 100], pressureRange: [8, 12], xp: 40, basePrice: 120 },
  { id: "dye", name: "صبغة نادرة", icon: "🎨", rarity: "rare", recipe: { copper: 1, sulfur: 1, oxygen: 2 }, tempRange: [100, 130], pressureRange: [2, 4], xp: 40, basePrice: 110 },
  { id: "battery", name: "بطارية كيميائية", icon: "🔋", rarity: "rare", recipe: { copper: 2, sulfuric_acid: 1 }, tempRange: [20, 40], pressureRange: [1, 3], xp: 42, basePrice: 125 },
  { id: "rocket_fuel", name: "وقود صاروخي", icon: "🚀", rarity: "rare", recipe: { nitrogen: 2, hydrogen: 4, oxygen: 2 }, tempRange: [150, 180], pressureRange: [10, 15], xp: 45, basePrice: 130 },
  { id: "synthetic_ruby", name: "ياقوت صناعي", icon: "💎", rarity: "rare", recipe: { oxygen: 3, copper: 1, sodium: 1 }, tempRange: [400, 500], pressureRange: [1, 2], xp: 45, basePrice: 140 },

  { id: "superalloy", name: "سبيكة فائقة", icon: "⚙️", rarity: "epic", recipe: { bronze: 1, iron: 2, carbon: 1 }, tempRange: [450, 500], pressureRange: [12, 15], xp: 70, basePrice: 220 },
  { id: "explosive_core", name: "نواة متفجرة", icon: "🧨", rarity: "epic", recipe: { gunpowder: 2, sulfur: 1 }, tempRange: [90, 100], pressureRange: [14, 15], xp: 75, basePrice: 240 },
  { id: "nano_catalyst", name: "محفّز نانوي", icon: "⚛️", rarity: "epic", recipe: { synthetic_ruby: 1, copper: 2 }, tempRange: [480, 500], pressureRange: [1, 1], xp: 80, basePrice: 260 },
  { id: "bio_serum", name: "مصل حيوي", icon: "🧬", rarity: "epic", recipe: { ethanol: 1, ammonia: 1, water: 2 }, tempRange: [36, 38], pressureRange: [1, 1], xp: 72, basePrice: 230 },

  { id: "philosophers_stone", name: "حجر الفلاسفة", icon: "🪄", rarity: "legendary", recipe: { superalloy: 1, synthetic_ruby: 1, gunpowder: 1 }, tempRange: [500, 500], pressureRange: [15, 15], xp: 150, basePrice: 600 },
  { id: "elixir_of_life", name: "إكسير الحياة", icon: "✨", rarity: "legendary", recipe: { bio_serum: 2, ethanol: 1 }, tempRange: [37, 37], pressureRange: [1, 1], xp: 150, basePrice: 600 },
  { id: "quantum_crystal", name: "بلورة كمّية", icon: "🔮", rarity: "legendary", recipe: { nano_catalyst: 1, explosive_core: 1 }, tempRange: [0, 0], pressureRange: [15, 15], xp: 150, basePrice: 650 },
];

export const COMPOUND_MAP = Object.fromEntries(COMPOUNDS.map((c) => [c.id, c]));

export const TEMP = { min: 0, max: 500, step: 10, default: 20 } as const;
export const PRESSURE = { min: 1, max: 15, step: 1, default: 1 } as const;
