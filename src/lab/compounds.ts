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
  /** خطورة التفاعل (1-3): تعطي احتمال حادث مختبر بدون معدات سلامة */
  hazard?: 1 | 2 | 3;
  /** مركب مشع: يحتاج بدلة حماية وإلا يتراكم الإشعاع */
  radioactive?: boolean;
  /** إنجرام لازم يكون مفتوحاً قبل تصنيعه (نظام الفتح) */
  engram?: string;
  /** ناتج جانبي: يطلع من تجربة "خاطئة" معروفة بدل النفايات (يصنع بأي حرارة وضغط) */
  byproduct?: boolean;
}

export const COMPOUNDS: CompoundDef[] = [
  { id: "co2", name: "ثاني أكسيد الكربون", icon: "CO₂", rarity: "common", recipe: { carbon: 1, oxygen: 2 }, tempRange: [40, 70], pressureRange: [1, 3], xp: 10, basePrice: 30 },
  { id: "rust", name: "الصدأ", icon: "Fe₂O₃", rarity: "common", recipe: { iron: 2, oxygen: 3 }, tempRange: [0, 30], pressureRange: [1, 2], xp: 10, basePrice: 25 },
  { id: "saline", name: "محلول ملحي", icon: "NaCl(aq)", rarity: "common", recipe: { water: 1, salt: 1 }, tempRange: [0, 50], pressureRange: [1, 5], xp: 8, basePrice: 20 },
  { id: "methane", name: "الميثان", icon: "CH₄", rarity: "common", recipe: { carbon: 1, hydrogen: 4 }, tempRange: [0, 20], pressureRange: [1, 2], xp: 10, basePrice: 30 },
  { id: "steam", name: "بخار الماء", icon: "H₂O(g)", rarity: "common", recipe: { water: 1 }, tempRange: [110, 150], pressureRange: [1, 2], xp: 8, basePrice: 20 },
  { id: "soap", name: "صابون", icon: "RCOONa", rarity: "common", recipe: { water: 1, carbon: 1, salt: 1 }, tempRange: [30, 60], pressureRange: [1, 3], xp: 12, basePrice: 35 },
  { id: "hydrogen_peroxide", name: "بيروكسيد الهيدروجين", icon: "H₂O₂", rarity: "common", recipe: { hydrogen: 2, oxygen: 2 }, tempRange: [10, 30], pressureRange: [1, 2], xp: 10, basePrice: 32 },
  { id: "graphite", name: "الجرافيت", icon: "C", rarity: "common", recipe: { carbon: 2 }, tempRange: [200, 300], pressureRange: [1, 2], xp: 10, basePrice: 28 },
  { id: "steel", name: "فولاذ", icon: "Fe-C", rarity: "common", recipe: { iron: 2, carbon: 1 }, tempRange: [150, 250], pressureRange: [1, 3], xp: 12, basePrice: 38 },
  { id: "soda_water", name: "ماء الصودا", icon: "H₂CO₃", rarity: "common", recipe: { water: 1, co2: 1 }, tempRange: [0, 10], pressureRange: [3, 6], xp: 12, basePrice: 36 },
  { id: "silica", name: "السيليكا", icon: "SiO₂", rarity: "common", recipe: { silicon: 1, oxygen: 2 }, tempRange: [20, 60], pressureRange: [1, 2], xp: 10, basePrice: 40 },
  { id: "alumina", name: "الألومينا", icon: "Al₂O₃", rarity: "common", recipe: { aluminum: 2, oxygen: 3 }, tempRange: [300, 400], pressureRange: [1, 2], xp: 12, basePrice: 45 },
  { id: "galvanized", name: "حديد مجلفن", icon: "Fe-Zn", rarity: "common", recipe: { iron: 1, zinc: 1 }, tempRange: [100, 150], pressureRange: [1, 2], xp: 12, basePrice: 42 },
  { id: "magnesia", name: "حليب المغنيسيا", icon: "Mg(OH)₂", rarity: "common", recipe: { magnesium: 1, water: 2 }, tempRange: [10, 30], pressureRange: [1, 2], xp: 12, basePrice: 40 },
  { id: "soot", name: "السخام", icon: "C", rarity: "common", recipe: { carbon: 2, oxygen: 1 }, tempRange: [100, 200], pressureRange: [1, 3], xp: 8, basePrice: 25, byproduct: true },
  { id: "tar", name: "القطران", icon: "✦", rarity: "common", recipe: { carbon: 1, hydrogen: 1 }, tempRange: [0, 500], pressureRange: [1, 15], xp: 8, basePrice: 28, byproduct: true },

  { id: "sulfuric_acid", name: "حمض الكبريتيك", icon: "H₂SO₄", rarity: "uncommon", recipe: { hydrogen: 2, sulfur: 1, oxygen: 4 }, tempRange: [50, 90], pressureRange: [3, 6], xp: 20, basePrice: 60, hazard: 1 },
  { id: "ammonia", name: "الأمونيا", icon: "NH₃", rarity: "uncommon", recipe: { nitrogen: 1, hydrogen: 3 }, tempRange: [400, 500], pressureRange: [10, 15], xp: 20, basePrice: 55, hazard: 1 },
  { id: "ethanol", name: "الإيثانول", icon: "C₂H₆O", rarity: "uncommon", recipe: { carbon: 2, hydrogen: 6, oxygen: 1 }, tempRange: [60, 80], pressureRange: [1, 3], xp: 22, basePrice: 65 },
  { id: "quicklime", name: "الجير الحي", icon: "CaO", rarity: "uncommon", recipe: { limestone: 1 }, tempRange: [400, 500], pressureRange: [1, 2], xp: 25, basePrice: 70 },
  { id: "bronze", name: "البرونز", icon: "Cu-Sn", rarity: "uncommon", recipe: { copper: 2, iron: 1 }, tempRange: [150, 200], pressureRange: [1, 3], xp: 25, basePrice: 75 },
  { id: "fertilizer", name: "نترات الصوديوم", icon: "NaNO₃", rarity: "uncommon", recipe: { nitrogen: 1, oxygen: 3, sodium: 1 }, tempRange: [20, 50], pressureRange: [4, 8], xp: 22, basePrice: 60 },
  { id: "hcl", name: "حمض الهيدروكلوريك", icon: "HCl", rarity: "uncommon", recipe: { hydrogen: 1, chlorine: 1 }, tempRange: [20, 40], pressureRange: [1, 3], xp: 22, basePrice: 62, hazard: 1 },
  { id: "disinfectant", name: "مطهّر", icon: "Cl₂(aq)", rarity: "uncommon", recipe: { chlorine: 1, water: 2 }, tempRange: [10, 30], pressureRange: [1, 2], xp: 22, basePrice: 64 },
  { id: "bleach", name: "مبيّض", icon: "NaOCl", rarity: "uncommon", recipe: { chlorine: 1, sodium: 1, oxygen: 1 }, tempRange: [20, 40], pressureRange: [1, 2], xp: 24, basePrice: 68 },
  { id: "phosphoric_acid", name: "حمض الفوسفوريك", icon: "H₃PO₄", rarity: "uncommon", recipe: { hydrogen: 3, phosphorus: 1, oxygen: 4 }, tempRange: [60, 100], pressureRange: [2, 4], xp: 24, basePrice: 72, hazard: 1 },
  { id: "lime_water", name: "ماء الجير", icon: "Ca(OH)₂", rarity: "uncommon", recipe: { calcium: 1, water: 2 }, tempRange: [10, 30], pressureRange: [1, 2], xp: 22, basePrice: 62 },
  { id: "limestone", name: "حجر الجير", icon: "CaCO₃", rarity: "uncommon", recipe: { calcium: 1, carbon: 1, oxygen: 3 }, tempRange: [100, 150], pressureRange: [2, 3], xp: 24, basePrice: 70 },
  { id: "silver_nitrate", name: "نترات الفضة", icon: "AgNO₃", rarity: "uncommon", recipe: { silver: 1, nitrogen: 1, oxygen: 3 }, tempRange: [30, 60], pressureRange: [2, 4], xp: 26, basePrice: 85 },
  { id: "slag_glass", name: "زجاج الخبث", icon: "✦", rarity: "uncommon", recipe: { waste: 2, salt: 1 }, tempRange: [200, 300], pressureRange: [1, 2], xp: 22, basePrice: 55 },
  { id: "brass", name: "النحاس الأصفر", icon: "Cu-Zn", rarity: "uncommon", recipe: { copper: 2, zinc: 1 }, tempRange: [200, 260], pressureRange: [1, 2], xp: 25, basePrice: 80, engram: "metallurgy" },
  { id: "cinnabar", name: "الزنجفر", icon: "HgS", rarity: "uncommon", recipe: { mercury: 1, sulfur: 1 }, tempRange: [100, 140], pressureRange: [1, 3], xp: 26, basePrice: 90, hazard: 1 },
  { id: "saltpeter", name: "نترات البوتاسيوم", icon: "KNO₃", rarity: "uncommon", recipe: { potassium: 1, nitrogen: 1, oxygen: 3 }, tempRange: [20, 60], pressureRange: [2, 4], xp: 24, basePrice: 72 },
  { id: "solder", name: "اللحام", icon: "Sn-Pb", rarity: "uncommon", recipe: { tin: 2, lead: 1 }, tempRange: [180, 230], pressureRange: [1, 3], xp: 25, basePrice: 80, engram: "metallurgy" },
  { id: "iodine_solution", name: "محلول اليود", icon: "I₂", rarity: "uncommon", recipe: { iodine: 1, ethanol: 1 }, tempRange: [20, 40], pressureRange: [1, 2], xp: 26, basePrice: 88, engram: "chem_advanced" },
  { id: "hf", name: "حمض الهيدروفلوريك", icon: "HF", rarity: "uncommon", recipe: { fluorine: 1, hydrogen: 1 }, tempRange: [10, 30], pressureRange: [1, 3], xp: 26, basePrice: 85, hazard: 2, engram: "chem_advanced" },
  { id: "mg_flash", name: "وميض المغنيسيوم", icon: "MgO", rarity: "uncommon", recipe: { magnesium: 1, oxygen: 1 }, tempRange: [60, 100], pressureRange: [1, 2], xp: 24, basePrice: 75, hazard: 1 },
  { id: "caustic", name: "الصودا الكاوية", icon: "NaOH", rarity: "uncommon", recipe: { sodium: 1, water: 1 }, tempRange: [0, 500], pressureRange: [1, 15], xp: 20, basePrice: 60, hazard: 1, byproduct: true },
  { id: "iron_chloride", name: "كلوريد الحديد", icon: "FeCl₂", rarity: "uncommon", recipe: { iron: 1, chlorine: 2 }, tempRange: [0, 500], pressureRange: [1, 15], xp: 20, basePrice: 58, byproduct: true },
  { id: "h2s", name: "كبريتيد الهيدروجين", icon: "H₂S", rarity: "uncommon", recipe: { hydrogen: 2, sulfur: 1 }, tempRange: [0, 500], pressureRange: [1, 15], xp: 20, basePrice: 56, hazard: 1, byproduct: true },

  { id: "gunpowder", name: "البارود", icon: "✦", rarity: "rare", recipe: { sulfur: 1, carbon: 2, sodium: 1 }, tempRange: [80, 100], pressureRange: [8, 12], xp: 40, basePrice: 120, hazard: 2 },
  { id: "dye", name: "كبريتات النحاس (صبغة زرقاء)", icon: "CuSO₄", rarity: "rare", recipe: { copper: 1, sulfur: 1, oxygen: 4 }, tempRange: [100, 130], pressureRange: [2, 4], xp: 40, basePrice: 110 },
  { id: "battery", name: "بطارية كيميائية", icon: "Cu-Acid", rarity: "rare", recipe: { copper: 2, sulfuric_acid: 1 }, tempRange: [20, 40], pressureRange: [1, 3], xp: 42, basePrice: 125 },
  { id: "rocket_fuel", name: "وقود صواريخ", icon: "✦", rarity: "rare", recipe: { nitrogen: 2, hydrogen: 4, oxygen: 2 }, tempRange: [150, 180], pressureRange: [10, 15], xp: 45, basePrice: 130, hazard: 3 },
  { id: "synthetic_ruby", name: "ياقوت صناعي", icon: "Al₂O₃", rarity: "rare", recipe: { oxygen: 3, copper: 1, sodium: 1 }, tempRange: [400, 500], pressureRange: [1, 2], xp: 45, basePrice: 140 },
  { id: "gold_alloy", name: "سبيكة ذهب", icon: "Au-Cu", rarity: "rare", recipe: { gold: 2, copper: 1 }, tempRange: [250, 300], pressureRange: [2, 4], xp: 46, basePrice: 170 },
  { id: "matches", name: "أعواد الثقاب", icon: "P₄S₃", rarity: "rare", recipe: { phosphorus: 2, sulfur: 1, carbon: 1 }, tempRange: [60, 90], pressureRange: [1, 2], xp: 42, basePrice: 115, hazard: 1 },
  { id: "li_battery", name: "بطارية ليثيوم", icon: "Li-ion", rarity: "rare", recipe: { lithium: 2, battery: 1 }, tempRange: [20, 50], pressureRange: [1, 2], xp: 48, basePrice: 180 },
  { id: "silver_mirror", name: "مرآة فضية", icon: "Ag", rarity: "rare", recipe: { silver: 1, silver_nitrate: 1 }, tempRange: [80, 120], pressureRange: [1, 3], xp: 48, basePrice: 190 },
  { id: "heliox", name: "هيليوكس", icon: "He-O₂", rarity: "rare", recipe: { helium: 2, oxygen: 1 }, tempRange: [0, 20], pressureRange: [8, 12], xp: 46, basePrice: 160 },
  { id: "cement", name: "إسمنت", icon: "✦", rarity: "rare", recipe: { limestone: 2, iron: 1 }, tempRange: [400, 500], pressureRange: [1, 2], xp: 46, basePrice: 150 },
  { id: "recycled_fuel", name: "وقود معاد تدويره", icon: "✦", rarity: "rare", recipe: { waste: 3, hydrogen: 1 }, tempRange: [100, 150], pressureRange: [3, 5], xp: 44, basePrice: 140 },
  { id: "optical_glass", name: "زجاج بصري", icon: "SiO₂", rarity: "rare", recipe: { silicon: 2, oxygen: 4, sodium: 1 }, tempRange: [450, 500], pressureRange: [1, 3], xp: 44, basePrice: 170, engram: "optics" },
  { id: "neon_lamp", name: "مصباح نيون", icon: "Ne", rarity: "rare", recipe: { neon: 2, optical_glass: 1 }, tempRange: [20, 40], pressureRange: [1, 2], xp: 48, basePrice: 210, engram: "optics" },
  { id: "gold_amalgam", name: "ملغم الذهب", icon: "Au-Hg", rarity: "rare", recipe: { mercury: 1, gold: 1 }, tempRange: [20, 60], pressureRange: [1, 2], xp: 46, basePrice: 200, hazard: 2 },
  { id: "fluorite", name: "الفلوريت", icon: "CaF₂", rarity: "rare", recipe: { fluorine: 2, calcium: 1 }, tempRange: [100, 200], pressureRange: [1, 3], xp: 44, basePrice: 150, hazard: 1 },
  { id: "aircraft_alloy", name: "سبيكة طيران", icon: "Ti-Al", rarity: "rare", recipe: { titanium: 1, aluminum: 2 }, tempRange: [400, 480], pressureRange: [8, 12], xp: 50, basePrice: 230, engram: "adv_metal" },
  { id: "lead_battery", name: "بطارية رصاص حمضية", icon: "Pb-Acid", rarity: "rare", recipe: { lead: 2, sulfuric_acid: 1 }, tempRange: [20, 40], pressureRange: [1, 3], xp: 44, basePrice: 150 },

  { id: "superalloy", name: "سبيكة فائقة", icon: "✦", rarity: "epic", recipe: { bronze: 1, iron: 2, carbon: 1 }, tempRange: [450, 500], pressureRange: [12, 15], xp: 70, basePrice: 220 },
  { id: "explosive_core", name: "نواة متفجرة", icon: "✦", rarity: "epic", recipe: { gunpowder: 2, sulfur: 1 }, tempRange: [90, 100], pressureRange: [14, 15], xp: 75, basePrice: 240, hazard: 3 },
  { id: "nano_catalyst", name: "محفّز نانوي", icon: "✦", rarity: "epic", recipe: { synthetic_ruby: 1, copper: 2 }, tempRange: [480, 500], pressureRange: [1, 1], xp: 80, basePrice: 260 },
  { id: "bio_serum", name: "مصل حيوي", icon: "✦", rarity: "epic", recipe: { ethanol: 1, ammonia: 1, water: 2 }, tempRange: [30, 40], pressureRange: [1, 1], xp: 72, basePrice: 230 },
  { id: "midas_touch", name: "لمسة ميداس", icon: "✦", rarity: "epic", recipe: { gold_alloy: 1, synthetic_ruby: 1 }, tempRange: [350, 400], pressureRange: [5, 6], xp: 85, basePrice: 300 },
  { id: "thermite", name: "ثيرمايت", icon: "✦", rarity: "epic", recipe: { rust: 2, gunpowder: 1 }, tempRange: [200, 250], pressureRange: [10, 12], xp: 78, basePrice: 250, hazard: 3 },
  { id: "plasma_cell", name: "خلية بلازما", icon: "✦", rarity: "epic", recipe: { heliox: 1, li_battery: 1 }, tempRange: [100, 150], pressureRange: [12, 14], xp: 90, basePrice: 320, hazard: 2 },
  { id: "silver_serum", name: "مصل فضي", icon: "✦", rarity: "epic", recipe: { bio_serum: 1, silver_mirror: 1 }, tempRange: [40, 50], pressureRange: [1, 2], xp: 88, basePrice: 310 },
  { id: "royal_alloy", name: "سبيكة ملكية", icon: "Au-Ag", rarity: "epic", recipe: { gold_alloy: 1, silver_mirror: 1 }, tempRange: [300, 350], pressureRange: [8, 10], xp: 90, basePrice: 330 },
  { id: "uo2", name: "ثاني أكسيد اليورانيوم", icon: "UO₂", rarity: "epic", recipe: { uranium: 1, oxygen: 2 }, tempRange: [400, 500], pressureRange: [1, 3], xp: 95, basePrice: 360, hazard: 2, radioactive: true },
  { id: "gold_from_waste", name: "ذهب من النفايات", icon: "Au", rarity: "epic", recipe: { waste: 4, gold: 1 }, tempRange: [300, 400], pressureRange: [6, 8], xp: 80, basePrice: 270 },
  { id: "microprocessor", name: "معالج دقيق", icon: "Si", rarity: "epic", recipe: { silicon: 3, copper: 2, gold: 1 }, tempRange: [400, 480], pressureRange: [1, 2], xp: 95, basePrice: 380, engram: "electronics" },
  { id: "platinum_catalyst", name: "محفّز بلاتيني", icon: "Pt", rarity: "epic", recipe: { platinum: 1, alumina: 1 }, tempRange: [300, 400], pressureRange: [2, 4], xp: 90, basePrice: 400, engram: "electronics" },
  { id: "tungsten_filament", name: "فتيلة تنغستن", icon: "W", rarity: "epic", recipe: { tungsten: 2, optical_glass: 1 }, tempRange: [450, 500], pressureRange: [1, 1], xp: 88, basePrice: 360, engram: "adv_metal" },
  { id: "glow_clock", name: "ساعة متوهجة", icon: "Ra", rarity: "epic", recipe: { radium: 1, zinc: 1, sulfur: 1 }, tempRange: [20, 60], pressureRange: [1, 2], xp: 100, basePrice: 450, hazard: 2, radioactive: true, engram: "nuclear" },

  { id: "philosophers_stone", name: "حجر الفلاسفة", icon: "✦", rarity: "legendary", recipe: { superalloy: 1, synthetic_ruby: 1, gunpowder: 1 }, tempRange: [500, 500], pressureRange: [15, 15], xp: 150, basePrice: 600 },
  { id: "elixir_of_life", name: "إكسير الحياة", icon: "✦", rarity: "legendary", recipe: { bio_serum: 2, ethanol: 1 }, tempRange: [40, 40], pressureRange: [1, 1], xp: 150, basePrice: 600 },
  { id: "quantum_crystal", name: "بلورة كمّية", icon: "✦", rarity: "legendary", recipe: { nano_catalyst: 1, explosive_core: 1 }, tempRange: [0, 0], pressureRange: [15, 15], xp: 150, basePrice: 650 },
  { id: "antimatter_seed", name: "بذرة المادة المضادة", icon: "✦", rarity: "legendary", recipe: { plasma_cell: 1, quantum_crystal: 1 }, tempRange: [500, 500], pressureRange: [14, 14], xp: 180, basePrice: 800 },
  { id: "eternal_flame", name: "اللهب الأبدي", icon: "✦", rarity: "legendary", recipe: { thermite: 1, plasma_cell: 1 }, tempRange: [500, 500], pressureRange: [1, 1], xp: 180, basePrice: 780, hazard: 2 },
  { id: "reactor_core", name: "قلب المفاعل", icon: "✦", rarity: "legendary", recipe: { uo2: 2, steel: 1, water: 2 }, tempRange: [300, 350], pressureRange: [8, 12], xp: 190, basePrice: 850, hazard: 3, radioactive: true },
  { id: "genesis_cell", name: "خلية التكوين", icon: "✦", rarity: "legendary", recipe: { silver_serum: 1, elixir_of_life: 1 }, tempRange: [40, 40], pressureRange: [1, 1], xp: 180, basePrice: 820 },
  { id: "nuclear_fuel", name: "وقود نووي", icon: "✦", rarity: "legendary", recipe: { plutonium: 1, steel: 1, water: 1 }, tempRange: [300, 400], pressureRange: [10, 14], xp: 200, basePrice: 900, hazard: 3, radioactive: true, engram: "nuclear" },
  { id: "atomic_battery", name: "بطارية ذرّية", icon: "✦", rarity: "legendary", recipe: { plutonium: 1, li_battery: 1 }, tempRange: [100, 200], pressureRange: [1, 2], xp: 200, basePrice: 950, hazard: 2, radioactive: true, engram: "nuclear" },
];

export const COMPOUND_MAP = Object.fromEntries(COMPOUNDS.map((c) => [c.id, c]));

export const TEMP = { min: 0, max: 500, step: 10, default: 20 } as const;
export const PRESSURE = { min: 1, max: 15, step: 1, default: 1 } as const;
/** مضاعف الخطوة: عادي (×1) أو سريع (×5) */
export const STEP_MULTIPLIERS = [1, 5] as const;
