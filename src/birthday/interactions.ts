import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { BIRTHDAY_EMOJI } from "../constants";
import { getBirthday, isValidBirthday, setBirthday } from "../services/birthday";
import { logger } from "../utils/logger";
import { BIRTHDAY_DETAILS_BUTTON, BIRTHDAY_EDIT_BUTTON, BIRTHDAY_EDIT_MODAL, BIRTHDAY_UPCOMING_BUTTON } from "./ids";
import { buildDetailsEmbed, buildUpcomingEmbed } from "./views";

export async function handleBirthdayButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;

  if (customId === BIRTHDAY_UPCOMING_BUTTON) {
    const embed = await buildUpcomingEmbed(guildId);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === BIRTHDAY_DETAILS_BUTTON) {
    const b = await getBirthday(interaction.user.id, guildId);
    if (!b) {
      await interaction.reply({ content: "❌ ما سجّلت عيد ميلادك بعد.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const embed = buildDetailsEmbed(b, interaction.user.displayName);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === BIRTHDAY_EDIT_BUTTON) {
    const modal = new ModalBuilder()
      .setCustomId(BIRTHDAY_EDIT_MODAL)
      .setTitle(`${BIRTHDAY_EMOJI} تعديل عيد ميلادك`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("date")
            .setLabel("تاريخ ميلادك (يوم/شهر/سنة)")
            .setPlaceholder("مثال: 15/8/2001")
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setRequired(true),
        ),
      );
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

export async function handleBirthdayModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId || customId !== BIRTHDAY_EDIT_MODAL) return false;

  const raw = interaction.fields.getTextInputValue("date").trim();
  const match = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(raw);

  if (!match) {
    await interaction.reply({
      content: "❌ الصيغة غلط. اكتب يوم/شهر/سنة، مثال: 15/8/2001",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (!isValidBirthday(day, month, year)) {
    await interaction.reply({ content: "❌ التاريخ غير صحيح.", flags: MessageFlags.Ephemeral });
    return true;
  }

  await setBirthday(interaction.user.id, guildId, day, month, year).catch((err) => {
    logger.error("فشل حفظ عيد الميلاد", err);
  });

  await interaction.reply({
    content: `✅ تم تحديث عيد ميلادك: **${day}/${month}/${year}** ${BIRTHDAY_EMOJI}`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}
