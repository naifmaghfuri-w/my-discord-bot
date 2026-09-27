import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";
import { CURRENCY } from "../constants";
import { MENU_ACHIEVEMENTS_BUTTON, MENU_BALANCE_BUTTON, MENU_WEEKLY_BUTTON } from "./ids";
import { buildAchievementsEmbed, buildBalanceContent, buildWeeklyEmbed } from "./views";

/** رسالة القائمة العامة (تُنشر عند كتابة "p")، أي عضو يقدر يضغط أزرارها */
export function buildMenuMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x818cf8)
    .setTitle("📋 القائمة الرئيسية")
    .setDescription("اضغط أي زر بالأسفل — الرد يكون خاص بك بس.");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(MENU_ACHIEVEMENTS_BUTTON).setLabel("إنجازاتي").setEmoji("🏆").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(MENU_BALANCE_BUTTON).setLabel("الرصيد").setEmoji(CURRENCY.emoji).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(MENU_WEEKLY_BUTTON).setLabel("الأسبوعية").setEmoji("📆").setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export async function handleMenuButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;

  if (customId === MENU_ACHIEVEMENTS_BUTTON) {
    const embed = await buildAchievementsEmbed(interaction.user.id, guildId);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === MENU_BALANCE_BUTTON) {
    const content = await buildBalanceContent(interaction.user.id, guildId, interaction.user.username);
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === MENU_WEEKLY_BUTTON) {
    const embed = await buildWeeklyEmbed(interaction.user.id, guildId);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  return false;
}
