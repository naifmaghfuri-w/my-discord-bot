import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

const COLOR = 0x6366f1;

export interface HelpSection {
  id: string;
  emoji: string;
  label: string;
  style: ButtonStyle;
  title: string;
  lines: string[];
}

export const SECTIONS: HelpSection[] = [
  {
    id: "jobs",
    emoji: "💼",
    label: "الوظائف",
    style: ButtonStyle.Success,
    title: "💼 الوظائف",
    lines: [
      "`وظائف` ← لوحة الوظائف (تقديم، ترقية، استقالة)",
      "`دوام` ← تداوم وتستلم راتبك (المهنية كل 3 ساعات، والكاملة كل 24 ساعة)",
      "`استقالة` ← تستقيل من وظيفتك",
      "**وظائف مهنية:** موصل طلبات، مساعد مختبر، موظف بنك (ترقيات بطيئة تطلبها بنفسك)",
      "**دوام كامل:** سائق شاحنة، صياد سمك، عامل منجم (راتب أعلى بدون ترقيات)",
      "رسوم التقديم 200 Jenny، ومن ما يداوم أسبوعًا ينفصل.",
    ],
  },
  {
    id: "hunter",
    emoji: "🎴",
    label: "Hunter",
    style: ButtonStyle.Success,
    title: "🎴 Hunter x Hunter",
    lines: [
      "`hunter` / `هنتر` ← القائمة الرئيسية للعبة",
      "**Story Mode:** فصول قصة تفتح الشخصيات (غون، ليوريو، كورابيكا، كيلوا) والرخصة",
      "**Fight:** ضد بوت، لاعب ضد لاعب، وشاشة الشخصيات (اختيار + تطوير هجوم/دفاع/مراوغة)",
      "**Shop:** شراء شخصيات (هيسوكا، هانزو)",
      "**Options:** تغيير لغة اللعبة (English / العربية)",
      "`قتال @شخص` أو `duel @شخص 500` ← مبارزة مع رهان اختياري",
    ],
  },
  {
    id: "lab",
    emoji: "🧪",
    label: "المختبر",
    style: ButtonStyle.Primary,
    title: "🧪 مختبر الكيمياء",
    lines: [
      "`lab` ← القائمة الرئيسية: معمل، متجر، بيع النواتج، والقائمة الإضافية",
      "`lab @شخص` ← بطاقة مختبر لاعب (لقبه، سمعته، أندر اكتشافاته)",
      "`عرض @شخص السعر` ← بيع مركب للاعب (مثال: `عرض @ماجد 500`)",
      "`عرض @شخص السعر الكمية` ← بيع أكثر من وحدة",
      "",
      "**داخل المعمل:** اختر العناصر، اضبط الحرارة والضغط بالأزرار، ثم «تفاعل» 🧪",
      "**القائمة الإضافية:** المستودع، المكتبة، المستويات، المهام، الإنجازات، التلميحات",
    ],
  },
  {
    id: "family",
    emoji: "👨‍👩‍👧",
    label: "العائلة",
    style: ButtonStyle.Primary,
    title: "👨‍👩‍👧 العائلة",
    lines: [
      "`تزوج @شخص مهر 500` ← طلب زواج (المهر 0 = زواج مجاني)",
      "`طلاق` أو `طلاق @شخص` ← طلاق من الزوج/الزوجة",
      "`خلع` ← خلع (للزوجة)، وترجع نصف المهر لزوجها",
      "`تبنى @شخص` ← تبنّي عضو",
      "`تبرؤ @شخص` ← الأب أو الأم يتبرأ من ابنه",
      "`هروب` ← الابن يتخلى عن عائلته بالكامل",
      "`شجرة` ← شجرة عائلتك (مع الأجداد والأحفاد)، و`شجرة @شخص` ← شجرة غيرك",
      "`قرابة @شخص` ← من هو بالنسبة لك",
    ],
  },
  {
    id: "chat",
    emoji: "💬",
    label: "الدردشات الخاصة",
    style: ButtonStyle.Primary,
    title: "💬 الدردشات الخاصة",
    lines: [
      "من لوحة الدردشات (بقناة الغرف):",
      "💬 **انشاء دردشة** ← غرفتك الخاصة",
      "✉️ **ارسال دعوة** ← ادعُ عضواً لغرفتك",
      "📡 **رادار البحث** ← اعرف مين متاح للدردشة",
      "🚪 **طرق الباب** ← اطلب دخول غرفة مفتوحة",
      "🕊️ **زاجل** ← رسالة خاصة لعضو",
      "🔔 **الإشعارات** ← تحكم بالدعوات والزاجل",
      "",
      "الغرفة الخاملة 3 أيام تنحذف تلقائياً.",
    ],
  },
  {
    id: "economy",
    emoji: "💰",
    label: "الاقتصاد",
    style: ButtonStyle.Success,
    title: "💰 الاقتصاد",
    lines: [
      "`daily` ← مكافأتك اليومية ",
      "`streak` ← شعلتك 🔥 (أيام تراسلك المتتالية في السيرفر)",
      "`pay` ← حوّل Jenny لعضو",
      "`rob` ← حاول تسرق عضواً (مخاطرة!)",
      "`top` و`leaderboard` ← لوحات الصدارة",
      "`بنك` ← حسابك البنكي (إيداع، سحب، فائدة)",
      "`p` ← قائمتك الرئيسية: المهام اليومية والأسبوعية",
    ],
  },
  {
    id: "games",
    emoji: "🎮",
    label: "الألعاب",
    style: ButtonStyle.Success,
    title: "🎮 الألعاب",
    lines: ["`coinflip` ← صورة أو كتابة", "`rps` ← حجرة ورقة مقص", "`xo` ← إكس أو ضد عضو"],
  },
  {
    id: "other",
    emoji: "🧰",
    label: "أخرى",
    style: ButtonStyle.Secondary,
    title: "🧰 أوامر أخرى",
    lines: [
      "`afk` أو `afk السبب` ← وضع الغياب (ينبّه من يمنشنك)",
      "`ميلاد` ← سجّل ميلادك أو شوف ميلاد غيرك بـ `ميلاد @شخص` (يوم الميلاد: رتبة وهدية وتهنئة)",
      "`serverstats` ← إحصائيات السيرفر",
      "`ping` ← سرعة البوت",
    ],
  },
  {
    id: "support",
    emoji: "🎫",
    label: "الدعم",
    style: ButtonStyle.Secondary,
    title: "🎫 الدعم الفني",
    lines: [
      "اضغط «🎫 فتح تذكرة» بلوحة الدعم، اكتب مشكلتك، وتنفتح لك غرفة خاصة مع الإدارة.",
      "• تذكرة واحدة مفتوحة لكل عضو",
      "• تصلك نسخة من المحادثة بالخاص عند الإغلاق",
    ],
  },
  {
    id: "mod",
    emoji: "🛡️",
    label: "الإدارة",
    style: ButtonStyle.Danger,
    title: "🛡️ أوامر الإدارة",
    lines: [
      "`kick` `ban` `timeout` ← طرد، حظر، كتم",
      "`warn` `unwarn` `warnings` ← نظام التحذيرات (كتم تلقائي عند التكرار)",
      "`clear 10` ← مسح رسائل، و`clear 10 @شخص` أو بالايدي لمسح رسائل عضو معيّن",
      "`setlog` ← قناة السجلات (إجراءات الإدارة، الدخول والخروج، الحذف والتعديل)",
      "`chatpanel` ← إعداد الدردشات الخاصة",
      "`ticketpanel` ← إعداد التذاكر (مساعدة / بلاغ)",
      "`backup` ← نسخة احتياطية لقاعدة البيانات (المالك فقط)",
    ],
  },
];

const SECTION_MAP = new Map(SECTIONS.map((s) => [s.id, s]));

export function helpId(section: string, ownerId: string): string {
  return `help_${section}|${ownerId}`;
}

function buttons(ownerId: string, active: string | null) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let i = 0; i < SECTIONS.length; i += 4) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const s of SECTIONS.slice(i, i + 4)) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(helpId(s.id, ownerId))
          .setLabel(s.label)
          .setEmoji(s.emoji)
          .setStyle(s.id === active ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(s.id === active),
      );
    }
    rows.push(row);
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(helpId("home", ownerId)).setLabel("الرئيسية").setEmoji("🏠").setStyle(ButtonStyle.Secondary).setDisabled(active === null),
    ),
  );
  return rows;
}

export function buildHelpHome(ownerId: string, guildName: string) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("📖 دليل البوت")
    .setDescription(
      [
        "أغلب الأوامر تُكتب بالشات مباشرة **بدون سلاش**.",
        "اختر قسماً بالأزرار لتشوف أوامره وأمثلتها:",
        "",
        ...SECTIONS.map((s) => `${s.emoji} **${s.label}**`),
      ].join("\n"),
    )
    .setFooter({ text: guildName });
  return { embeds: [embed], components: buttons(ownerId, null) };
}

export function buildHelpSection(sectionId: string, ownerId: string, guildName: string) {
  const s = SECTION_MAP.get(sectionId);
  if (!s) return buildHelpHome(ownerId, guildName);
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(s.title).setDescription(s.lines.join("\n")).setFooter({ text: guildName });
  return { embeds: [embed], components: buttons(ownerId, s.id) };
}
