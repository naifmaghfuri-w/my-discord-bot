import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { getProfile } from "../../services/economy";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("يعرض رصيدك أو رصيد عضو آخر")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو (اختياري)")),

  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const profile = await getProfile(user.id, getGuild(interaction).id);

    await interaction.reply(`💰 رصيد **${user.username}**: **${profile.coins}** عملة\n🏆 مرات الفوز: **${profile.wins}**`);
  },
};

export default command;
