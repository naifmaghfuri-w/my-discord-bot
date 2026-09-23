import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { Warning } from "../../database/models/Warning";
import { getGuild } from "../../utils/guild";
import { getModeratableTarget } from "../../utils/moderation";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو (يُحفظ في قاعدة البيانات)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("السبب").setRequired(true).setMaxLength(200)),

  async execute(interaction) {
    const target = await getModeratableTarget(interaction);
    if (!target) return;

    const guild = getGuild(interaction);
    const reason = interaction.options.getString("reason", true);

    await Warning.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });
    const total = await Warning.countDocuments({ guildId: guild.id, userId: target.id });

    await interaction.reply(`⚠️ تم تحذير ${target} (إجمالي التحذيرات: **${total}**)\nالسبب: ${reason}`);
  },
};

export default command;
