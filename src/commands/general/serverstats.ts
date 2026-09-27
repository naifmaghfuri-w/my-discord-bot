import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from "discord.js";
import { getTodayStats } from "../../services/stats";
import type { Command } from "../../types";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("serverstats")
    .setDescription("إحصائيات السيرفر لهذا اليوم")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const guild = getGuild(interaction);
    const stats = await getTodayStats(guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x0ea5e9)
      .setTitle(`📊 إحصائيات ${guild.name}`)
      .addFields(
        { name: "👥 الأعضاء", value: `${guild.memberCount}`, inline: true },
        { name: "💬 رسائل اليوم", value: `${stats.messageCount}`, inline: true },
        { name: "🟢 نشطون اليوم", value: `${stats.activeMembers}`, inline: true },
      );

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
