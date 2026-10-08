import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { logModAction } from "../../logs/logger";
import type { Command } from "../../types";
import { getModeratableTarget } from "../../utils/moderation";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("حظر عضو من السيرفر")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("السبب").setMaxLength(200))
    .addIntegerOption((o) =>
      o
        .setName("delete_days")
        .setDescription("حذف رسائل العضو من آخر كم يوم (0-7)")
        .setMinValue(0)
        .setMaxValue(7),
    ),

  async execute(interaction) {
    const target = await getModeratableTarget(interaction);
    if (!target) return;

    const reason = interaction.options.getString("reason") ?? "بدون سبب";
    const days = interaction.options.getInteger("delete_days") ?? 0;

    await target.ban({
      reason: `${reason} | بواسطة ${interaction.user.tag}`,
      deleteMessageSeconds: days * 86_400,
    });
    await interaction.reply(`🔨 تم حظر **${target.user.tag}**\nالسبب: ${reason}`);
    await logModAction(interaction, "حظر", target.user, { reason, extra: days ? `**حذف رسائل:** آخر ${days} يوم` : undefined });
  },
};

export default command;
