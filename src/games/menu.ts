import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";

/** يفتح قائمة الألعاب بكتابة !العاب */
export const GAMES_TRIGGER = /^!\s*[اأ]لعاب$/;

export const MENU_SELECT = "gm_menu";
export const MENU_BACK = "gm_back";
export const MENU_CODENAMES = "gm_cn";

const COLOR = 0x8b5cf6;

export type Category = "solo" | "duo" | "group";

export function buildGamesMenu(owner: string) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("الألعاب")
    .setDescription("اختر نوع الألعاب من القائمة بالأسفل.");

  const select = new StringSelectMenuBuilder()
    .setCustomId(`${MENU_SELECT}|${owner}`)
    .setPlaceholder("اختر القائمة المطلوبة")
    .addOptions(
      { label: "الألعاب الفردية", value: "solo", emoji: "🎮" },
      { label: "الألعاب الثنائية", value: "duo", emoji: "⚔️" },
      { label: "الألعاب الجماعية", value: "group", emoji: "👥" },
    );

  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)] };
}

const BODY: Record<Category, { title: string; lines: string[] }> = {
  solo: { title: "الألعاب الفردية", lines: ["`!عملة صورة` أو `!عملة كتابة` ← صورة أو كتابة (مرة كل 24 ساعة)"] },
  duo: {
    title: "الألعاب الثنائية",
    lines: [
      "`!عملة @شخص مبلغ` ← تحدي عملة: كل لاعب يختار صورة أو كتابة، واللي تطلع عليه يفوز",
      "`rps` ← حجرة ورقة مقص",
      "`xo` ← إكس أو ضد عضو",
    ],
  },
  group: {
    title: "الألعاب الجماعية",
    lines: ["**Code Names** ← فريقان (أحمر وأزرق)، قائد ومخمنون لكل فريق. الأفضل 4 لاعبين فأكثر."],
  },
};

export function buildCategory(cat: Category, owner: string) {
  const b = BODY[cat];
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(b.title).setDescription(b.lines.join("\n"));

  const row = new ActionRowBuilder<ButtonBuilder>();
  if (cat === "group") {
    row.addComponents(
      new ButtonBuilder().setCustomId(`${MENU_CODENAMES}|${owner}`).setLabel("Code Names").setStyle(ButtonStyle.Success),
    );
  }
  row.addComponents(new ButtonBuilder().setCustomId(`${MENU_BACK}|${owner}`).setLabel("رجوع").setStyle(ButtonStyle.Secondary));
  return { embeds: [embed], components: [row] };
}
