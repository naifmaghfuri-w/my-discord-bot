import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { getModeratableTarget } from "../../utils/moderation";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("كتم عضو مؤقتاً")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو").setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName("minutes")
        .setDescription("المدة بالدقائق (الحد الأقصى 28 يوم)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(40_320),
    )
    .addStringOption((o) => o.setName("reason").setDescription("السبب").setMaxLength(200)),

  async execute(interaction) {
    const target = await getModeratableTarget(interaction);
    if (!target) return;

    const minutes = interaction.options.getInteger("minutes", true);
    const reason = interaction.options.getString("reason") ?? "بدون سبب";

    await target.timeout(minutes * 60_000, `${reason} | بواسطة ${interaction.user.tag}`);
    await interaction.reply(`🔇 تم كتم **${target.user.tag}** لمدة **${minutes}** دقيقة\nالسبب: ${reason}`);
  },
};

export default command;
