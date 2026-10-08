import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from "discord.js";
import { config } from "../../config";
import { buildLobbyPanel } from "../../chat/views";
import { setConfig } from "../../chat/service";
import type { Command } from "../../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chatpanel")
    .setDescription("إعداد الدردشات الخاصة ونشر لوحتها بالقناة الحالية")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o
        .setName("category")
        .setDescription("الكاتيجوري اللي تنشأ فيه الدردشات الخاصة")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true),
    )
    .addStringOption((o) => o.setName("banner").setDescription("رابط صورة البانر (اختياري)")),

  async execute(interaction) {
    const category = interaction.options.getChannel("category", true);
    const banner = interaction.options.getString("banner")?.trim() || null;

    if (banner && !/^https?:\/\//i.test(banner)) {
      await interaction.reply({ content: "❌ رابط البانر لازم يبدأ بـ http أو https.", flags: MessageFlags.Ephemeral });
      return;
    }

    const me = interaction.guild?.members.me;
    if (!me?.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      await interaction.reply({
        content: "❌ البوت يحتاج صلاحيتي «إدارة القنوات» و«إدارة الرتب» لإنشاء الغرف الخاصة.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const saved = await setConfig(interaction.guildId!, category.id, banner);
    const bannerUrl = saved?.bannerUrl ?? config.chatBannerUrl ?? null;

    const channel = interaction.channel as TextChannel | null;
    if (!channel || !("send" in channel)) {
      await interaction.reply({ content: "❌ ما أقدر أنشر اللوحة بهذي القناة.", flags: MessageFlags.Ephemeral });
      return;
    }

    await channel.send(buildLobbyPanel(interaction.guild!.name, bannerUrl));
    await interaction.reply({
      content: `✅ تم حفظ الإعداد ونشر اللوحة.\nالدردشات تنشأ داخل: **${category.name}**`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
