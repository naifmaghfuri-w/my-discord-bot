import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../types";
import { jenny, REWARDS } from "../../constants";
import { UserProfile } from "../../database/models/UserProfile";
import { getProfile, reward } from "../../services/economy";
import { getGuild } from "../../utils/guild";

const DAY_MS = 24 * 60 * 60 * 1000;

function formatTimeLeft(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.ceil((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours} ساعة و${minutes} دقيقة`;
  return `${minutes} دقيقة`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("لعبة صورة أو كتابة (مرة كل 24 ساعة)")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) =>
      o
        .setName("choice")
        .setDescription("اختيارك")
        .setRequired(true)
        .addChoices({ name: "صورة", value: "heads" }, { name: "كتابة", value: "tails" }),
    ),

  async execute(interaction) {
    const guildId = getGuild(interaction).id;
    const userId = interaction.user.id;
    const threshold = new Date(Date.now() - DAY_MS);

    // نحجز الدور أول (ذري): يمنع اللعب مرتين عند الضغط السريع، وتُحسب المحاولة سواء ربح أو خسر
    const claimed = await UserProfile.findOneAndUpdate(
      {
        userId,
        guildId,
        $or: [{ lastCoinflipAt: { $exists: false } }, { lastCoinflipAt: { $lte: threshold } }],
      },
      { $set: { lastCoinflipAt: new Date() } },
      { upsert: true, new: true },
    );

    if (!claimed) {
      const profile = await getProfile(userId, guildId);
      const last = profile.lastCoinflipAt?.getTime() ?? Date.now();
      const msLeft = Math.max(0, DAY_MS - (Date.now() - last));
      await interaction.reply({
        content: `⏳ تقدر تلعب مرة ثانية بعد ${formatTimeLeft(msLeft)}.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const choice = interaction.options.getString("choice", true);
    const result = Math.random() < 0.5 ? "heads" : "tails";
    const label = (v: string) => (v === "heads" ? "صورة 🪙" : "كتابة 📜");
    const won = choice === result;

    if (won) await reward(userId, guildId, REWARDS.coinflipWin, true);

    await interaction.reply(
      `النتيجة: **${label(result)}**\n${won ? `🎉 ربحت ${jenny(REWARDS.coinflipWin)}!` : "😅 خسرت، جرب بكرة!"}`,
    );
  },
};

export default command;
