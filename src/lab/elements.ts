import { ELEMENT_PAGE } from "./tree";

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

/** سعر العناصر الجديدة حسب صفحتها بالشجرة (المشعة أغلى) */
function priceFor(id: string, radioactive = false): number {
  const base = 30 + (ELEMENT_PAGE[id] ?? 1) * 3;
  return Math.round((radioactive ? base * 1.5 : base) / 5) * 5;
}

export const ELEMENTS: ElementDef[] = [
  { id: "water", name: "ماء", icon: "H₂O", tier: 1, price: 5, color: "#38bdf8" },
  { id: "hydrogen", name: "هيدروجين", icon: "H", tier: 1, price: 8, color: "#e0f2fe" },
  { id: "oxygen", name: "أكسجين", icon: "O", tier: 1, price: 8, color: "#fca5a5" },
  { id: "carbon", name: "كربون", icon: "C", tier: 1, price: 10, color: "#475569" },
  { id: "iron", name: "حديد", icon: "Fe", tier: 1, price: 12, color: "#94a3b8" },
  { id: "salt", name: "ملح", icon: "NaCl", tier: 1, price: 6, color: "#f1f5f9" },
  { id: "aluminum", name: "ألمنيوم", icon: "Al", tier: 1, price: 14, color: "#cbd5e1" },
  { id: "zinc", name: "زنك", icon: "Zn", tier: 1, price: 14, color: "#93c5fd" },
  { id: "magnesium", name: "مغنيسيوم", icon: "Mg", tier: 1, price: 16, color: "#fef9c3" },
  { id: "silicon", name: "سيليكون", icon: "Si", tier: 1, price: 16, color: "#a8a29e" },
  { id: "sulfur", name: "كبريت", icon: "S", tier: 2, price: 25, unlockCost: 2, color: "#facc15" },
  { id: "nitrogen", name: "نيتروجين", icon: "N", tier: 2, price: 25, unlockCost: 2, color: "#a78bfa" },
  { id: "sodium", name: "صوديوم", icon: "Na", tier: 2, price: 28, unlockCost: 2, color: "#fb923c" },
  { id: "copper", name: "نحاس", icon: "Cu", tier: 2, price: 30, unlockCost: 3, color: "#ea580c" },
  { id: "chlorine", name: "كلور", icon: "Cl", tier: 2, price: 30, unlockCost: 3, color: "#84cc16" },
  { id: "gold", name: "ذهب", icon: "Au", tier: 2, price: 60, unlockCost: 4, color: "#fbbf24" },
  { id: "lithium", name: "ليثيوم", icon: "Li", tier: 2, price: 35, unlockCost: 3, color: "#f87171" },
  { id: "silver", name: "فضة", icon: "Ag", tier: 2, price: 55, unlockCost: 4, color: "#e2e8f0" },
  { id: "phosphorus", name: "فوسفور", icon: "P", tier: 2, price: 32, unlockCost: 3, color: "#ef4444" },
  { id: "helium", name: "هيليوم", icon: "He", tier: 2, price: 45, unlockCost: 5, color: "#f0abfc" },
  { id: "calcium", name: "كالسيوم", icon: "Ca", tier: 2, price: 28, unlockCost: 3, color: "#fde68a" },
  { id: "potassium", name: "بوتاسيوم", icon: "K", tier: 2, price: 34, unlockCost: 2, reqLevel: 4, color: "#c084fc" },
  { id: "tin", name: "قصدير", icon: "Sn", tier: 2, price: 34, unlockCost: 2, reqLevel: 4, color: "#d4d4d8" },
  { id: "lead", name: "رصاص", icon: "Pb", tier: 2, price: 36, unlockCost: 2, reqLevel: 5, color: "#64748b" },
  { id: "mercury", name: "زئبق", icon: "Hg", tier: 2, price: 45, unlockCost: 3, reqLevel: 6, color: "#e5e7eb" },
  { id: "fluorine", name: "فلور", icon: "F", tier: 2, price: 42, unlockCost: 3, reqLevel: 6, color: "#fef08a" },
  { id: "iodine", name: "يود", icon: "I", tier: 2, price: 42, unlockCost: 3, reqLevel: 6, color: "#7c3aed" },
  { id: "neon", name: "نيون", icon: "Ne", tier: 2, price: 52, unlockCost: 3, reqLevel: 8, color: "#fb7185" },
  { id: "titanium", name: "تيتانيوم", icon: "Ti", tier: 2, price: 58, unlockCost: 4, reqLevel: 8, color: "#a1a1aa" },
  { id: "platinum", name: "بلاتين", icon: "Pt", tier: 2, price: 130, unlockCost: 6, reqLevel: 12, requires: ["gold"], color: "#e2e8f0" },
  { id: "tungsten", name: "تنغستن", icon: "W", tier: 2, price: 110, unlockCost: 6, reqLevel: 12, requires: ["titanium"], color: "#71717a" },
  { id: "beryllium", name: "بيريليوم", icon: "Be", tier: 2, price: priceFor("beryllium"), color: "#84e0af" },
  { id: "boron", name: "بورون", icon: "B", tier: 2, price: priceFor("boron"), color: "#84d8e0" },
  { id: "argon", name: "أرغون", icon: "Ar", tier: 2, price: priceFor("argon"), color: "#e084d7" },
  { id: "scandium", name: "سكانديوم", icon: "Sc", tier: 2, price: priceFor("scandium"), color: "#e0db84" },
  { id: "vanadium", name: "فاناديوم", icon: "V", tier: 2, price: priceFor("vanadium"), color: "#84e095" },
  { id: "chromium", name: "كروم", icon: "Cr", tier: 2, price: priceFor("chromium"), color: "#84e0ce" },
  { id: "manganese", name: "منغنيز", icon: "Mn", tier: 2, price: priceFor("manganese"), color: "#84bae0" },
  { id: "cobalt", name: "كوبالت", icon: "Co", tier: 2, price: priceFor("cobalt"), color: "#c084e0" },
  { id: "nickel", name: "نيكل", icon: "Ni", tier: 2, price: priceFor("nickel"), color: "#e084c7" },
  { id: "gallium", name: "غاليوم", icon: "Ga", tier: 2, price: priceFor("gallium"), color: "#d5e084" },
  { id: "germanium", name: "جرمانيوم", icon: "Ge", tier: 2, price: priceFor("germanium"), color: "#9de084" },
  { id: "arsenic", name: "زرنيخ", icon: "As", tier: 2, price: priceFor("arsenic"), color: "#84e0a4" },
  { id: "selenium", name: "سيلينيوم", icon: "Se", tier: 2, price: priceFor("selenium"), color: "#84e0dd" },
  { id: "bromine", name: "بروم", icon: "Br", tier: 2, price: priceFor("bromine"), color: "#84aae0" },
  { id: "krypton", name: "كريبتون", icon: "Kr", tier: 2, price: priceFor("krypton"), color: "#9684e0" },
  { id: "rubidium", name: "روبيديوم", icon: "Rb", tier: 2, price: priceFor("rubidium"), color: "#cf84e0" },
  { id: "strontium", name: "سترونتيوم", icon: "Sr", tier: 2, price: priceFor("strontium"), color: "#e084b8" },
  { id: "yttrium", name: "إيتريوم", icon: "Y", tier: 2, price: priceFor("yttrium"), color: "#e08984" },
  { id: "zirconium", name: "زركونيوم", icon: "Zr", tier: 2, price: priceFor("zirconium"), color: "#e0c184" },
  { id: "niobium", name: "نيوبيوم", icon: "Nb", tier: 2, price: priceFor("niobium"), color: "#c6e084" },
  { id: "molybdenum", name: "موليبدنوم", icon: "Mo", tier: 2, price: priceFor("molybdenum"), color: "#8de084" },
  { id: "ruthenium", name: "روثينيوم", icon: "Ru", tier: 2, price: priceFor("ruthenium"), color: "#84d4e0" },
  { id: "rhodium", name: "روديوم", icon: "Rh", tier: 2, price: priceFor("rhodium"), color: "#849be0" },
  { id: "palladium", name: "بالاديوم", icon: "Pd", tier: 2, price: priceFor("palladium"), color: "#a684e0" },
  { id: "cadmium", name: "كادميوم", icon: "Cd", tier: 2, price: priceFor("cadmium"), color: "#e084a9" },
  { id: "indium", name: "إنديوم", icon: "In", tier: 2, price: priceFor("indium"), color: "#e09884" },
  { id: "antimony", name: "أنتيمون", icon: "Sb", tier: 2, price: priceFor("antimony"), color: "#b7e084" },
  { id: "tellurium", name: "تيلوريوم", icon: "Te", tier: 2, price: priceFor("tellurium"), color: "#84e08a" },
  { id: "xenon", name: "زينون", icon: "Xe", tier: 2, price: priceFor("xenon"), color: "#84c4e0" },
  { id: "cesium", name: "سيزيوم", icon: "Cs", tier: 2, price: priceFor("cesium"), color: "#848ce0" },
  { id: "barium", name: "باريوم", icon: "Ba", tier: 2, price: priceFor("barium"), color: "#b584e0" },
  { id: "lanthanum", name: "لانثانوم", icon: "La", tier: 2, price: priceFor("lanthanum"), color: "#e084d2" },
  { id: "cerium", name: "سيريوم", icon: "Ce", tier: 2, price: priceFor("cerium"), color: "#e0849a" },
  { id: "praseodymium", name: "براسيوديميوم", icon: "Pr", tier: 2, price: priceFor("praseodymium"), color: "#e0a784" },
  { id: "neodymium", name: "نيوديميوم", icon: "Nd", tier: 2, price: priceFor("neodymium"), color: "#e0e084" },
  { id: "samarium", name: "ساماريوم", icon: "Sm", tier: 2, price: priceFor("samarium"), color: "#84e09a" },
  { id: "europium", name: "يوروبيوم", icon: "Eu", tier: 2, price: priceFor("europium"), color: "#84e0d2" },
  { id: "gadolinium", name: "غادولينيوم", icon: "Gd", tier: 2, price: priceFor("gadolinium"), color: "#84b5e0" },
  { id: "terbium", name: "تيربيوم", icon: "Tb", tier: 2, price: priceFor("terbium"), color: "#8c84e0" },
  { id: "dysprosium", name: "ديسبروسيوم", icon: "Dy", tier: 2, price: priceFor("dysprosium"), color: "#c484e0" },
  { id: "holmium", name: "هولميوم", icon: "Ho", tier: 2, price: priceFor("holmium"), color: "#e084c3" },
  { id: "erbium", name: "إربيوم", icon: "Er", tier: 2, price: priceFor("erbium"), color: "#e0848a" },
  { id: "thulium", name: "ثوليوم", icon: "Tm", tier: 2, price: priceFor("thulium"), color: "#e0b784" },
  { id: "ytterbium", name: "إيتربيوم", icon: "Yb", tier: 2, price: priceFor("ytterbium"), color: "#d1e084" },
  { id: "lutetium", name: "لوتيتيوم", icon: "Lu", tier: 2, price: priceFor("lutetium"), color: "#98e084" },
  { id: "hafnium", name: "هافنيوم", icon: "Hf", tier: 2, price: priceFor("hafnium"), color: "#84e0a9" },
  { id: "tantalum", name: "تانتالوم", icon: "Ta", tier: 2, price: priceFor("tantalum"), color: "#84dee0" },
  { id: "rhenium", name: "رينيوم", icon: "Re", tier: 2, price: priceFor("rhenium"), color: "#9b84e0" },
  { id: "osmium", name: "أوسميوم", icon: "Os", tier: 2, price: priceFor("osmium"), color: "#d484e0" },
  { id: "iridium", name: "إيريديوم", icon: "Ir", tier: 2, price: priceFor("iridium"), color: "#e084b4" },
  { id: "thallium", name: "ثاليوم", icon: "Tl", tier: 2, price: priceFor("thallium"), color: "#89e084" },
  { id: "bismuth", name: "بزموث", icon: "Bi", tier: 2, price: priceFor("bismuth"), color: "#84cfe0" },
  { id: "technetium", name: "تكنيشيوم", icon: "Tc", tier: 2, price: priceFor("technetium", true), color: "#84e0b4", radioactive: true },
  { id: "promethium", name: "بروميثيوم", icon: "Pm", tier: 2, price: priceFor("promethium", true), color: "#a7e084", radioactive: true },
  { id: "polonium", name: "بولونيوم", icon: "Po", tier: 2, price: priceFor("polonium", true), color: "#8496e0", radioactive: true },
  { id: "astatine", name: "أستاتين", icon: "At", tier: 2, price: priceFor("astatine", true), color: "#aa84e0", radioactive: true },
  { id: "radon", name: "رادون", icon: "Rn", tier: 2, price: priceFor("radon", true), color: "#e084dd", radioactive: true },
  { id: "francium", name: "فرانسيوم", icon: "Fr", tier: 2, price: priceFor("francium", true), color: "#e084a4", radioactive: true },
  { id: "actinium", name: "أكتينيوم", icon: "Ac", tier: 2, price: priceFor("actinium", true), color: "#e0d584", radioactive: true },
  { id: "thorium", name: "ثوريوم", icon: "Th", tier: 2, price: priceFor("thorium", true), color: "#b2e084", radioactive: true },
  { id: "protactinium", name: "بروتكتينيوم", icon: "Pa", tier: 2, price: priceFor("protactinium", true), color: "#84e08f", radioactive: true },
  { id: "neptunium", name: "نبتونيوم", icon: "Np", tier: 2, price: priceFor("neptunium", true), color: "#84c0e0", radioactive: true },
  { id: "americium", name: "أمريسيوم", icon: "Am", tier: 2, price: priceFor("americium", true), color: "#ba84e0", radioactive: true },
  { id: "curium", name: "كوريوم", icon: "Cm", tier: 2, price: priceFor("curium", true), color: "#e084ce", radioactive: true },
  { id: "berkelium", name: "بيركيليوم", icon: "Bk", tier: 2, price: priceFor("berkelium", true), color: "#e08495", radioactive: true },
  { id: "californium", name: "كاليفورنيوم", icon: "Cf", tier: 2, price: priceFor("californium", true), color: "#e0ac84", radioactive: true },
  { id: "einsteinium", name: "أينشتاينيوم", icon: "Es", tier: 2, price: priceFor("einsteinium", true), color: "#dbe084", radioactive: true },
  { id: "fermium", name: "فيرميوم", icon: "Fm", tier: 2, price: priceFor("fermium", true), color: "#a3e084", radioactive: true },
  { id: "mendelevium", name: "مندليفيوم", icon: "Md", tier: 2, price: priceFor("mendelevium", true), color: "#84e09e", radioactive: true },
  { id: "nobelium", name: "نوبيليوم", icon: "No", tier: 2, price: priceFor("nobelium", true), color: "#84e0d7", radioactive: true },
  { id: "lawrencium", name: "لورنسيوم", icon: "Lr", tier: 2, price: priceFor("lawrencium", true), color: "#84b0e0", radioactive: true },
  { id: "rutherfordium", name: "رذرفورديوم", icon: "Rf", tier: 2, price: priceFor("rutherfordium", true), color: "#9084e0", radioactive: true },
  { id: "dubnium", name: "دوبنيوم", icon: "Db", tier: 2, price: priceFor("dubnium", true), color: "#c984e0", radioactive: true },
  { id: "seaborgium", name: "سيبورغيوم", icon: "Sg", tier: 2, price: priceFor("seaborgium", true), color: "#e084be", radioactive: true },
  { id: "bohrium", name: "بوهريوم", icon: "Bh", tier: 2, price: priceFor("bohrium", true), color: "#e08486", radioactive: true },
  { id: "hassium", name: "هاسيوم", icon: "Hs", tier: 2, price: priceFor("hassium", true), color: "#e0bb84", radioactive: true },
  { id: "meitnerium", name: "مايتنريوم", icon: "Mt", tier: 2, price: priceFor("meitnerium", true), color: "#cce084", radioactive: true },
  { id: "darmstadtium", name: "دارمشتاتيوم", icon: "Ds", tier: 2, price: priceFor("darmstadtium", true), color: "#93e084", radioactive: true },
  { id: "roentgenium", name: "رونتجينيوم", icon: "Rg", tier: 2, price: priceFor("roentgenium", true), color: "#84e0ad", radioactive: true },
  { id: "copernicium", name: "كوبرنيسيوم", icon: "Cn", tier: 2, price: priceFor("copernicium", true), color: "#84dae0", radioactive: true },
  { id: "nihonium", name: "نيهونيوم", icon: "Nh", tier: 2, price: priceFor("nihonium", true), color: "#84a1e0", radioactive: true },
  { id: "flerovium", name: "فليروفيوم", icon: "Fl", tier: 2, price: priceFor("flerovium", true), color: "#a084e0", radioactive: true },
  { id: "moscovium", name: "موسكوفيوم", icon: "Mc", tier: 2, price: priceFor("moscovium", true), color: "#d884e0", radioactive: true },
  { id: "livermorium", name: "ليفرموريوم", icon: "Lv", tier: 2, price: priceFor("livermorium", true), color: "#e084af", radioactive: true },
  { id: "tennessine", name: "تينيسين", icon: "Ts", tier: 2, price: priceFor("tennessine", true), color: "#e09284", radioactive: true },
  { id: "oganesson", name: "أوغانيسون", icon: "Og", tier: 2, price: priceFor("oganesson", true), color: "#e0ca84", radioactive: true },
  { id: "uranium", name: "يورانيوم", icon: "U", tier: 3, price: 0, color: "#a3e635", radioactive: true },
  { id: "radium", name: "راديوم", icon: "Ra", tier: 3, price: 0, color: "#4ade80", radioactive: true },
  { id: "plutonium", name: "بلوتونيوم", icon: "Pu", tier: 3, price: 0, color: "#facc15", radioactive: true },
  { id: "waste", name: "نفايات كيميائية", icon: "∅", tier: 3, price: 0, color: "#65a30d" },
];

export const ELEMENT_MAP = Object.fromEntries(ELEMENTS.map((e) => [e.id, e]));
