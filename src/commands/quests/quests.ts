import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { jenny, xp as xpText } from "../../constants";
import { DailyQuest } from "../../database/models/DailyQuest";
import { ALL_QUESTS_BONUS, QUESTS } from "../../quests/definitions";
import { nextResetUnix, todayKey } from "../../quests/time";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("quests")
    .setDescription("عرض مهامك اليومية وتقدمك فيها")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const doc = await DailyQuest.findOne({
      guildId: getGuild(interaction).id,
      userId: interaction.user.id,
      dateKey: todayKey(),
    });

    const progress = doc?.progress ?? {};
    const completed = doc?.completed ?? [];
    const doneCount = QUESTS.filter((q) => completed.includes(q.id)).length;

    const lines = QUESTS.map((q) => {
      const done = completed.includes(q.id);
      const current = Math.min(progress[q.id] ?? 0, q.target);
      const count = !done && q.target > 1 ? `  \`${current}/${q.target}\`` : "";
      return `${done ? "✅" : "⬜"} ${q.icon} **${q.title}**${count}\n┗ ${jenny(q.coins)} • ${xpText(q.xp)}`;
    });

    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("📜 مهامك اليومية")
      .setDescription(`⏰ تتجدد المهام <t:${nextResetUnix()}:R>\n\n${lines.join("\n\n")}`)
      .addFields({
        name: `🏆 مكافأة إكمال الكل ${completed.includes("all") ? "✅" : ""}`,
        value: `${jenny(ALL_QUESTS_BONUS.coins)} • ${xpText(ALL_QUESTS_BONUS.xp)}`,
      })
      .setFooter({ text: `${doneCount}/${QUESTS.length} مكتملة` });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
