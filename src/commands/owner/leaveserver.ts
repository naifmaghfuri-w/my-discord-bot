import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { config } from "../../config";
import type { Command } from "../../types";

/** يتأكد أن المستخدم هو مالك البوت (OWNER_ID في .env) */
function isOwner(userId: string): boolean {
  return !!config.ownerId && userId === config.ownerId;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("leaveserver")
    .setDescription("[المالك فقط] يخرج البوت من سيرفر معيّن")
    .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM)
    .addStringOption((o) =>
      o.setName("server").setDescription("اسم أو معرف السيرفر").setRequired(true).setAutocomplete(true),
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.reply({ content: "⛔ هذا الأمر خاص بمالك البوت فقط.", flags: MessageFlags.Ephemeral });
      return;
    }

    const guildId = interaction.options.getString("server", true).trim();
    const guild = interaction.client.guilds.cache.get(guildId);

    if (!guild) {
      await interaction.reply({
        content: "❌ ما لقيت سيرفر بهذا المعرف. استخدم الاقتراحات التلقائية أثناء الكتابة.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const name = guild.name;
    await guild.leave();
    await interaction.reply({ content: `✅ خرجت من سيرفر **${name}** (\`${guildId}\`).`, flags: MessageFlags.Ephemeral });
  },

  /** اقتراحات تلقائية أثناء الكتابة: تبحث بالاسم أو المعرف، ولا تظهر شيء لغير المالك */
  async autocomplete(interaction) {
    if (!isOwner(interaction.user.id)) {
      await interaction.respond([]);
      return;
    }

    const query = interaction.options.getFocused().toLowerCase();
    const results = interaction.client.guilds.cache
      .filter((g) => g.name.toLowerCase().includes(query) || g.id.includes(query))
      .map((g) => ({ name: `${g.name} (${g.memberCount} عضو) — ${g.id}`, value: g.id }))
      .slice(0, 25);

    await interaction.respond(results);
  },
};

export default command;
