import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { CURRENCY, jenny, XP } from "../../constants";
import { getProfile, xpNeeded } from "../../services/economy";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("يعرض رصيدك ومستواك أو مستوى عضو آخر")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو (اختياري)")),

  async execute(interaction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const profile = await getProfile(user.id, getGuild(interaction).id);

    await interaction.reply(
      [
        `${CURRENCY.emoji} رصيد **${user.username}**: ${jenny(profile.coins)}`,
        `⭐ المستوى: **${profile.level}** — \`${profile.xp}/${xpNeeded(profile.level)}\` ${XP.emoji}`,
        `🏆 مرات الفوز: **${profile.wins}**`,
      ].join("\n"),
    );
  },
};

export default command;
