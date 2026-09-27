import { InteractionContextType, SlashCommandBuilder } from "discord.js";
import { attemptRob } from "../../bank/service";
import { jenny } from "../../constants";
import type { Command } from "../../types";
import { getGuild } from "../../utils/guild";

function formatMinutes(ms: number): string {
  return `${Math.ceil(ms / 60_000)} دقيقة`;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("rob")
    .setDescription("حاول تسرق من محفظة عضو ثاني (البنك آمن، ما ينسرق)")
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("target").setDescription("الضحية").setRequired(true)),
  cooldown: 5,

  async execute(interaction) {
    const guildId = getGuild(interaction).id;
    const target = interaction.options.getUser("target", true);

    if (target.bot) {
      await interaction.reply("😅 ما تقدر تسرق بوت.");
      return;
    }

    const result = await attemptRob(interaction.user.id, target.id, guildId);

    if (!result.ok) {
      const messages: Record<string, string> = {
        self: "😅 ما تقدر تسرق نفسك.",
        cooldown: `⏳ لازم تنتظر ${formatMinutes((result as { msLeft: number }).msLeft)} قبل ما تسرق مرة ثانية.`,
        victim_too_poor: `💸 محفظة ${target} فاضية تقريباً، ما تستاهل السرقة.`,
        victim_immune: `🛡️ ${target} محمي من السرقة حالياً (${formatMinutes((result as { msLeft: number }).msLeft)} متبقية).`,
        robber_too_poor: "💸 محفظتك فاضية، لازم يكون عندك شوي فلوس قبل ما تسرق.",
      };
      await interaction.reply(messages[result.reason] ?? "❌ ما قدرت أنفذ السرقة.");
      return;
    }

    if (result.success) {
      await interaction.reply(
        `🦹 نجحت! سرقت ${jenny(result.amount)} من محفظة ${target}.`,
      );
      return;
    }

    await interaction.reply(`🚨 انضبطت! دفعت غرامة ${jenny(result.fine)}.`);
  },
};

export default command;
