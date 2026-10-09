import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import { saveTicketConfig } from "../../tickets/service";
import { buildTicketPanel } from "../../tickets/views";
import type { Command } from "../../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticketpanel")
    .setDescription("Set up the ticket system and post its panel in this channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o.setName("category").setDescription("Category where tickets are created").addChannelTypes(ChannelType.GuildCategory).setRequired(true),
    )
    .addRoleOption((o) => o.setName("role").setDescription("Support team role (sees and answers tickets)").setRequired(true))
    .addStringOption((o) => o.setName("banner").setDescription("Banner image URL (optional)")),

  async execute(interaction) {
    const category = interaction.options.getChannel("category", true);
    const role = interaction.options.getRole("role", true);
    const banner = interaction.options.getString("banner")?.trim() || null;

    if (banner && !/^https?:\/\//i.test(banner)) {
      await interaction.reply({ content: "❌ The banner link must start with http or https.", flags: MessageFlags.Ephemeral });
      return;
    }
    const me = interaction.guild?.members.me;
    if (!me?.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      await interaction.reply({ content: "❌ I need the Manage Channels and Manage Roles permissions.", flags: MessageFlags.Ephemeral });
      return;
    }

    const saved = await saveTicketConfig(interaction.guildId!, category.id, role.id, banner);
    const channel = interaction.channel as TextChannel | null;
    if (!channel || !("send" in channel)) {
      await interaction.reply({ content: "❌ I can't post the panel in this channel.", flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.send(buildTicketPanel(interaction.guild!.name, saved?.bannerUrl ?? null));
    await interaction.reply({
      content: `✅ Saved and posted the panel.
Tickets go in: **${category.name}** • Support team: <@&${role.id}>
To receive transcripts, enable logs with \`setlog\`.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
