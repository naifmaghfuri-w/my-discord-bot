import { EmbedBuilder, InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { Warning } from "../../database/models/Warning";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("عرض تحذيرات عضو")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو").setRequired(true)),

  async execute(interaction) {
    const guild = getGuild(interaction);
    const user = interaction.options.getUser("user", true);

    const filter = { guildId: guild.id, userId: user.id };
    const [list, total] = await Promise.all([
      Warning.find(filter).sort({ createdAt: -1 }).limit(10),
      Warning.countDocuments(filter),
    ]);

    if (total === 0) {
      await interaction.reply(`✅ ${user} ما عنده أي تحذيرات.`);
      return;
    }

    const lines = list.map(
      (w, i) => `**${i + 1}.** ${w.reason}\n<t:${Math.floor(w.createdAt.getTime() / 1000)}:R> — بواسطة <@${w.moderatorId}>`,
    );

    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle(`⚠️ تحذيرات ${user.username}`)
      .setDescription(lines.join("\n\n"))
      .setFooter({ text: `الإجمالي: ${total} (يعرض آخر 10)` });

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
