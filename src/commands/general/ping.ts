import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";

const command: Command = {
  data: new SlashCommandBuilder().setName("ping").setDescription("يعرض سرعة استجابة البوت"),

  async execute(interaction) {
    await interaction.reply("🏓 جارٍ القياس...");
    const sent = await interaction.fetchReply();
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply(`🏓 Pong!\nالاستجابة: **${latency}ms**\nAPI: **${interaction.client.ws.ping}ms**`);
  },
};

export default command;
