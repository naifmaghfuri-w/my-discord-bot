import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { BIRTHDAY_EMOJI, CURRENCY, jenny, XP, xp as xpText } from "../constants";
import { DailyQuest } from "../database/models/DailyQuest";
import { ALL_QUESTS_BONUS, QUESTS } from "../quests/definitions";
import { nextResetUnix, todayKey } from "../quests/time";
import { getProfile, xpNeeded } from "../services/economy";
import { getBirthday, getUpcomingBirthdays } from "../services/birthday";
import { SETBIRTHDAY_BUTTON } from "./ids";

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

/** بطاقة "إنجازاتي" — نفس محتوى أمر /quests القديم */
export async function buildAchievementsEmbed(userId: string, guildId: string): Promise<EmbedBuilder> {
  const doc = await DailyQuest.findOne({ guildId, userId, dateKey: todayKey() });

  const progress = doc?.progress ?? {};
  const completed = doc?.completed ?? [];
  const doneCount = QUESTS.filter((q) => completed.includes(q.id)).length;

  const lines = QUESTS.map((q) => {
    const done = completed.includes(q.id);
    const current = Math.min(progress[q.id] ?? 0, q.target);
    const count = !done && q.target > 1 ? `  \`${current}/${q.target}\`` : "";
    return `${done ? "✅" : "⬜"} ${q.icon} **${q.title}**${count}\n┗ ${jenny(q.coins)} • ${xpText(q.xp)}`;
  });

  return new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🏆 إنجازاتي")
    .setDescription(`⏰ تتجدد المهام <t:${nextResetUnix()}:R>\n\n${lines.join("\n\n")}`)
    .addFields({
      name: `🏆 مكافأة إكمال الكل ${completed.includes("all") ? "✅" : ""}`,
      value: `${jenny(ALL_QUESTS_BONUS.coins)} • ${xpText(ALL_QUESTS_BONUS.xp)}`,
    })
    .setFooter({ text: `${doneCount}/${QUESTS.length} مكتملة` });
}

/** بطاقة "الرصيد" — نفس محتوى أمر /balance القديم */
export async function buildBalanceContent(userId: string, guildId: string, username: string): Promise<string> {
  const profile = await getProfile(userId, guildId);
  return [
    `${CURRENCY.emoji} رصيد **${username}**: ${jenny(profile.coins)}`,
    `⭐ المستوى: **${profile.level}** — \`${profile.xp}/${xpNeeded(profile.level)}\` ${XP.emoji}`,
    `🏆 مرات الفوز: **${profile.wins}**`,
  ].join("\n");
}

export interface BirthdayPanel {
  embed: EmbedBuilder;
  components: ActionRowBuilder<ButtonBuilder>[];
}

/** بطاقة "عيد الميلاد": تاريخك الحالي + أقرب 5 أعياد ميلاد بالسيرفر + زر تحديد التاريخ */
export async function buildBirthdayPanel(userId: string, guildId: string): Promise<BirthdayPanel> {
  const [mine, upcoming] = await Promise.all([
    getBirthday(userId, guildId),
    getUpcomingBirthdays(guildId, 5),
  ]);

  const mineText = mine ? `**${mine.day} ${MONTH_NAMES[mine.month - 1]}**` : "لم يُحدد بعد";

  const upcomingLines = upcoming.length
    ? upcoming
        .map((b) => {
          const when = b.daysUntil === 0 ? "🎉 اليوم!" : `بعد ${b.daysUntil} يوم`;
          return `<@${b.userId}> — ${b.day} ${MONTH_NAMES[b.month - 1]} (${when})`;
        })
        .join("\n")
    : "ما فيه أحد حدد عيد ميلاده بعد.";

  const embed = new EmbedBuilder()
    .setColor(0xf472b6)
    .setTitle(`${BIRTHDAY_EMOJI} عيد الميلاد`)
    .addFields(
      { name: "عيد ميلادك", value: mineText },
      { name: "القادمون في السيرفر", value: upcomingLines },
    );

  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(SETBIRTHDAY_BUTTON)
        .setLabel("حدد عيد ميلادك")
        .setEmoji({ id: "1553179328840474695" })
        .setStyle(ButtonStyle.Success),
    ),
  ];

  return { embed, components };
}
