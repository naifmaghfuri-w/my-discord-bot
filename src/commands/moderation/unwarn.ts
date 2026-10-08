import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { logModAction } from "../../logs/logger";
import type { Command } from "../../types";
import { Warning } from "../../database/models/Warning";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("احذف تحذيراً معيناً من عضو")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو").setRequired(true))
    .addIntegerOption((o) =>
      o
        .setName("index")
        .setDescription("رقم التحذير كما يظهر في /warnings (1 = الأحدث)")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10),
    ),

  async execute(interaction) {
    const guild = getGuild(interaction);
    const user = interaction.options.getUser("user", true);
    const index = interaction.options.getInteger("index", true);

    const list = await Warning.find({ guildId: guild.id, userId: user.id }).sort({ createdAt: -1 }).limit(10);
    const target = list[index - 1];

    if (!target) {
      await interaction.reply({ content: "❌ ما فيه تحذير بهذا الرقم.", flags: MessageFlags.Ephemeral });
      return;
    }

    await Warning.deleteOne({ _id: target._id });
    await interaction.reply(`✅ تم حذف التحذير رقم **${index}** من ${user} (كان: ${target.reason}).`);
    await logModAction(interaction, "حذف تحذير", user, { reason: `كان: ${target.reason}` });
  },
};

export default command;
