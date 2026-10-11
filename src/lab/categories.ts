/** تصنيفات المركبات: إكمال تصنيف كامل يعطي إنجازاً ومكافأة */
export interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  members: string[];
  reward: { coins: number; tokens: number; reputation: number };
}

export const CATEGORIES: CategoryDef[] = [
  { id: "acids", name: "الأحماض", icon: "🧪", members: ["sulfuric_acid", "hcl", "phosphoric_acid", "hf"], reward: { coins: 700, tokens: 2, reputation: 3 } },
  {
    id: "alloys",
    name: "السبائك",
    icon: "🔩",
    members: ["steel", "bronze", "brass", "solder", "gold_alloy", "superalloy", "aircraft_alloy", "royal_alloy"],
    reward: { coins: 1800, tokens: 3, reputation: 6 },
  },
  {
    id: "medicines",
    name: "الأدوية والمطهّرات",
    icon: "💊",
    members: ["saline", "hydrogen_peroxide", "disinfectant", "magnesia", "iodine_solution", "bio_serum"],
    reward: { coins: 1000, tokens: 2, reputation: 4 },
  },
  {
    id: "explosives",
    name: "المواد النشطة (خيالية)",
    icon: "💥",
    members: ["gunpowder", "matches", "mg_flash", "thermite", "explosive_core"],
    reward: { coins: 1200, tokens: 2, reputation: 4 },
  },
  {
    id: "fuels",
    name: "الوقود والطاقة",
    icon: "⛽",
    members: ["methane", "ethanol", "rocket_fuel", "recycled_fuel", "nuclear_fuel"],
    reward: { coins: 2200, tokens: 3, reputation: 8 },
  },
  {
    id: "batteries",
    name: "البطاريات",
    icon: "🔋",
    members: ["battery", "li_battery", "lead_battery", "atomic_battery"],
    reward: { coins: 1500, tokens: 2, reputation: 5 },
  },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export const categoryProgress = (c: CategoryDef, discovered: string[]): number => c.members.filter((m) => discovered.includes(m)).length;
