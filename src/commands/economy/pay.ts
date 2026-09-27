import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { jenny } from "../../constants";
import { UserProfile } from "../../database/models/UserProfile";
import { logTransaction } from "../../services/transactions";
import type { Command } from "../../types";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("حوّل من محفظتك لمحفظة عضو ثاني")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("المستلم").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("المبلغ").setRequired(true).setMinValue(1)),
  cooldown: 5,

  async execute(interaction) {
    const guildId = getGuild(interaction).id;
    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    if (target.id === interaction.user.id) {
      await interaction.reply("😅 ما تقدر تحوّل لنفسك.");
      return;
    }
    if (target.bot) {
      await interaction.reply("🤖 ما تقدر تحوّل لبوت.");
      return;
    }

    const updated = await UserProfile.findOneAndUpdate(
      { userId: interaction.user.id, guildId, coins: { $gte: amount } },
      { $inc: { coins: -amount } },
      { new: true },
    );

    if (!updated) {
      await interaction.reply("❌ رصيد محفظتك ما يكفي لهذا المبلغ.");
      return;
    }

    await UserProfile.updateOne({ userId: target.id, guildId }, { $inc: { coins: amount } }, { upsert: true });
    await logTransaction(guildId, interaction.user.id, "pay_sent", amount, target.id);
    await logTransaction(guildId, target.id, "pay_received", amount, interaction.user.id);

    await interaction.reply(`✅ حوّلت ${jenny(amount)} لـ ${target}.`);
  },
};

export default command;
