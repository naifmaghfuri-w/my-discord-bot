import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../../types";
import { reward } from "../../services/economy";
import { getGuild } from "../../utils/guild";
import { logger } from "../../utils/logger";

type Mark = "X" | "O";
type Cell = Mark | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function findWinner(board: Cell[]): Mark | null {
  for (const [a, b, c] of LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function renderBoard(board: Cell[], disabled = false): ActionRowBuilder<ButtonBuilder>[] {
  return [0, 1, 2].map((r) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      [0, 1, 2].map((c) => {
        const i = r * 3 + c;
        const v = board[i];
        return new ButtonBuilder()
          .setCustomId(`xo_${i}`)
          .setLabel(v ?? "\u200b")
          .setStyle(v === "X" ? ButtonStyle.Danger : v === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(disabled || v !== null);
      }),
    ),
  );
}

const icon = (m: Mark) => (m === "X" ? "❌" : "⭕");

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("xo")
    .setDescription("لعبة XO ضد عضو آخر")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("opponent").setDescription("منافسك").setRequired(true)),
  cooldown: 10,

  async execute(interaction) {
    const opponent = interaction.options.getUser("opponent", true);
    if (opponent.bot || opponent.id === interaction.user.id) {
      await interaction.reply({ content: "❌ اختر عضواً حقيقياً غيرك.", flags: MessageFlags.Ephemeral });
      return;
    }

    const guildId = getGuild(interaction).id;
    const players = { X: interaction.user, O: opponent };
    const board: Cell[] = Array(9).fill(null);
    let turn: Mark = "X";

    const header = () => `${icon("X")} ${players.X} ضد ${icon("O")} ${players.O}\nالدور: ${icon(turn)} ${players[turn]}`;

    await interaction.reply({ content: header(), components: renderBoard(board) });
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on("collect", async (btn) => {
      try {
        if (btn.user.id !== players.X.id && btn.user.id !== players.O.id) {
          await btn.reply({ content: "⛔ أنت لست لاعباً في هذه المباراة.", flags: MessageFlags.Ephemeral });
          return;
        }
        if (btn.user.id !== players[turn].id) {
          await btn.reply({ content: "⛔ ليس دورك.", flags: MessageFlags.Ephemeral });
          return;
        }

        const idx = Number(btn.customId.split("_")[1]);
        if (board[idx]) return;
        board[idx] = turn;

        const winner = findWinner(board);
        if (winner) {
          collector.stop("finished");
          await btn.update({
            content: `🏆 الفائز: ${icon(winner)} ${players[winner]} (+100 عملة)`,
            components: renderBoard(board, true),
          });
          await reward(players[winner].id, guildId, 100, true);
          return;
        }

        if (board.every(Boolean)) {
          collector.stop("finished");
          await btn.update({ content: "🤝 تعادل!", components: renderBoard(board, true) });
          return;
        }

        turn = turn === "X" ? "O" : "X";
        await btn.update({ content: header(), components: renderBoard(board) });
      } catch (err) {
        logger.error("خطأ في لعبة XO", err);
      }
    });

    collector.on("end", async (_c, reason) => {
      if (reason === "time") {
        await interaction
          .editReply({ content: "⌛ انتهت اللعبة بسبب عدم النشاط.", components: renderBoard(board, true) })
          .catch(() => undefined);
      }
    });
  },
};

export default command;
