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

const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ENGLISH_WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
    .setThumbnail(avatarURL)
    .setDescription(
      [`${BIRTHDAY_EMOJI} **عيد ميلاد ${displayName}**`, `**${b.day} ${MONTH_NAMES[b.month - 1]}**`, whenLine].join(
        "\n",
      ),
    );

  return { embeds: [embed], components: [actionRow()] };
}

export interface SetupMessage {
  content: string;
  components: ActionRowBuilder<ButtonBuilder>[];
}

/** رسالة أول مرة (ما عنده تاريخ محفوظ) — بالإنجليزي، مع زر يفتح نموذج التسجيل مباشرة */
export function buildSetupMessage(): SetupMessage {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(BIRTHDAY_EDIT_BUTTON)
      .setLabel("Set your birthday")
      .setEmoji({ id: "1553179328840474695" })
      .setStyle(ButtonStyle.Success),
  );

  return {
    content: "🎂 You haven't set your birthday yet. Press the button below to set it.",
    components: [row],
  };
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
    .setDescription([`${BIRTHDAY_EMOJI} **أقرب أعياد الميلاد**`, "", ...lines].join("\n"))
    .setFooter({ text: `${total} عضو مسجّل` });
}

/** بطاقة "التفاصيل": تاريخ الميلاد، العمر الحالي، وعيد الميلاد القادم — بالإنجليزي */
export function buildDetailsEmbed(b: Birthday, displayName: string): EmbedBuilder {
  const age = calculateAge(b);
  const nextWeekdayEn = ENGLISH_WEEKDAYS[new Date(age.nextBirthdayUTC * 1000).getUTCDay()];

  return new EmbedBuilder()
    .setColor(0xf472b6)
    .setDescription(`${BIRTHDAY_EMOJI} **${displayName}'s birthday details**`)
    .addFields(
      { name: "🎂 Date of Birth", value: `${ENGLISH_MONTHS[b.month - 1]} ${b.day}, ${b.year}` },
      { name: "🕰️ Current Age", value: `${age.years} years, ${age.months} months, ${age.days} days` },
      {
        name: "📅 Next Birthday",
        value: `${nextWeekdayEn}, <t:${age.nextBirthdayUTC}:D> (in ${age.daysUntilNext} days)`,
      },
      { name: "🎉 Turning", value: `${age.turningAge}` },
    );
}
