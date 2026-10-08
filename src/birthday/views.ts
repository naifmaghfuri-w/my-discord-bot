import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { BIRTHDAY_EMOJI } from "../constants";
import {
  calculateAge,
  countRegisteredBirthdays,
  getUpcomingBirthdays,
  isAgeVisible,
  type Birthday,
} from "../services/birthday";
import {
  BIRTHDAY_DETAILS_BUTTON,
  BIRTHDAY_EDIT_BUTTON,
  BIRTHDAY_PRIVACY_BUTTON,
  BIRTHDAY_UPCOMING_BUTTON,
} from "./ids";

export const BIRTHDAY_COLOR = 0xf472b6;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function progressBar(pct: number, length = 10): string {
  const filled = Math.round(pct * length);
  return "▰".repeat(filled) + "▱".repeat(length - filled);
}

function actionRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(BIRTHDAY_UPCOMING_BUTTON).setLabel("Upcoming").setEmoji("🕐").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BIRTHDAY_EDIT_BUTTON).setLabel("Edit").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BIRTHDAY_DETAILS_BUTTON).setLabel("Details").setEmoji("ℹ️").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BIRTHDAY_PRIVACY_BUTTON).setLabel("Show/Hide age").setEmoji("🙈").setStyle(ButtonStyle.Secondary),
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
      ? "🎉 **It's today!**"
      : `<t:${age.nextBirthdayUTC}:R> · <t:${age.nextBirthdayUTC}:D>`;

  const embed = new EmbedBuilder()
    .setColor(BIRTHDAY_COLOR)
    .setThumbnail(avatarURL)
    .setTitle(`${BIRTHDAY_EMOJI} ${displayName}'s Birthday`)
    .setDescription(`**${dateText}**`)
    .addFields(
      { name: "⏳ Next birthday", value: nextLine },
      ...(showAge && age.turningAge ? [{ name: "🎈 Turning", value: `**${age.turningAge}**`, inline: true }] : []),
      {
        name: "📊 Progress to next birthday",
        value: `${progressBar(age.progress)} **${Math.round(age.progress * 100)}%**`,
      },
    );

  if (withButtons && b.year !== undefined) {
    embed.setFooter({ text: b.hideAge ? "🙈 Your age is hidden from others" : "👀 Your age is visible to others" });
  }

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
      .setLabel("Set your birthday")
      .setEmoji({ id: "1553179328840474695" })
      .setStyle(ButtonStyle.Success),
  );

  return {
    content: "🎂 You haven't set your birthday yet. Press the button below to set it.",
    components: [row],
  };
}

/** بطاقة "Upcoming": أصحاب عيد اليوم أولاً، ثم أقرب الأعياد */
export async function buildUpcomingEmbed(guildId: string): Promise<EmbedBuilder> {
  const [list, total] = await Promise.all([getUpcomingBirthdays(guildId, 10), countRegisteredBirthdays(guildId)]);

  const turning = (n: number) => (n ? ` · turning \`${n}\`` : "");
  const today = list.filter((b) => b.daysUntil === 0);
  const rest = list.filter((b) => b.daysUntil > 0);

  const lines: string[] = [];
  if (today.length) {
    lines.push("🎉 **Today**");
    lines.push(...today.map((b) => `<@${b.userId}>${turning(b.turningAge)}`));
    lines.push("");
  }
  if (rest.length) {
    lines.push("📅 **Coming up**");
    lines.push(
      ...rest.map(
        (b) => `<@${b.userId}> — ${b.day} ${MONTHS[b.month - 1]} · in ${plural(b.daysUntil, "day")}${turning(b.turningAge)}`,
      ),
    );
  }
  if (!lines.length) lines.push("Nobody has set a birthday yet.");

  return new EmbedBuilder()
    .setColor(BIRTHDAY_COLOR)
    .setTitle(`${BIRTHDAY_EMOJI} Upcoming Birthdays`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${plural(total, "member")} registered` });
}

/** بطاقة "Details": خاصة بصاحبها فقط (تظهر له كل شيء حتى لو العمر مخفي عن غيره) */
export function buildDetailsEmbed(b: Birthday, displayName: string): EmbedBuilder {
  const age = calculateAge(b);
  const nextWeekday = WEEKDAYS[new Date(age.nextBirthdayUTC * 1000).getUTCDay()];

  const embed = new EmbedBuilder()
    .setColor(BIRTHDAY_COLOR)
    .setTitle(`${BIRTHDAY_EMOJI} ${displayName}'s birthday details`)
    .addFields({
      name: "🎂 Date of Birth",
      value: `${MONTHS[b.month - 1]} ${b.day}${b.year !== undefined ? `, ${b.year}` : " (no year set)"}`,
    });

  if (age.age) {
    embed.addFields({
      name: "🕰️ Current Age",
      value: `${plural(age.age.years, "year")}, ${plural(age.age.months, "month")}, ${plural(age.age.days, "day")}`,
    });
  }

  embed.addFields({
    name: "📅 Next Birthday",
    value: `${nextWeekday}, <t:${age.nextBirthdayUTC}:D> (in ${plural(age.daysUntilNext, "day")})`,
  });

  if (age.turningAge) embed.addFields({ name: "🎈 Turning", value: `${age.turningAge}` });

  if (b.year !== undefined) {
    embed.addFields({ name: "🔒 Privacy", value: b.hideAge ? "Your age is hidden from others" : "Your age is visible to others" });
  }
  return embed;
}
