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
  { id: "hydrogen_peroxide", name: "ماء الأكسجين", icon: "🧴", rarity: "common", recipe: { hydrogen: 2, oxygen: 2 }, tempRange: [10, 30], pressureRange: [1, 2], xp: 10, basePrice: 32 },
  { id: "graphite", name: "جرافيت", icon: "✏️", rarity: "common", recipe: { carbon: 2 }, tempRange: [200, 300], pressureRange: [1, 2], xp: 10, basePrice: 28 },
  { id: "steel", name: "فولاذ", icon: "🔧", rarity: "common", recipe: { iron: 2, carbon: 1 }, tempRange: [150, 250], pressureRange: [1, 3], xp: 12, basePrice: 38 },
  { id: "soda_water", name: "ماء غازي", icon: "🥤", rarity: "common", recipe: { water: 1, co2: 1 }, tempRange: [0, 10], pressureRange: [3, 6], xp: 12, basePrice: 36 },

  { id: "sulfuric_acid", name: "حمض الكبريتيك", icon: "⚗️", rarity: "uncommon", recipe: { hydrogen: 2, sulfur: 1, oxygen: 4 }, tempRange: [50, 90], pressureRange: [3, 6], xp: 20, basePrice: 60 },
  { id: "ammonia", name: "الأمونيا", icon: "💨", rarity: "uncommon", recipe: { nitrogen: 1, hydrogen: 3 }, tempRange: [0, 20], pressureRange: [6, 10], xp: 20, basePrice: 55 },
  { id: "ethanol", name: "الإيثانول", icon: "🍶", rarity: "uncommon", recipe: { carbon: 2, hydrogen: 6, oxygen: 1 }, tempRange: [60, 80], pressureRange: [1, 3], xp: 22, basePrice: 65 },
  { id: "quicklime", name: "الجير الحي", icon: "🪨", rarity: "uncommon", recipe: { salt: 1, carbon: 1 }, tempRange: [300, 400], pressureRange: [1, 2], xp: 25, basePrice: 70 },
  { id: "bronze", name: "البرونز", icon: "🥉", rarity: "uncommon", recipe: { copper: 2, iron: 1 }, tempRange: [150, 200], pressureRange: [1, 3], xp: 25, basePrice: 75 },
  { id: "fertilizer", name: "سماد كيميائي", icon: "🌱", rarity: "uncommon", recipe: { nitrogen: 1, oxygen: 2, sodium: 1 }, tempRange: [20, 50], pressureRange: [4, 8], xp: 22, basePrice: 60 },
  { id: "hcl", name: "حمض الهيدروكلوريك", icon: "🧫", rarity: "uncommon", recipe: { hydrogen: 1, chlorine: 1 }, tempRange: [20, 40], pressureRange: [1, 3], xp: 22, basePrice: 62 },
  { id: "disinfectant", name: "معقّم", icon: "🧴", rarity: "uncommon", recipe: { chlorine: 1, water: 2 }, tempRange: [10, 30], pressureRange: [1, 2], xp: 22, basePrice: 64 },
  { id: "bleach", name: "مبيّض", icon: "🫧", rarity: "uncommon", recipe: { chlorine: 1, sodium: 1, oxygen: 1 }, tempRange: [20, 40], pressureRange: [1, 2], xp: 24, basePrice: 68 },
  { id: "phosphoric_acid", name: "حمض الفوسفوريك", icon: "🧪", rarity: "uncommon", recipe: { hydrogen: 3, phosphorus: 1, oxygen: 4 }, tempRange: [60, 100], pressureRange: [2, 4], xp: 24, basePrice: 72 },
  { id: "lime_water", name: "ماء الجير", icon: "🥛", rarity: "uncommon", recipe: { calcium: 1, water: 2 }, tempRange: [10, 30], pressureRange: [1, 2], xp: 22, basePrice: 62 },
  { id: "limestone", name: "حجر الجير", icon: "🪨", rarity: "uncommon", recipe: { calcium: 1, carbon: 1, oxygen: 3 }, tempRange: [100, 150], pressureRange: [2, 3], xp: 24, basePrice: 70 },
  { id: "silver_nitrate", name: "نترات الفضة", icon: "⚗️", rarity: "uncommon", recipe: { silver: 1, nitrogen: 1, oxygen: 3 }, tempRange: [30, 60], pressureRange: [2, 4], xp: 26, basePrice: 85 },
  { id: "slag_glass", name: "زجاج الخبث", icon: "🔷", rarity: "uncommon", recipe: { waste: 2, salt: 1 }, tempRange: [200, 300], pressureRange: [1, 2], xp: 22, basePrice: 55 },

  { id: "gunpowder", name: "البارود", icon: "💥", rarity: "rare", recipe: { sulfur: 1, carbon: 2, sodium: 1 }, tempRange: [80, 100], pressureRange: [8, 12], xp: 40, basePrice: 120 },
  { id: "dye", name: "صبغة نادرة", icon: "🎨", rarity: "rare", recipe: { copper: 1, sulfur: 1, oxygen: 2 }, tempRange: [100, 130], pressureRange: [2, 4], xp: 40, basePrice: 110 },
  { id: "battery", name: "بطارية كيميائية", icon: "🔋", rarity: "rare", recipe: { copper: 2, sulfuric_acid: 1 }, tempRange: [20, 40], pressureRange: [1, 3], xp: 42, basePrice: 125 },
  { id: "rocket_fuel", name: "وقود صاروخي", icon: "🚀", rarity: "rare", recipe: { nitrogen: 2, hydrogen: 4, oxygen: 2 }, tempRange: [150, 180], pressureRange: [10, 15], xp: 45, basePrice: 130 },
  { id: "synthetic_ruby", name: "ياقوت صناعي", icon: "💎", rarity: "rare", recipe: { oxygen: 3, copper: 1, sodium: 1 }, tempRange: [400, 500], pressureRange: [1, 2], xp: 45, basePrice: 140 },
  { id: "gold_alloy", name: "سبيكة ذهبية", icon: "🏅", rarity: "rare", recipe: { gold: 2, copper: 1 }, tempRange: [250, 300], pressureRange: [2, 4], xp: 46, basePrice: 170 },
  { id: "matches", name: "أعواد الثقاب", icon: "🔥", rarity: "rare", recipe: { phosphorus: 2, sulfur: 1, carbon: 1 }, tempRange: [60, 90], pressureRange: [1, 2], xp: 42, basePrice: 115 },
  { id: "li_battery", name: "بطارية ليثيوم", icon: "🪫", rarity: "rare", recipe: { lithium: 2, battery: 1 }, tempRange: [20, 50], pressureRange: [1, 2], xp: 48, basePrice: 180 },
  { id: "silver_mirror", name: "مرآة فضية", icon: "🪞", rarity: "rare", recipe: { silver: 1, silver_nitrate: 1 }, tempRange: [80, 120], pressureRange: [1, 3], xp: 48, basePrice: 190 },
  { id: "heliox", name: "هيليوكس", icon: "🤿", rarity: "rare", recipe: { helium: 2, oxygen: 1 }, tempRange: [0, 20], pressureRange: [8, 12], xp: 46, basePrice: 160 },
  { id: "cement", name: "إسمنت", icon: "🏗️", rarity: "rare", recipe: { limestone: 2, iron: 1 }, tempRange: [400, 500], pressureRange: [1, 2], xp: 46, basePrice: 150 },
  { id: "recycled_fuel", name: "وقود معاد تدويره", icon: "♻️", rarity: "rare", recipe: { waste: 3, hydrogen: 1 }, tempRange: [100, 150], pressureRange: [3, 5], xp: 44, basePrice: 140 },

  { id: "superalloy", name: "سبيكة فائقة", icon: "⚙️", rarity: "epic", recipe: { bronze: 1, iron: 2, carbon: 1 }, tempRange: [450, 500], pressureRange: [12, 15], xp: 70, basePrice: 220 },
  { id: "explosive_core", name: "نواة متفجرة", icon: "🧨", rarity: "epic", recipe: { gunpowder: 2, sulfur: 1 }, tempRange: [90, 100], pressureRange: [14, 15], xp: 75, basePrice: 240 },
  { id: "nano_catalyst", name: "محفّز نانوي", icon: "⚛️", rarity: "epic", recipe: { synthetic_ruby: 1, copper: 2 }, tempRange: [480, 500], pressureRange: [1, 1], xp: 80, basePrice: 260 },
  { id: "bio_serum", name: "مصل حيوي", icon: "🧬", rarity: "epic", recipe: { ethanol: 1, ammonia: 1, water: 2 }, tempRange: [30, 40], pressureRange: [1, 1], xp: 72, basePrice: 230 },
  { id: "midas_touch", name: "لمسة ميداس", icon: "👑", rarity: "epic", recipe: { gold_alloy: 1, synthetic_ruby: 1 }, tempRange: [350, 400], pressureRange: [5, 6], xp: 85, basePrice: 300 },
  { id: "thermite", name: "ثيرمايت", icon: "🌋", rarity: "epic", recipe: { rust: 2, gunpowder: 1 }, tempRange: [200, 250], pressureRange: [10, 12], xp: 78, basePrice: 250 },
  { id: "plasma_cell", name: "خلية بلازما", icon: "🟣", rarity: "epic", recipe: { heliox: 1, li_battery: 1 }, tempRange: [100, 150], pressureRange: [12, 14], xp: 90, basePrice: 320 },
  { id: "silver_serum", name: "مصل فضي", icon: "💉", rarity: "epic", recipe: { bio_serum: 1, silver_mirror: 1 }, tempRange: [40, 50], pressureRange: [1, 2], xp: 88, basePrice: 310 },
  { id: "royal_alloy", name: "سبيكة ملكية", icon: "🛡️", rarity: "epic", recipe: { gold_alloy: 1, silver_mirror: 1 }, tempRange: [300, 350], pressureRange: [8, 10], xp: 90, basePrice: 330 },
  { id: "gold_from_waste", name: "ذهب من النفايات", icon: "🪙", rarity: "epic", recipe: { waste: 4, gold: 1 }, tempRange: [300, 400], pressureRange: [6, 8], xp: 80, basePrice: 270 },

  { id: "philosophers_stone", name: "حجر الفلاسفة", icon: "🪄", rarity: "legendary", recipe: { superalloy: 1, synthetic_ruby: 1, gunpowder: 1 }, tempRange: [500, 500], pressureRange: [15, 15], xp: 150, basePrice: 600 },
  { id: "elixir_of_life", name: "إكسير الحياة", icon: "✨", rarity: "legendary", recipe: { bio_serum: 2, ethanol: 1 }, tempRange: [40, 40], pressureRange: [1, 1], xp: 150, basePrice: 600 },
  { id: "quantum_crystal", name: "بلورة كمّية", icon: "🔮", rarity: "legendary", recipe: { nano_catalyst: 1, explosive_core: 1 }, tempRange: [0, 0], pressureRange: [15, 15], xp: 150, basePrice: 650 },
  { id: "antimatter_seed", name: "بذرة المادة المضادة", icon: "🌌", rarity: "legendary", recipe: { plasma_cell: 1, quantum_crystal: 1 }, tempRange: [500, 500], pressureRange: [14, 14], xp: 180, basePrice: 800 },
  { id: "eternal_flame", name: "اللهب الأبدي", icon: "☄️", rarity: "legendary", recipe: { thermite: 1, plasma_cell: 1 }, tempRange: [500, 500], pressureRange: [1, 1], xp: 180, basePrice: 780 },
  { id: "genesis_cell", name: "خلية التكوين", icon: "🧫", rarity: "legendary", recipe: { silver_serum: 1, elixir_of_life: 1 }, tempRange: [40, 40], pressureRange: [1, 1], xp: 180, basePrice: 820 },
];

export const COMPOUND_MAP = Object.fromEntries(COMPOUNDS.map((c) => [c.id, c]));

export const TEMP = { min: 0, max: 500, step: 10, default: 20 } as const;
export const PRESSURE = { min: 1, max: 15, step: 1, default: 1 } as const;
/** مضاعف الخطوة: عادي (×1) أو سريع (×5) */
export const STEP_MULTIPLIERS = [1, 5] as const;
