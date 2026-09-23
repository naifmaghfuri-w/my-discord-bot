import { EmbedBuilder, InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { CURRENCY, jenny } from "../../constants";
import { UserProfile } from "../../database/models/UserProfile";
import { getGuild } from "../../utils/guild";

const MEDALS = ["🥇", "🥈", "🥉"];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("top")
    .setDescription("أغنى 10 أعضاء في السيرفر")
    .setContexts(InteractionContextType.Guild),

  async execute(interaction) {
    const list = await UserProfile.find({ guildId: getGuild(interaction).id, coins: { $gt: 0 } })
      .sort({ coins: -1 })
      .limit(10);

    if (list.length === 0) {
      await interaction.reply(`ما فيه أحد عنده ${CURRENCY.name} لسه. جرب \`/daily\` أو العب لعبة!`);
      return;
    }

    const lines = list.map((p, i) => `${MEDALS[i] ?? `**${i + 1}.**`} <@${p.userId}> — ${jenny(p.coins)}`);
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle("🏆 المتصدرين").setDescription(lines.join("\n"));

    await interaction.reply({ embeds: [embed], allowedMentions: { parse: [] } });
  },
};

export default command;
