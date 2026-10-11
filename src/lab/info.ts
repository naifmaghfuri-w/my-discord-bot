/**
 * معلومات تعليمية لكل مركب.
 * real: وصفة حقيقية | simplified: مبسّطة للعبة | fantasy: خيالية (ما لها وجود أو وصفتها خطرة فما نحاكيها)
 */
export type Realism = "real" | "simplified" | "fantasy";

export interface CompoundInfo {
  formula: string;
  type: string;
  fact: string;
  real: Realism;
}

export const REALISM_LABEL: Record<Realism, string> = {
  real: "🟢 وصفة حقيقية",
  simplified: "🟡 مبسّطة للعبة",
  fantasy: "🟣 خيالية",
};

export const COMPOUND_INFO: Record<string, CompoundInfo> = {
  co2: { formula: "CO₂", type: "احتراق / اتحاد", fact: "غاز ينتج من الاحتراق والتنفس، والنباتات تمتصه في البناء الضوئي.", real: "real" },
  rust: { formula: "Fe₂O₃", type: "أكسدة", fact: "الحديد يتأكسد مع الأكسجين والرطوبة فيتكوّن الصدأ.", real: "real" },
  saline: { formula: "NaCl(aq)", type: "ذوبان", fact: "الملح يذوب في الماء فيتفكك إلى أيونات الصوديوم والكلوريد.", real: "real" },
  methane: { formula: "CH₄", type: "اتحاد", fact: "أبسط هيدروكربون، وهو المكوّن الرئيسي للغاز الطبيعي.", real: "real" },
  steam: { formula: "H₂O(g)", type: "تغيّر حالة", fact: "الماء يغلي عند 100° فيتحوّل إلى بخار، وهذا تغيّر فيزيائي لا كيميائي.", real: "real" },
  soap: { formula: "RCOONa", type: "تصبّن", fact: "الصابون الحقيقي ينتج من تفاعل دهون مع قاعدة قوية، والوصفة هنا مبسّطة.", real: "simplified" },
  hydrogen_peroxide: { formula: "H₂O₂", type: "اتحاد", fact: "يتحلل ببطء إلى ماء وأكسجين، ويُستخدم كمطهّر ومبيّض.", real: "real" },
  graphite: { formula: "C", type: "شكل متآصل", fact: "الجرافيت والألماس كلاهما كربون نقي، لكن ترتيب الذرات يختلف.", real: "simplified" },
  steel: { formula: "Fe + C", type: "سبيكة", fact: "الفولاذ حديد مع نسبة صغيرة من الكربون تجعله أقسى من الحديد النقي.", real: "real" },
  soda_water: { formula: "H₂CO₃", type: "ذوبان غاز", fact: "ثاني أكسيد الكربون يذوب أكثر في البرودة والضغط العالي، ولهذا الفقاعات.", real: "real" },

  sulfuric_acid: { formula: "H₂SO₄", type: "حمض", fact: "أكثر مواد الصناعة استهلاكًا في العالم، وهو حمض قوي وأكّال.", real: "real" },
  ammonia: { formula: "NH₃", type: "عملية هابر", fact: "يُصنّع بحرارة وضغط عاليين مع محفّز، وهو أساس الأسمدة النيتروجينية.", real: "real" },
  ethanol: { formula: "C₂H₆O", type: "تخمّر", fact: "ينتج من تخمّر السكر بالخميرة، ويُستخدم وقودًا ومذيبًا ومعقّمًا.", real: "real" },
  quicklime: { formula: "CaO", type: "تحلل حراري", fact: "ينتج من تسخين حجر الجير فيتحلل إلى جير حي وثاني أكسيد الكربون.", real: "real" },
  bronze: { formula: "Cu + Sn", type: "سبيكة", fact: "البرونز الحقيقي نحاس مع قصدير. الوصفة هنا مبسّطة لأن القصدير غير موجود.", real: "simplified" },
  fertilizer: { formula: "NaNO₃", type: "ملح", fact: "نترات الصوديوم كانت من أقدم الأسمدة المستخدمة وتوفّر النيتروجين للنبات.", real: "real" },
  hcl: { formula: "HCl", type: "حمض", fact: "حمض المعدة يحتوي HCl مخفّفًا يساعد على هضم الطعام.", real: "real" },
  disinfectant: { formula: "Cl₂(aq)", type: "ذوبان", fact: "الكلور المذاب في الماء يقتل الجراثيم، ولهذا يُستخدم في المسابح.", real: "real" },
  bleach: { formula: "NaOCl", type: "أكسدة", fact: "هيبوكلوريت الصوديوم مبيّض قوي، ولا تخلطه أبدًا مع الأمونيا.", real: "real" },
  phosphoric_acid: { formula: "H₃PO₄", type: "حمض", fact: "يُستخدم في الأسمدة وفي بعض المشروبات الغازية كمنظّم للحموضة.", real: "real" },
  lime_water: { formula: "Ca(OH)₂", type: "قاعدة", fact: "ماء الجير يتعكّر عند إمرار ثاني أكسيد الكربون فيه، وهو اختبار معروف.", real: "real" },
  limestone: { formula: "CaCO₃", type: "ملح", fact: "حجر الجير يتكوّن من هياكل كائنات بحرية قديمة، وهو مادة الطباشير والرخام.", real: "real" },
  silver_nitrate: { formula: "AgNO₃", type: "ملح", fact: "يتفاعل مع الكلوريد فيعطي راسبًا أبيض، ويُستخدم في المختبرات والتصوير القديم.", real: "real" },
  slag_glass: { formula: "—", type: "إعادة تدوير", fact: "الخبث الصناعي يمكن إعادة تدويره في الزجاج ومواد البناء.", real: "simplified" },

  gunpowder: { formula: "—", type: "خيالي", fact: "مركب اللعبة خيالي. المتفجرات الحقيقية خطيرة ولا تُجرّب خارج المختبرات المرخّصة.", real: "fantasy" },
  dye: { formula: "CuSO₄", type: "ملح", fact: "كبريتات النحاس زرقاء اللون وتُستخدم في الأصباغ ومبيدات الفطريات.", real: "real" },
  battery: { formula: "Cu | H₂SO₄", type: "خلية كهروكيميائية", fact: "البطارية تحوّل طاقة تفاعل كيميائي إلى كهرباء عبر تدفق الإلكترونات.", real: "simplified" },
  rocket_fuel: { formula: "—", type: "خيالي", fact: "وصفة اللعبة خيالية. الوقود الحقيقي يتطلب هندسة معقدة وإجراءات سلامة صارمة.", real: "fantasy" },
  synthetic_ruby: { formula: "Al₂O₃ : Cr", type: "بلورة", fact: "الياقوت أكسيد الألمنيوم مع أثر كروم يعطيه لونه الأحمر. الوصفة هنا مبسّطة.", real: "simplified" },
  gold_alloy: { formula: "Au + Cu", type: "سبيكة", fact: "الذهب النقي لين، فيُخلط بالنحاس ليصير أصلب (عيار 18 مثلًا).", real: "real" },
  matches: { formula: "P₄S₃ ...", type: "احتراق", fact: "رؤوس الثقاب الحديثة تحتوي مركّبات الفوسفور والكبريت وتشتعل بالاحتكاك.", real: "simplified" },
  li_battery: { formula: "Li⁺", type: "خلية كهروكيميائية", fact: "بطاريات الليثيوم خفيفة وتخزّن طاقة كبيرة، وهي في هاتفك الآن.", real: "simplified" },
  silver_mirror: { formula: "Ag", type: "اختزال", fact: "تفاعل مرآة الفضة يرسّب طبقة فضة لامعة على الزجاج.", real: "simplified" },
  heliox: { formula: "He + O₂", type: "خليط غازات", fact: "يستخدمه الغواصون في الأعماق لأن الهيليوم يخفف مشاكل التخدير النيتروجيني.", real: "real" },
  cement: { formula: "—", type: "خليط", fact: "الإسمنت الحقيقي حجر جير وطين يُسخَّنان في أفران ضخمة ثم يُطحنان.", real: "simplified" },
  recycled_fuel: { formula: "—", type: "إعادة تدوير", fact: "تحويل النفايات إلى وقود فكرة حقيقية تُطبّق بتقنيات مثل الانحلال الحراري.", real: "simplified" },

  superalloy: { formula: "—", type: "سبيكة", fact: "السبائك الفائقة تتحمل حرارة وإجهادًا عاليين، وتُستخدم في محركات الطائرات.", real: "simplified" },
  explosive_core: { formula: "—", type: "خيالي", fact: "مركب اللعبة خيالي بالكامل.", real: "fantasy" },
  nano_catalyst: { formula: "—", type: "محفّز", fact: "المحفّزات تسرّع التفاعل بدون أن تُستهلك، والنانوية منها لها مساحة سطح هائلة.", real: "simplified" },
  bio_serum: { formula: "—", type: "خيالي", fact: "مصل اللعبة خيالي، واللقاحات الحقيقية تمر بسنوات من الاختبارات.", real: "fantasy" },
  midas_touch: { formula: "—", type: "خيالي", fact: "اسمها من الأسطورة الإغريقية للملك ميداس الذي يحوّل كل شيء لذهب.", real: "fantasy" },
  thermite: { formula: "—", type: "خيالي", fact: "مركب اللعبة خيالي. التفاعلات الحقيقية من هذا النوع خطيرة جدًا.", real: "fantasy" },
  plasma_cell: { formula: "—", type: "خيالي", fact: "البلازما هي الحالة الرابعة للمادة، وهي موجودة في البرق والشمس.", real: "fantasy" },
  silver_serum: { formula: "—", type: "خيالي", fact: "الفضة لها خصائص مضادة للميكروبات تُستخدم فعلًا في الضمادات.", real: "fantasy" },
  royal_alloy: { formula: "Au + Ag", type: "سبيكة", fact: "الذهب والفضة يُخلطان في سبيكة تُسمى الإلكتروم، وكانت تُسك منها عملات قديمة.", real: "simplified" },
  gold_from_waste: { formula: "Au", type: "استخلاص", fact: "الذهب يُستخلص فعلًا من النفايات الإلكترونية، وهو ما يسمى التعدين الحضري.", real: "simplified" },

  philosophers_stone: { formula: "—", type: "خيالي", fact: "حجر الفلاسفة حلم الكيميائيين القدماء بتحويل المعادن إلى ذهب.", real: "fantasy" },
  elixir_of_life: { formula: "—", type: "خيالي", fact: "إكسير الحياة أسطورة قديمة، وبحث عنه كيميائيو الصين والعرب والأوروبيون.", real: "fantasy" },
  quantum_crystal: { formula: "—", type: "خيالي", fact: "البلورات الحقيقية تُستخدم في الساعات والحواسيب الكمّية.", real: "fantasy" },
  antimatter_seed: { formula: "—", type: "خيالي", fact: "المادة المضادة حقيقية لكنها تُنتج بكميات ضئيلة جدًا في المسرّعات.", real: "fantasy" },
  eternal_flame: { formula: "—", type: "خيالي", fact: "اسم من الخيال، ولا يوجد لهب يشتعل بلا وقود.", real: "fantasy" },
  genesis_cell: { formula: "—", type: "خيالي", fact: "اسم من الخيال العلمي عن خلية تبني الحياة من الصفر.", real: "fantasy" },

  uo2: { formula: "UO₂", type: "أكسيد", fact: "قرصات ثاني أكسيد اليورانيوم هي وقود المفاعلات النووية المدنية.", real: "real" },
  reactor_core: { formula: "—", type: "مفاعل", fact: "في المحطة النووية تسخّن الانشطارات الماء فيصير بخارًا يدير توربينات الكهرباء. الوصفة هنا مبسّطة.", real: "simplified" },
  silica: { formula: "SiO₂", type: "أكسيد", fact: "الرمل والكوارتز سيليكا تقريباً نقية، وهي المادة الخام للزجاج.", real: "real" },
  alumina: { formula: "Al₂O₃", type: "أكسيد", fact: "الألمنيوم يتغطى بطبقة أكسيد رقيقة تحميه من التآكل.", real: "real" },
  galvanized: { formula: "Fe + Zn", type: "طلاء", fact: "تغطية الحديد بالزنك تحميه من الصدأ لأن الزنك يتأكسد أولاً.", real: "real" },
  magnesia: { formula: "Mg(OH)₂", type: "قاعدة", fact: "حليب المغنيسيا يُستخدم كمضاد حموضة وملين خفيف.", real: "real" },
  soot: { formula: "C", type: "ناتج جانبي", fact: "السخام كربون ناتج عن احتراق ناقص للمواد العضوية.", real: "real" },
  tar: { formula: "—", type: "ناتج جانبي", fact: "القطران يتكوّن من التسخين الشديد للمواد العضوية بدون هواء كافٍ، والوصفة هنا مبسّطة.", real: "simplified" },
  brass: { formula: "Cu + Zn", type: "سبيكة", fact: "النحاس الأصفر سبيكة نحاس وزنك، تُستخدم في الآلات الموسيقية والصنابير.", real: "real" },
  cinnabar: { formula: "HgS", type: "معدن", fact: "الزنجفر خام الزئبق الأساسي، وكان يُستخدم صبغة حمراء قديماً وهو سام.", real: "real" },
  saltpeter: { formula: "KNO₃", type: "ملح", fact: "نترات البوتاسيوم تُستخدم في الأسمدة وحفظ الأطعمة التقليدية.", real: "real" },
  solder: { formula: "Sn + Pb", type: "سبيكة", fact: "اللحام يذوب بحرارة منخفضة فيربط القطع الإلكترونية. الحديث منه بدون رصاص.", real: "real" },
  iodine_solution: { formula: "I₂ / C₂H₆O", type: "محلول", fact: "صبغة اليود مطهّر قديم للجروح تُستخدم في الإسعافات.", real: "real" },
  hf: { formula: "HF", type: "حمض", fact: "حمض الهيدروفلوريك يذيب الزجاج وخطير جداً على الجلد، ولا يُستخدم إلا بمختبرات متخصصة.", real: "real" },
  mg_flash: { formula: "MgO", type: "احتراق", fact: "المغنيسيوم يحترق بلهب أبيض ساطع، وكان يُستخدم في فلاش التصوير القديم.", real: "real" },
  caustic: { formula: "NaOH", type: "قاعدة", fact: "الصوديوم مع الماء يتفاعل بعنف وينتج قاعدة قوية تُسمى الصودا الكاوية.", real: "real" },
  iron_chloride: { formula: "FeCl₂", type: "ملح", fact: "كلوريد الحديد يُستخدم في معالجة المياه وصناعة الدوائر المطبوعة.", real: "real" },
  h2s: { formula: "H₂S", type: "غاز", fact: "غاز برائحة البيض الفاسد، وهو سام بتراكيز عالية.", real: "real" },
  optical_glass: { formula: "SiO₂ + Na₂O", type: "زجاج", fact: "الزجاج البصري نقي جداً لصنع العدسات والمناظير.", real: "simplified" },
  neon_lamp: { formula: "Ne", type: "تفريغ كهربائي", fact: "غاز النيون يتوهج بلون أحمر برتقالي عند مرور الكهرباء فيه.", real: "real" },
  gold_amalgam: { formula: "Au + Hg", type: "ملغم", fact: "كان الذهب يُستخلص من الخام بالزئبق، وهي طريقة خطرة على البيئة والصحة.", real: "real" },
  fluorite: { formula: "CaF₂", type: "معدن", fact: "الفلوريت معدن ملوّن، ومنه جاءت كلمة التفلور لأنه يتوهج تحت الأشعة فوق البنفسجية.", real: "real" },
  aircraft_alloy: { formula: "Ti + Al", type: "سبيكة", fact: "التيتانيوم مع الألمنيوم سبيكة خفيفة وقوية تُستخدم في هياكل الطائرات.", real: "real" },
  lead_battery: { formula: "Pb | H₂SO₄", type: "خلية كهروكيميائية", fact: "بطارية السيارات التقليدية رصاص وحمض كبريتيك، وتُعاد تدويرها بنسبة عالية.", real: "real" },
  microprocessor: { formula: "Si", type: "شبه موصل", fact: "المعالجات تُصنع من السيليكون، وبها مليارات الترانزستورات الدقيقة.", real: "simplified" },
  platinum_catalyst: { formula: "Pt", type: "محفّز", fact: "البلاتين محفّز ممتاز، وهو داخل عوادم السيارات ليقلل الغازات الضارة.", real: "real" },
  tungsten_filament: { formula: "W", type: "فتيلة", fact: "التنغستن أعلى الفلزات انصهاراً (أكثر من 3400°)، ولهذا استُخدم في المصابيح المتوهجة.", real: "real" },
  glow_clock: { formula: "Ra", type: "طلاء متوهج", fact: "الراديوم كان يُستخدم لطلاء الساعات المتوهجة، ثم تبيّن خطره الإشعاعي على العاملات. اللعبة تتطلب بدلة حماية.", real: "simplified" },
  nuclear_fuel: { formula: "—", type: "وقود", fact: "وصفة اللعبة خيالية مبسّطة. الوقود النووي الحقيقي يتطلب منشآت وتراخيص صارمة.", real: "fantasy" },
  atomic_battery: { formula: "—", type: "مولّد حراري إشعاعي", fact: "المركبات الفضائية البعيدة تُشغَّل ببطاريات تستفيد من حرارة اضمحلال مادة مشعة. وصفة اللعبة خيالية.", real: "fantasy" },
};

export interface ElementInfo {
  number: number;
  symbol: string;
  fact: string;
}

export const ELEMENT_INFO: Record<string, ElementInfo> = {
  hydrogen: { number: 1, symbol: "H", fact: "أخف عنصر وأكثرها وفرة في الكون." },
  oxygen: { number: 8, symbol: "O", fact: "يشكّل حوالي خُمس هواء الأرض وضروري للتنفس والاحتراق." },
  carbon: { number: 6, symbol: "C", fact: "أساس كل الكائنات الحية، ويكوّن ملايين المركبات." },
  iron: { number: 26, symbol: "Fe", fact: "العنصر الرئيسي في نواة الأرض، ويصدأ مع الرطوبة." },
  sulfur: { number: 16, symbol: "S", fact: "صلب أصفر يوجد قرب البراكين، ويدخل في صناعة حمض الكبريتيك." },
  nitrogen: { number: 7, symbol: "N", fact: "يشكّل 78% من الهواء، وهو أساس البروتينات والأسمدة." },
  sodium: { number: 11, symbol: "Na", fact: "فلز لين يتفاعل بعنف مع الماء، ولهذا يُحفظ تحت الزيت." },
  copper: { number: 29, symbol: "Cu", fact: "موصل ممتاز للكهرباء، ويُستخدم في الأسلاك منذ قرون." },
  chlorine: { number: 17, symbol: "Cl", fact: "غاز أخضر مصفر، يُستخدم في تعقيم المياه." },
  gold: { number: 79, symbol: "Au", fact: "لا يصدأ ولا يتأكسد، ولذلك يحتفظ ببريقه آلاف السنين." },
  lithium: { number: 3, symbol: "Li", fact: "أخف فلز، وأساس بطاريات الهواتف والسيارات الكهربائية." },
  silver: { number: 47, symbol: "Ag", fact: "أفضل موصل للكهرباء والحرارة بين كل الفلزات." },
  phosphorus: { number: 15, symbol: "P", fact: "ضروري للـ DNA والعظام، ويدخل في الأسمدة." },
  helium: { number: 2, symbol: "He", fact: "غاز نبيل خامل، ثاني أكثر العناصر وفرة في الكون." },
  calcium: { number: 20, symbol: "Ca", fact: "أساس العظام والأسنان، ويوجد في الحليب." },
  uranium: { number: 92, symbol: "U", fact: "عنصر مشع ثقيل، أغلبه اليورانيوم-238 ونسبة صغيرة اليورانيوم-235. يُستخدم وقودًا في المفاعلات، ويتطلب حماية من الإشعاع." },
  aluminum: { number: 13, symbol: "Al", fact: "أكثر فلز وفرة في القشرة الأرضية، خفيف ومقاوم للتآكل." },
  zinc: { number: 30, symbol: "Zn", fact: "يُستخدم في طلاء الحديد ومنع الصدأ، وضروري لجهاز المناعة." },
  magnesium: { number: 12, symbol: "Mg", fact: "فلز خفيف يحترق بلهب أبيض، وموجود في الكلوروفيل." },
  silicon: { number: 14, symbol: "Si", fact: "أساس الرمل والزجاج والرقائق الإلكترونية." },
  potassium: { number: 19, symbol: "K", fact: "فلز لين شديد التفاعل، وضروري لنبض القلب والأعصاب. الموز مصدر له." },
  tin: { number: 50, symbol: "Sn", fact: "يُستخدم في علب الحفظ واللحام ويدخل في البرونز." },
  lead: { number: 82, symbol: "Pb", fact: "فلز ثقيل وسام، كان يُستخدم قديماً في الأنابيب والدهانات." },
  mercury: { number: 80, symbol: "Hg", fact: "الفلز الوحيد السائل بدرجة حرارة الغرفة، وهو سام." },
  fluorine: { number: 9, symbol: "F", fact: "أكثر العناصر نشاطاً كيميائياً، ويُضاف مركّبه لمعاجين الأسنان." },
  iodine: { number: 53, symbol: "I", fact: "يحتاجه الجسم لهرمونات الغدة الدرقية، وموجود بالملح المدعّم." },
  neon: { number: 10, symbol: "Ne", fact: "غاز نبيل يتوهج باللون الأحمر البرتقالي في لافتات النيون." },
  titanium: { number: 22, symbol: "Ti", fact: "قوي وخفيف ولا يتآكل، ويُستخدم في الطائرات والزراعات الطبية." },
  platinum: { number: 78, symbol: "Pt", fact: "فلز ثمين نادر لا يتأكسد، ويُستخدم محفّزاً وفي المجوهرات." },
  tungsten: { number: 74, symbol: "W", fact: "أعلى الفلزات انصهاراً، ويُستخدم في الفتائل وأدوات القطع." },
  radium: { number: 88, symbol: "Ra", fact: "عنصر مشع اكتشفته ماري كوري. يتوهج بلون أخضر خافت، وخطير على الصحة." },
  plutonium: { number: 94, symbol: "Pu", fact: "عنصر مشع ثقيل اصطناعي في الغالب، يُستخدم في الأبحاث وبعض المركبات الفضائية." },
};
