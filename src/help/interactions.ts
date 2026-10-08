import { MessageFlags, type ButtonInteraction } from "discord.js";
import { buildHelpHome, buildHelpSection } from "./views";

export async function handleHelpButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("help_")) return false;

  const [head, ownerId = ""] = interaction.customId.split("|");
  const section = head.slice("help_".length);

  if (ownerId !== interaction.user.id) {
    await interaction.reply({ content: "اكتب `مساعدة` وتفتح لوحتك الخاصة 📖", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    return true;
  }

  const guildName = interaction.guild?.name ?? "";
  const view = section === "home" ? buildHelpHome(ownerId, guildName) : buildHelpSection(section, ownerId, guildName);
  await interaction.update(view);
  return true;
}
