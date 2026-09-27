import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { BIRTHDAY_EMOJI } from "../constants";
import {
  calculateAge,
  countRegisteredBirthdays,
  getUpcomingBirthdays,
  type Birthday,
} from "../services/birthday";
import { BIRTHDAY_DETAILS_BUTTON, BIRTHDAY_EDIT_BUTTON, BIRTHDAY_UPCOMING_BUTTON } from "./ids";

export const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function actionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(BIRTHDAY_UPCOMING_BUTTON).setLabel("القادمة").setEmoji("🕐").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BIRTHDAY_EDIT_BUTTON).setLabel("تعديل").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BIRTHDAY_DETAILS_BUTTON).setLabel("التفاصيل").setEmoji("ℹ️").setStyle(ButtonStyle.Secondary),
  );
}

export interface BirthdayPanel {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}

/** بطاقة عيد ميلاد العضو الرئيسية */
export function buildBirthdayPanel(b: Birthday, displayName: string, avatarURL: string): BirthdayPanel {
  const age = calculateAge(b);
  const whenLine =
    age.daysUntilNext === 0
      ? "🎉 اليوم!"
      : `بعد ${age.daysUntilNext} يوم · بيصير عمره **${age.turningAge}**`;

  const embed = new EmbedBuilder()
    .setColor(0xf472b6)
    .setAuthor({ name: `${BIRTHDAY_EMOJI} عيد ميلاد ${displayName}` })
    .setThumbnail(avatarURL)
    .setDescription(`**${b.day} ${MONTH_NAMES[b.month - 1]}**\n${whenLine}`);

  return { embeds: [embed], components: [actionRow()] };
}

/** تعليمات أول مرة (ما عنده تاريخ محفوظ) */
export function buildSetupMessage(): string {
  return [
    `${BIRTHDAY_EMOJI} ما سجّلت عيد ميلادك بعد.`,
    "اكتب: `ميلاد يوم/شهر/سنة` — مثال: `ميلاد 15/8/2001`",
    "(تقدر تستخدم `birthday` أو `dob` بدل `ميلاد` بنفس الطريقة)",
  ].join("\n");
}

/** بطاقة "القادمة": أقرب أعياد الميلاد بالسيرفر */
export async function buildUpcomingEmbed(guildId: string): Promise<EmbedBuilder> {
  const [list, total] = await Promise.all([getUpcomingBirthdays(guildId, 10), countRegisteredBirthdays(guildId)]);

  const lines = list.length
    ? list.map((b) => {
        const when = b.daysUntil === 0 ? "🎉 اليوم!" : `بعد ${b.daysUntil} يوم`;
        const age = b.turningAge ? `  \`${b.turningAge}\`` : "";
        return `<@${b.userId}> — ${b.day} ${MONTH_NAMES[b.month - 1]} (${when})${age}`;
      })
    : ["ما فيه أحد سجّل عيد ميلاده بعد."];

  return new EmbedBuilder()
    .setColor(0xf472b6)
    .setTitle(`${BIRTHDAY_EMOJI} أقرب أعياد الميلاد`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${total} عضو مسجّل` });
}

/** بطاقة "التفاصيل": العمر بالضبط وتاريخ العيد القادم */
export function buildDetailsEmbed(b: Birthday, displayName: string): EmbedBuilder {
  const age = calculateAge(b);
  return new EmbedBuilder()
    .setColor(0xf472b6)
    .setTitle(`${BIRTHDAY_EMOJI} تفاصيل عمر ${displayName}`)
    .setDescription(
      [
        `العمر بالتفصيل: **${age.years}** سنة و **${age.months}** شهر و **${age.days}** يوم`,
        `عيد ميلادك القادم: يوم **${age.nextWeekday}** <t:${age.nextBirthdayUTC}:D> (بعد ${age.daysUntilNext} يوم)`,
        `بيصير عمرك **${age.turningAge}** سنة`,
      ].join("\n"),
    );
}
