import { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { logModAction } from "../../logs/logger";
import type { Command } from "../../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("مسح رسائل من القناة")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setContexts(InteractionContextType.Guild)
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("عدد الرسائل (1-100)").setRequired(true).setMinValue(1).setMaxValue(100),
    ),

  async execute(interaction) {
    const channel = interaction.channel;
    if (!channel || !("bulkDelete" in channel)) {
      await interaction.reply({ content: "❌ لا يمكن المسح في هذه القناة.", flags: MessageFlags.Ephemeral });
      return;
    }

    const amount = interaction.options.getInteger("amount", true);
    // true = تجاهل الرسائل الأقدم من 14 يوم (ديسكورد لا يسمح بمسحها دفعة واحدة)
    const deleted = await channel.bulkDelete(amount, true);

    await interaction.reply({
      content: `🧹 تم مسح **${deleted.size}** رسالة.`,
      flags: MessageFlags.Ephemeral,
    });
    await logModAction(interaction, "مسح رسائل", null, { extra: `**العدد:** ${deleted.size}` });
  },
};

export default command;
