import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../types";
import { jenny, REWARDS } from "../../constants";
import { reward } from "../../services/economy";
import { getGuild } from "../../utils/guild";

type Choice = "rock" | "paper" | "scissors";

const CHOICES: { id: Choice; label: string; emoji: string }[] = [
  { id: "rock", label: "حجر", emoji: "🪨" },
  { id: "paper", label: "ورقة", emoji: "📄" },
  { id: "scissors", label: "مقص", emoji: "✂️" },
];

// كل عنصر يهزم العنصر المكتوب أمامه
const BEATS: Record<Choice, Choice> = { rock: "scissors", paper: "rock", scissors: "paper" };
const show = (id: Choice) => {
  const c = CHOICES.find((x) => x.id === id)!;
  return `${c.emoji} ${c.label}`;
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("حجر ورقة مقص ضد البوت")
    .setContexts(InteractionContextType.Guild),
  cooldown: 5,

  async execute(interaction) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      CHOICES.map((c) =>
        new ButtonBuilder().setCustomId(c.id).setLabel(c.label).setEmoji(c.emoji).setStyle(ButtonStyle.Primary),
      ),
    );

    await interaction.reply({ content: "اختر حركتك خلال 30 ثانية 👇", components: [row] });
    const message = await interaction.fetchReply();

    try {
      const click = await message.awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === interaction.user.id,
        time: 30_000,
      });

      const player = click.customId as Choice;
      const bot = CHOICES[Math.floor(Math.random() * CHOICES.length)].id;

      let outcome: string;
      if (player === bot) {
        outcome = "🤝 تعادل!";
      } else if (BEATS[player] === bot) {
        await reward(interaction.user.id, getGuild(interaction).id, REWARDS.rpsWin, true);
        outcome = `🎉 فزت! (+${jenny(REWARDS.rpsWin)})`;
      } else {
        outcome = "😅 فاز البوت!";
      }

      await click.update({
        content: `أنت: **${show(player)}**\nالبوت: **${show(bot)}**\n\n${outcome}`,
        components: [],
      });
    } catch {
      await interaction.editReply({ content: "⌛ انتهى الوقت.", components: [] });
    }
  },
};

export default command;
