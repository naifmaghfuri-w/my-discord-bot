import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { getModeratableTarget } from "../../utils/moderation";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("طرد عضو من السيرفر")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("السبب").setMaxLength(200)),

  async execute(interaction) {
    const target = await getModeratableTarget(interaction);
    if (!target) return;

    const reason = interaction.options.getString("reason") ?? "بدون سبب";
    await target.kick(`${reason} | بواسطة ${interaction.user.tag}`);
    await interaction.reply(`👢 تم طرد **${target.user.tag}**\nالسبب: ${reason}`);
  },
};

export default command;
