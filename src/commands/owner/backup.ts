import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { config } from "../../config";
import { createBackup, summarize } from "../../backup/service";
import type { Command } from "../../types";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("backup")
    .setDescription("[المالك فقط] نسخة احتياطية من قاعدة البيانات الآن")
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM),
  cooldown: 60,

  async execute(interaction) {
    if (!config.ownerId || interaction.user.id !== config.ownerId) {
      await interaction.reply({ content: "⛔ هذا الأمر خاص بمالك البوت فقط.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await createBackup();
    const parts = result.parts.slice(0, 10);
    await interaction.editReply({
      content: summarize(result) + (result.parts.length > 10 ? `\n⚠️ أُرسل أول 10 ملفات فقط من ${result.parts.length}.` : ""),
      files: parts.map((p) => ({ attachment: p.data, name: p.name })),
    });
  },
};

export default command;
