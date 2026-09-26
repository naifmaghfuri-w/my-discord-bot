import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { BIRTHDAY_EMOJI, CURRENCY } from "../constants";
import { isValidBirthday, setBirthday } from "../services/birthday";
import { logger } from "../utils/logger";
import {
  MENU_ACHIEVEMENTS_BUTTON,
  MENU_BALANCE_BUTTON,
  MENU_BIRTHDAY_BUTTON,
  SETBIRTHDAY_BUTTON,
  SETBIRTHDAY_MODAL,
} from "./ids";
import { buildAchievementsEmbed, buildBalanceContent, buildBirthdayPanel } from "./views";

/** رسالة القائمة العامة (تُنشر عند كتابة "p")، أي عضو يقدر يضغط أزرارها */
export function buildMenuMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x818cf8)
    .setTitle("📋 القائمة الرئيسية")
    .setDescription("اضغط أي زر بالأسفل — الرد يكون خاص بك بس.");

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(MENU_ACHIEVEMENTS_BUTTON).setLabel("إنجازاتي").setEmoji("🏆").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(MENU_BALANCE_BUTTON).setLabel("الرصيد").setEmoji(CURRENCY.emoji).setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(MENU_BIRTHDAY_BUTTON)
      .setLabel("عيد الميلاد")
      .setEmoji({ id: "1553179328840474695" })
      .setStyle(ButtonStyle.Secondary),
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

  if (customId === MENU_BIRTHDAY_BUTTON) {
    const panel = await buildBirthdayPanel(interaction.user.id, guildId);
    await interaction.reply({ embeds: [panel.embed], components: panel.components, flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === SETBIRTHDAY_BUTTON) {
    const modal = new ModalBuilder()
      .setCustomId(SETBIRTHDAY_MODAL)
      .setTitle(`${BIRTHDAY_EMOJI} حدد عيد ميلادك`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("date")
            .setLabel("تاريخ ميلادك (يوم/شهر)")
            .setPlaceholder("مثال: 15/3")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(5)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

export async function handleMenuModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId || customId !== SETBIRTHDAY_MODAL) return false;

  const raw = interaction.fields.getTextInputValue("date").trim();
  const match = /^(\d{1,2})[\/\-](\d{1,2})$/.exec(raw);

  if (!match) {
    await interaction.reply({
      content: "❌ الصيغة غلط. اكتب يوم/شهر، مثال: 15/3",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);

  if (!isValidBirthday(day, month)) {
    await interaction.reply({ content: "❌ التاريخ غير صحيح، تأكد من اليوم والشهر.", flags: MessageFlags.Ephemeral });
    return true;
  }

  await setBirthday(interaction.user.id, guildId, day, month).catch((err) => {
    logger.error("فشل حفظ عيد الميلاد", err);
  });

  await interaction.reply({
    content: `✅ تم حفظ عيد ميلادك: **${day}/${month}** ${BIRTHDAY_EMOJI}`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}
