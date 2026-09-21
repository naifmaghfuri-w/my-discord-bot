import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { claimDaily } from "../../services/economy";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("استلم مكافأتك اليومية")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const result = await claimDaily(interaction.user.id, getGuild(interaction).id);

    if (!result.ok) {
      const hours = Math.floor(result.msLeft / 3_600_000);
      const minutes = Math.ceil((result.msLeft % 3_600_000) / 60_000);
      await interaction.reply({
        content: `⏳ استلمت مكافأتك اليوم. ارجع بعد **${hours}** ساعة و **${minutes}** دقيقة.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply(`🎁 استلمت **${result.amount}** عملة!`);
  },
};

export default command;
