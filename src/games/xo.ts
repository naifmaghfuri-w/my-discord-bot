import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, type Message, type User } from "discord.js";
import { jenny, REWARDS } from "../constants";
import { reward } from "../services/economy";
import { logger } from "../utils/logger";

/** !اكس-او @شخص */
export const XO_TRIGGER = /^!\s*(?:اكس\s*-?\s*او|xo)(?:\s+<@!?(\d+)>)?$/i;

type Mark = "X" | "O";
type Cell = Mark | null;

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function findWinner(board: Cell[]): Mark | null {
  for (const [a, b, c] of LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
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
          .setLabel(v ?? "​")
          .setStyle(v === "X" ? ButtonStyle.Danger : v === "O" ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setDisabled(disabled || v !== null);
      }),
    ),
  );
}

const icon = (m: Mark) => (m === "X" ? "❌" : "⭕");
const busy = new Set<string>();

export async function startXo(message: Message<true>, opponentId: string | undefined): Promise<void> {
  const say = (content: string) => message.reply({ content, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
  if (!opponentId) {
    await say("❌ الاستخدام: `!اكس-او @شخص`");
    return;
  }
  const opponent = await message.client.users.fetch(opponentId).catch(() => null);
  if (!opponent || opponent.bot || opponent.id === message.author.id) {
    await say("❌ اختر عضواً حقيقياً غيرك.");
    return;
  }
  if (busy.has(message.author.id) || busy.has(opponent.id)) {
    await say("⏳ أحدكم عنده مباراة جارية.");
    return;
  }
  busy.add(message.author.id);
  busy.add(opponent.id);
  const release = () => {
    busy.delete(message.author.id);
    busy.delete(opponent.id);
  };

  const players: Record<Mark, User> = { X: message.author, O: opponent };
  const board: Cell[] = Array(9).fill(null);
  let turn: Mark = "X";
  const header = () => `${icon("X")} ${players.X} ضد ${icon("O")} ${players.O}\nالدور: ${icon(turn)} ${players[turn]}`;

  const sent = await message.channel
    .send({ content: header(), components: renderBoard(board), allowedMentions: { users: [opponent.id] } })
    .catch(() => null);
  if (!sent) {
    release();
    return;
  }

  const collector = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });
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
        await btn.update({ content: `🏆 الفائز: ${icon(winner)} ${players[winner]} (+${jenny(REWARDS.xoWin)})`, components: renderBoard(board, true) });
        await reward(players[winner].id, message.guildId, REWARDS.xoWin, true);
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
    release();
    if (reason === "time") await sent.edit({ content: "⌛ انتهت اللعبة بسبب عدم النشاط.", components: renderBoard(board, true) }).catch(() => undefined);
  });
}
