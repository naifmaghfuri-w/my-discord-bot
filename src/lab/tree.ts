/**
 * شجرة الفتح: 50 صفحة (كل صفحة مستوى). كل صفحة فيها عناصر + آلة + مساعد (وأحياناً تقنية)،
 * وتُفتح كاملة بنقاط الفتح بعد الوصول لمستواها.
 */
export const TREE_LEVELS = 50;

/** تكلفة فتح صفحة بنقاط الفتح (3 للمستويات 1-40، و2 بعدها) */
export const pageCost = (page: number): number => (page <= 40 ? 3 : 2);

/** مفتاح الصفحة المفتوحة داخل قائمة engrams بملف اللاعب */
export const pageKey = (page: number): string => `pg:${page}`;

export const pageUnlocked = (p: { engrams?: string[] }, page: number): boolean => (p.engrams ?? []).includes(pageKey(page));

/* ───────────── تأثيرات الآلات والمساعدين ───────────── */

export type FxKey = "xp" | "sell" | "yield" | "shop" | "robot" | "loot" | "order" | "safe" | "rad" | "hint" | "tol";

export const FX: Record<FxKey, { per: number; cap: number; text: string }> = {
  xp: { per: 0.02, cap: 0.5, text: "+2% خبرة كل تفاعل ناجح" },
  sell: { per: 0.015, cap: 0.3, text: "+1.5% سعر بيع النواتج" },
  yield: { per: 0.01, cap: 0.2, text: "+1% فرصة مضاعفة الناتج" },
  shop: { per: 0.01, cap: 0.3, text: "-1% سعر عناصر المتجر" },
  robot: { per: 0.03, cap: 0.5, text: "+3% سرعة الروبوت" },
  loot: { per: 0.04, cap: 0.6, text: "+4% فرصة غنيمة إضافية بالاستكشاف" },
  order: { per: 0.02, cap: 0.5, text: "+2% مكافأة طلبات العملاء" },
  safe: { per: 0.02, cap: 0.4, text: "-2% احتمال حوادث المختبر" },
  rad: { per: 0.03, cap: 0.6, text: "-3% تراكم الإشعاع" },
  hint: { per: 0.02, cap: 0.4, text: "-2% سعر التلميحات" },
  tol: { per: 1, cap: 20, text: "+1° هامش الحرارة" },
};

export interface TreeItem {
  id: string;
  name: string;
  icon: string;
  desc: string;
  fx?: FxKey;
  /** جهاز قديم له منطق خاص (يُشترى بالرصيد من قائمة الأجهزة) */
  legacy: boolean;
}

export interface TechItem {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

/* ───────────── العناصر ───────────── */

const BASE = ["sulfur", "nitrogen", "sodium", "copper", "chlorine", "calcium", "potassium", "lithium", "phosphorus", "tin", "lead", "fluorine", "iodine", "gold", "silver", "helium", "mercury", "neon", "titanium"];
const STABLE = [
  "beryllium", "boron", "argon", "scandium", "vanadium", "chromium", "manganese", "cobalt", "nickel", "platinum",
  "gallium", "germanium", "arsenic", "selenium", "bromine", "krypton", "rubidium", "strontium", "yttrium", "zirconium",
  "niobium", "molybdenum", "tungsten", "ruthenium", "rhodium", "palladium", "cadmium", "indium", "antimony", "tellurium",
  "xenon", "cesium", "barium", "lanthanum", "cerium", "praseodymium", "neodymium", "samarium", "europium", "gadolinium",
  "terbium", "dysprosium", "holmium", "erbium", "thulium", "ytterbium", "lutetium", "hafnium", "tantalum", "rhenium",
  "osmium", "iridium", "thallium", "bismuth",
];
const RADIO = [
  "technetium", "promethium", "polonium", "astatine", "radon", "francium", "actinium", "thorium", "protactinium", "neptunium",
  "americium", "curium", "berkelium", "californium", "einsteinium", "fermium", "mendelevium", "nobelium", "lawrencium", "rutherfordium",
  "dubnium", "seaborgium", "bohrium", "hassium", "meitnerium", "darmstadtium", "roentgenium", "copernicium", "nihonium", "flerovium",
  "moscovium", "livermorium", "tennessine", "oganesson",
];

/** كل عناصر الشجرة بالترتيب (من الأسهل للأصعب) */
export const TREE_ELEMENT_IDS: string[] = [...BASE, ...STABLE, ...RADIO];
export const RADIOACTIVE_NEW = new Set(RADIO);

/** توزيع عادل: كل صفحة فيها عنصران على الأقل */
export const ELEMENT_PAGE: Record<string, number> = Object.fromEntries(
  TREE_ELEMENT_IDS.map((id, i) => [id, Math.floor((i * TREE_LEVELS) / TREE_ELEMENT_IDS.length) + 1]),
);

export const ELEMENTS_BY_PAGE: string[][] = Array.from({ length: TREE_LEVELS }, (_, i) =>
  TREE_ELEMENT_IDS.filter((id) => ELEMENT_PAGE[id] === i + 1),
);

/* ───────────── الآلات والمساعدون ───────────── */

type Pair = [string, string];

const fxDesc = (fx: FxKey) => FX[fx].text;

const MACHINE_GROUPS: [FxKey, Pair[]][] = [
  ["xp", [["مطياف الكتلة", "📊"], ["جهاز الرنين", "🧲"], ["حاسوب التحليل", "💻"], ["مسرّع الجسيمات", "⚛️"], ["مجهر إلكتروني", "🔭"], ["ماسح ضوئي", "🖨️"], ["ذكاء المختبر", "🧠"]]],
  ["sell", [["آلة تغليف", "📦"], ["ختم الجودة", "🏷️"], ["مصنع تعبئة", "🏭"], ["مصعد بضائع", "🛗"], ["شاحنة توزيع", "🚚"], ["مستودع مبرّد", "🏬"], ["بوابة التصدير", "🚢"]]],
  ["yield", [["مكثّف بخار", "💧"], ["مفاعل دفعات", "♻️"], ["مرشّح نانوي", "🧫"], ["مبلور", "💎"], ["مجفف تجميدي", "❄️"], ["فاصل غشائي", "🪣"]]],
  ["shop", [["عقد توريد", "📝"], ["مخزن جملة", "🏪"], ["مورّد معتمد", "🤝"], ["كود خصم", "🎟️"], ["اتفاقية كميات", "📜"], ["مزاد عناصر", "🔨"]]],
  ["robot", [["محرك سيرفو", "⚙️"], ["ذراع آلية", "🦾"], ["حزام ناقل", "➰"], ["مستشعر ليزري", "🔦"], ["مبرّد معالج", "🌡️"], ["بطارية مدمجة", "🔋"], ["شاحن فائق", "⚡"]]],
  ["loot", [["خريطة معادن", "🗺️"], ["بوصلة مغناطيسية", "🧭"], ["مركبة حفر", "🚜"], ["طائرة مسيّرة", "🛸"], ["رادار أرضي", "📡"], ["كاشف معادن", "🔍"], ["حقيبة غنائم", "🎒"]]],
  ["order", [["نظام فواتير", "🧾"], ["سيارة توصيل", "🚗"], ["مكتب علاقات", "💼"], ["شهادة جودة", "🏅"], ["واجهة متجر", "🏪"], ["عقد حصري", "✍️"]]],
];

const HELPER_GROUPS: [FxKey, Pair[]][] = [
  ["safe", [["حوض غسل العيون", "👁️"], ["خزانة أبخرة", "🗄️"], ["قناع واقٍ", "😷"], ["حذاء عازل", "🥾"], ["مئزر مختبر", "🧥"], ["درع واقٍ", "🛡️"], ["إنذار دخان", "🚨"], ["رشاش طوارئ", "🚿"], ["بطانية حريق", "🧣"], ["صندوق إسعاف", "🧰"], ["خوذة سلامة", "⛑️"], ["حاجز زجاجي", "🪟"]]],
  ["rad", [["رصاص عازل", "🧱"], ["سترة رصاصية", "🦺"], ["ملف جرعات", "📋"], ["غرفة عزل", "🚪"], ["مرشّح هواء", "🌫️"], ["حبوب اليود", "💊"], ["قفاز رصاصي", "🧤"], ["حوض تبريد", "💦"], ["نظام تهوية", "🌬️"], ["ستارة واقية", "🎴"], ["مقياس تعرّض", "⏱️"], ["قبو محصّن", "🏛️"]]],
  ["hint", [["كتاب كيمياء", "📖"], ["مكتبة مرجعية", "📚"], ["موسوعة العناصر", "📘"], ["قاعدة بيانات", "🗃️"], ["دفتر ملاحظات", "📓"], ["لوحة الجدول الدوري", "🧮"], ["بروفيسور مرشد", "👨‍🏫"], ["حاسبة علمية", "🔢"], ["أرشيف أبحاث", "🗂️"], ["منصة محاكاة", "🖥️"], ["اشتراك مجلة علمية", "📰"], ["مساعد باحث", "🧑‍🔬"]]],
  ["tol", [["مقياس حرارة دقيق", "🌡️"], ["ملف تسخين", "♨️"], ["ثرموستات ذكي", "📈"], ["غلاف خزفي", "🏺"], ["مروحة تبريد", "🪭"], ["حمام مائي", "🛁"], ["حمام زيتي", "🛢️"], ["منظّم ضغط", "🎚️"], ["حساس ضغط", "📏"], ["صمام أمان", "🔧"], ["عازل فراغي", "🫙"]]],
];

/** يرتّب المجموعات بالتناوب (واحد من كل نوع) عشان تتوزع التأثيرات على المستويات */
function interleave(groups: [FxKey, Pair[]][], prefix: string): TreeItem[] {
  const out: TreeItem[] = [];
  const counters: Record<string, number> = {};
  let left = groups.reduce((a, [, p]) => a + p.length, 0);
  const idx = groups.map(() => 0);
  while (left > 0) {
    groups.forEach(([fx, pairs], g) => {
      if (idx[g] >= pairs.length) return;
      const [name, icon] = pairs[idx[g]++];
      counters[fx] = (counters[fx] ?? 0) + 1;
      out.push({ id: `${prefix}_${fx}${counters[fx]}`, name, icon, desc: fxDesc(fx), fx, legacy: false });
      left--;
    });
  }
  return out;
}

const LEGACY_MACHINES: Record<number, TreeItem> = {
  5: { id: "centrifuge", name: "الطرد المركزي", icon: "🌀", desc: "يستخلص عناصر من النفايات الكيميائية", legacy: true },
  7: { id: "distiller", name: "وحدة التقطير", icon: "⚗️", desc: "فرصة 25% لمضاعفة ناتج كل تفاعل ناجح", legacy: true },
  9: { id: "robot", name: "الروبوت الآلي", icon: "🤖", desc: "يصنّع لك مركبات تعرفها وأنت غايب", legacy: true },
  10: { id: "cooler", name: "مبرّد المفاعل", icon: "🧊", desc: "يبطّئ تراكم الإشعاع ويقصّر مدة الإصابة", legacy: true },
};

const LEGACY_HELPERS: Record<number, TreeItem> = {
  3: { id: "extinguisher", name: "طفاية الحريق", icon: "🧯", desc: "تقلل احتمال حوادث المختبر", legacy: true },
  4: { id: "analyzer", name: "المحلّل (المجهر)", icon: "🔬", desc: "يخفّض سعر التلميحات 50% ويلمّح لك لما يكون خليطك ناقصاً", legacy: true },
  6: { id: "geiger", name: "عدّاد جايغر", icon: "📟", desc: "يقيس إشعاعك بدقة ويحذّرك قبل الخطر", legacy: true },
};

function fill(legacy: Record<number, TreeItem>, queue: TreeItem[]): TreeItem[] {
  let q = 0;
  return Array.from({ length: TREE_LEVELS }, (_, i) => legacy[i + 1] ?? queue[q++]);
}

/** الآلة بكل صفحة (فهرس 0 = صفحة 1) */
export const MACHINE_BY_PAGE: TreeItem[] = fill(LEGACY_MACHINES, interleave(MACHINE_GROUPS, "m"));
/** المساعد بكل صفحة */
export const HELPER_BY_PAGE: TreeItem[] = fill(LEGACY_HELPERS, interleave(HELPER_GROUPS, "h"));

/* ───────────── التقنيات (تفتح وصفات) ───────────── */

export const TECH_BY_PAGE: Record<number, TechItem[]> = {
  6: [
    { id: "chem_advanced", name: "الكيمياء المتقدمة", icon: "🧪", desc: "الهيدروفلوريك والمحلول المطهّر" },
    { id: "metallurgy", name: "علم المعادن", icon: "⚒️", desc: "النحاس الأصفر واللحام" },
  ],
  8: [{ id: "optics", name: "البصريات", icon: "🔭", desc: "الزجاج البصري ومصباح النيون" }],
  12: [{ id: "adv_metal", name: "السبائك المتقدمة", icon: "🛩️", desc: "سبيكة الطيران وفتيلة التنغستن" }],
  14: [{ id: "electronics", name: "الإلكترونيات", icon: "💾", desc: "المعالج الدقيق والمحفّز البلاتيني" }],
  16: [{ id: "nuclear", name: "الكيمياء النووية", icon: "☢️", desc: "المواد المشعة المتقدمة (بدلة الحماية مطلوبة)" }],
};

/* ───────────── حساب التأثيرات ───────────── */

/** صفحات الشجرة اللي فيها عنصر بهذا التأثير */
const FX_PAGES: Record<string, number[]> = {};
[MACHINE_BY_PAGE, HELPER_BY_PAGE].forEach((list) =>
  list.forEach((item, i) => {
    if (item.fx) (FX_PAGES[item.fx] ??= []).push(i + 1);
  }),
);

/** مجموع تأثير معيّن من صفحات الشجرة المفتوحة (مع الحد الأقصى) */
export function passive(p: { engrams?: string[] }, fx: FxKey): number {
  const owned = new Set(p.engrams ?? []);
  const n = (FX_PAGES[fx] ?? []).filter((page) => owned.has(pageKey(page))).length;
  return Math.min(FX[fx].cap, Math.round(n * FX[fx].per * 1000) / 1000);
}
