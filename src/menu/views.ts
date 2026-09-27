import { EmbedBuilder } from "discord.js";
import { CURRENCY, jenny, XP, xp as xpText } from "../constants";
import { DailyQuest } from "../database/models/DailyQuest";
import { WeeklyQuest } from "../database/models/WeeklyQuest";
import { ALL_QUESTS_BONUS, QUESTS } from "../quests/definitions";
import { nextResetUnix, todayKey } from "../quests/time";
import { WEEKLY_QUESTS } from "../quests/weekly";
import { nextWeekResetUnix, weekKey } from "../quests/weeklyTime";
import { getProfile, xpNeeded } from "../services/economy";

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

/** بطاقة "المهام الأسبوعية" */
export async function buildWeeklyEmbed(userId: string, guildId: string): Promise<EmbedBuilder> {
  const doc = await WeeklyQuest.findOne({ guildId, userId, weekKey: weekKey() });
  const progress = doc?.progress ?? {};
  const completed = doc?.completed ?? [];

  const lines = WEEKLY_QUESTS.map((q) => {
    const done = completed.includes(q.id);
    const current = Math.min(progress[q.id] ?? 0, q.target);
    const count = !done ? `  \`${current}/${q.target}\`` : "";
    return `${done ? "✅" : "⬜"} ${q.icon} **${q.title}**${count}\n┗ ${jenny(q.coins)} • ${xpText(q.xp)}`;
  });

  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("📆 المهام الأسبوعية")
    .setDescription(`⏰ تتجدد <t:${nextWeekResetUnix()}:R>\n\n${lines.join("\n\n")}`)
    .setFooter({ text: `${completed.length}/${WEEKLY_QUESTS.length} مكتملة` });
}
