import {
  ChannelType,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { LOG_COLORS, sendLog, setLogChannel } from "../../logs/logger";
import type { Command } from "../../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("setlog")
    .setDescription("تحديد قناة سجلات الإدارة (بدون خيار = إيقاف السجلات)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o.setName("channel").setDescription("قناة السجلات").addChannelTypes(ChannelType.GuildText),
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");
    await setLogChannel(interaction.guildId!, channel?.id ?? null);

    if (!channel) {
      await interaction.reply({ content: "🔕 تم إيقاف السجلات.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content: `✅ السجلات ستنزل في ${channel}.`, flags: MessageFlags.Ephemeral });
    await sendLog(
      interaction.guild!,
      new EmbedBuilder()
        .setColor(LOG_COLORS.info)
        .setTitle("📜 تم تفعيل السجلات")
        .setDescription(`بواسطة <@${interaction.user.id}>\nهنا تنزل: إجراءات الإدارة، دخول وخروج الأعضاء، حذف وتعديل الرسائل، الدردشات الخاصة، التذاكر.`),
    );
  },
};

export default command;
