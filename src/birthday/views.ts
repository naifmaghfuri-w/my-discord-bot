import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import {
  calculateAge,
  getUpcomingBirthdays,
  isAgeVisible,
  type Birthday,
} from "../services/birthday";
import {
  BIRTHDAY_DETAILS_BUTTON,
  BIRTHDAY_EDIT_BUTTON,
  BIRTHDAY_UPCOMING_BUTTON,
} from "./ids";

export const BIRTHDAY_COLOR = 0xf472b6;

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** عدد + معدود بالعربي: [مفرد، مثنى، جمع (3-10)، تمييز (11+)] */
type Unit = [string, string, string, string];
const DAY: Unit = ["يوم", "يومان", "أيام", "يوماً"];
const MONTH: Unit = ["شهر", "شهران", "أشهر", "شهراً"];
const YEAR: Unit = ["سنة", "سنتان", "سنوات", "سنة"];

function count(n: number, u: Unit): string {
  if (n === 1) return u[0];
  if (n === 2) return u[1];
  return `${n} ${n >= 3 && n <= 10 ? u[2] : u[3]}`;
}

function progressBar(pct: number, length = 10): string {
  const filled = Math.round(pct * length);
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

function actionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(BIRTHDAY_UPCOMING_BUTTON).setLabel("القادمة").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BIRTHDAY_EDIT_BUTTON).setLabel("تعديل").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BIRTHDAY_DETAILS_BUTTON).setLabel("التفاصيل").setStyle(ButtonStyle.Secondary),
  );
}

export interface BirthdayPanel {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

/** بطاقة عيد الميلاد. withButtons=false لما نعرض بطاقة شخص ثاني */
export function buildBirthdayPanel(
  b: Birthday,
  displayName: string,
  avatarURL: string,
  withButtons = true,
): BirthdayPanel {
  const age = calculateAge(b);
  const showAge = isAgeVisible(b);
  const dateText = `${b.day} ${MONTHS[b.month - 1]}${showAge ? ` ${b.year}` : ""}`;

  const nextLine =
    age.daysUntilNext === 0
      ? "**اليوم!**"
      : `<t:${age.nextBirthdayUTC}:R> · <t:${age.nextBirthdayUTC}:D>`;

  const embed = new EmbedBuilder()
    .setColor(BIRTHDAY_COLOR)
    .setThumbnail(avatarURL)
    .setTitle(`${displayName} 🎂`)
    .setDescription(`**${dateText}**`)
    .addFields(
      { name: "عيد الميلاد القادم", value: nextLine },
      { name: "\u200b", value: `**التقدم** ${progressBar(age.progress)} **${Math.round(age.progress * 100)}%**` },
    );

  return { embeds: [embed], components: withButtons ? [actionRow()] : [] };
}

export interface SetupMessage {
  content: string;
  components: ActionRowBuilder<ButtonBuilder>[];
}

/** رسالة أول مرة (ما عنده تاريخ محفوظ) مع زر يفتح نموذج التسجيل */
export function buildSetupMessage(): SetupMessage {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BIRTHDAY_EDIT_BUTTON)
      .setLabel("سجّل عيد ميلادك")
      .setStyle(ButtonStyle.Success),
  );

  return {
    content: "ما سجّلت عيد ميلادك بعد. اضغط الزر بالأسفل لتسجيله.",
    components: [row],
  };
}

/** بطاقة "القادمة": الأعياد القادمة مرتبة بالأقرب */
export async function buildUpcomingEmbed(guildId: string): Promise<EmbedBuilder> {
  const list = await getUpcomingBirthdays(guildId, 10);

  const lines = list.map((b) => `<@${b.userId}> - <t:${b.nextTs}:D> (<t:${b.nextTs}:R>)`);
  const body = lines.length ? lines.join("\n") : "ما أحد سجّل عيد ميلاده بعد.";

  return new EmbedBuilder()
    .setColor(BIRTHDAY_COLOR)
    .setDescription(`## 🎂 Upcoming Birthdays\n${body}`);
}

/** بطاقة "التفاصيل": خاصة بصاحبها فقط (تظهر له كل شيء حتى لو العمر مخفي عن غيره) */
export function buildDetailsEmbed(b: Birthday, displayName: string): EmbedBuilder {
  const age = calculateAge(b);
  const nextWeekday = WEEKDAYS[new Date(age.nextBirthdayUTC * 1000).getUTCDay()];

  const embed = new EmbedBuilder()
    .setColor(BIRTHDAY_COLOR)
    .setTitle(`تفاصيل ميلاد ${displayName} 🎂`)
    .addFields({
      name: "تاريخ الميلاد",
      value: `${b.day} ${MONTHS[b.month - 1]}${b.year !== undefined ? ` ${b.year}` : " (بدون سنة)"}`,
    });

  if (age.age) {
    embed.addFields({
      name: "العمر الحالي",
      value: [count(age.age.years, YEAR), count(age.age.months, MONTH), count(age.age.days, DAY)].join(" و"),
    });
  }

  embed.addFields({
    name: "عيد الميلاد القادم",
    value: `${nextWeekday}، <t:${age.nextBirthdayUTC}:D> (${age.daysUntilNext === 0 ? "اليوم" : `بعد ${count(age.daysUntilNext, DAY)}`})`,
  });

  return embed;
}
