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
      "`ترقية` ← تطلب الترقية لما تكون مؤهلًا",
      "`استقالة` ← تستقيل من وظيفتك فورًا",
      "**وظائف مهنية:** موصل طلبات، مساعد مختبر، موظف بنك (ترقيات بطيئة تطلبها بنفسك)",
      "**دوام كامل:** سائق شاحنة، صياد سمك، عامل منجم (راتب أعلى بدون ترقيات)",
      "رسوم التقديم 200 Jenny، ومن ما يداوم أسبوعًا ينفصل.",
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
      "`$LT` ← مهام المختبر اليومية",
      "`$LS` ← مخزونك (عناصر ومركبات)",
      "`$LL` ← مكتبة الوصفات اللي اكتشفتها",
      "`$LTREE` ← شجرة الفتح (مستوياتك ونقاطك: عناصر وأجهزة وتقنيات)",
      "`عرض @شخص السعر` ← بيع مركب للاعب",
      "`عرض @شخص السعر الكمية` ← بيع أكثر من وحدة",
      "",
      "**داخل المعمل:** اختر العناصر، اضبط الحرارة والضغط بالأزرار، ثم «تفاعل» 🧪",
      "**القائمة الإضافية:** الإنجازات، التلميحات، الأجهزة، الطلبات، الاستكشاف",
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
      "`ستريك` ← لوحة الشعلة 🔥 (أيام تراسلك المتتالية تظهر بجانب اسمك، مع إخفاء/تغيير الفاصل/توب/إشعارات)",
      "`pay` ← حوّل Jenny لعضو",
      "`rob` ← حاول تسرق عضواً (مخاطرة!)",
      "`بنك` ← حسابك البنكي (إيداع، سحب، فائدة)",
      "`p` ← قائمتك الرئيسية: المهام اليومية والأسبوعية",
    ],
  },
  {
    id: "other",
    emoji: "🧰",
    label: "أخرى",
    style: ButtonStyle.Secondary,
    title: "🧰 أوامر أخرى",
    lines: [
      "`afk` أو `afk السبب` ← وضع الغياب (ينبّه من يمنشنك)",
      "`$Games` ← قائمة الألعاب (فردية، ثنائية، جماعية)",
      "`$Marriage` ← دليل أوامر العائلة (زواج، طلاق، تبني، شجرة...)",
      "`ميلاد` ← سجّل ميلادك أو شوف ميلاد غيرك بـ `ميلاد @شخص` (يوم الميلاد: رتبة وهدية وتهنئة)",
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