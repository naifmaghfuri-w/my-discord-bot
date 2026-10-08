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
    .setDescription("إعداد نظام التذاكر ونشر لوحته بالقناة الحالية")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((o) =>
      o.setName("category").setDescription("الكاتيجوري اللي تنفتح فيه التذاكر").addChannelTypes(ChannelType.GuildCategory).setRequired(true),
    )
    .addRoleOption((o) => o.setName("role").setDescription("رتبة فريق الدعم (ترى التذاكر وترد عليها)").setRequired(true))
    .addStringOption((o) => o.setName("banner").setDescription("رابط صورة البانر (اختياري)")),

  async execute(interaction) {
    const category = interaction.options.getChannel("category", true);
    const role = interaction.options.getRole("role", true);
    const banner = interaction.options.getString("banner")?.trim() || null;

    if (banner && !/^https?:\/\//i.test(banner)) {
      await interaction.reply({ content: "❌ رابط البانر لازم يبدأ بـ http أو https.", flags: MessageFlags.Ephemeral });
      return;
    }
    const me = interaction.guild?.members.me;
    if (!me?.permissions.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles])) {
      await interaction.reply({ content: "❌ البوت يحتاج صلاحيتي «إدارة القنوات» و«إدارة الرتب».", flags: MessageFlags.Ephemeral });
      return;
    }

    const saved = await saveTicketConfig(interaction.guildId!, category.id, role.id, banner);
    const channel = interaction.channel as TextChannel | null;
    if (!channel || !("send" in channel)) {
      await interaction.reply({ content: "❌ ما أقدر أنشر اللوحة بهذي القناة.", flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.send(buildTicketPanel(interaction.guild!.name, saved?.bannerUrl ?? null));
    await interaction.reply({
      content: `✅ تم حفظ الإعداد ونشر اللوحة.\nالتذاكر داخل: **${category.name}** • فريق الدعم: <@&${role.id}>\nلتصلك نسخ المحادثات فعّل السجلات بـ \`/setlog\`.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};

export default command;
