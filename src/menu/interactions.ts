import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
} from "discord.js";
import { CURRENCY } from "../constants";
import { MENU_BALANCE_BUTTON } from "./ids";
import { buildBalanceContent } from "./views";

/** رسالة القائمة العامة (تُنشر عند كتابة "p")، أي عضو يقدر يضغط أزرارها */
export function buildMenuMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x818cf8)
    .setTitle("📋 القائمة الرئيسية")
    .setDescription("اضغط أي زر بالأسفل — الرد يكون خاص بك بس.");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(MENU_BALANCE_BUTTON).setLabel("الرصيد").setEmoji(CURRENCY.emoji).setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export async function handleMenuButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;

  if (customId === MENU_BALANCE_BUTTON) {
    const content = await buildBalanceContent(interaction.user.id, guildId, interaction.user.username);
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    return true;
  }

  return false;
}
