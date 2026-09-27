import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from "discord.js";
import { jenny } from "../../constants";
import { UserProfile } from "../../database/models/UserProfile";
import type { Command } from "../../types";
import { getGuild } from "../../utils/guild";

const MEDALS = ["🥇", "🥈", "🥉"];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("أفضل 10 أعضاء بالمستوى والعملة والفوز")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guildId = getGuild(interaction).id;
    const list = await UserProfile.find({ guildId, level: { $gt: 1 } })
      .sort({ level: -1, xp: -1 })
      .limit(10);

    if (list.length === 0) {
      await interaction.reply("ما فيه أحد وصل لمستوى ثاني بعد. جرب المهام اليومية!");
      return;
    }

    const lines = list.map(
      (p, i) =>
        `${MEDALS[i] ?? `**${i + 1}.**`} <@${p.userId}> — المستوى **${p.level}** • ${jenny(p.coins)} • 🏆 ${p.wins}`,
    );

    const embed = new EmbedBuilder().setColor(0x6366f1).setTitle("📊 لوحة الصدارة").setDescription(lines.join("\n"));
    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

export default command;
