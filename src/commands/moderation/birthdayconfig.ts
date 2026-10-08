import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { BIRTHDAY_COLOR } from "../../birthday/views";
import { getBirthdayConfig, resetBirthdayConfig, updateBirthdayConfig } from "../../services/birthdayConfig";
import type { Command } from "../../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("birthdayconfig")
    .setDescription("Set this server's birthday announcement channel and birthday role")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription("Channel for birthday announcements")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addRoleOption((o) => o.setName("role").setDescription("Role given for 24 hours on the birthday"))
    .addBooleanOption((o) => o.setName("reset").setDescription("Remove this server's birthday settings")),

  async execute(interaction) {
    const guild = interaction.guild!;
    const channel = interaction.options.getChannel("channel");
    const role = interaction.options.getRole("role");
    const reset = interaction.options.getBoolean("reset");

    const warnings: string[] = [];

    if (reset) {
      await resetBirthdayConfig(guild.id);
    } else if (channel || role) {
      await updateBirthdayConfig(guild.id, {
        ...(channel ? { channelId: channel.id } : {}),
        ...(role ? { roleId: role.id } : {}),
      });

      if (role) {
        const fullRole = guild.roles.cache.get(role.id);
        const me = guild.members.me;
        if (fullRole && (fullRole.managed || (me && fullRole.position >= me.roles.highest.position))) {
          warnings.push("⚠️ I can't give that role: move my highest role above it in Server Settings → Roles.");
        }
      }
    }

    const current = await getBirthdayConfig(guild.id);
    const embed = new EmbedBuilder()
      .setColor(BIRTHDAY_COLOR)
      .setTitle(reset ? "🎂 Birthday settings reset" : "🎂 Birthday settings")
      .addFields(
        { name: "📣 Announcement channel", value: current.channelId ? `<#${current.channelId}>` : "Not set", inline: true },
        { name: "🏷️ Birthday role", value: current.roleId ? `<@&${current.roleId}>` : "Not set", inline: true },
      );
    if (warnings.length) embed.setDescription(warnings.join("\n"));

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
