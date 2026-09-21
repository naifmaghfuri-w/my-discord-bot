import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { reward } from "../../services/economy";
import { getGuild } from "../../utils/guild";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("لعبة صورة أو كتابة")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName("choice")
        .setDescription("اختيارك")
        .setRequired(true)
        .addChoices({ name: "صورة", value: "heads" }, { name: "كتابة", value: "tails" }),
    ),
  cooldown: 5,

  async execute(interaction) {
    const choice = interaction.options.getString("choice", true);
    const result = Math.random() < 0.5 ? "heads" : "tails";
    const label = (v: string) => (v === "heads" ? "صورة 🪙" : "كتابة 📜");
    const won = choice === result;

    if (won) await reward(interaction.user.id, getGuild(interaction).id, 20, true);

    await interaction.reply(`النتيجة: **${label(result)}**\n${won ? "🎉 ربحت **20** عملة!" : "😅 خسرت، حاول مرة ثانية!"}`);
  },
};

export default command;
