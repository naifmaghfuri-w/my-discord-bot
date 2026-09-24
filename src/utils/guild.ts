import type { ChatInputCommandInteraction, Guild } from "discord.js";

/** يرجع السيرفر أو يرمي خطأ (يلتقطه معالج الأخطاء العام) */
export function getGuild(interaction: ChatInputCommandInteraction): Guild {
  if (!interaction.guild) throw new Error("هذا الأمر يعمل داخل السيرفرات فقط");
  return interaction.guild;
}
