import {
  ActionRowBuilder,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { BirthdayWish } from "../database/models/BirthdayWish";
import { getBirthday, parseBirthdayInput, setBirthday } from "../services/birthday";
import { logger } from "../utils/logger";
import {
  BIRTHDAY_DETAILS_BUTTON,
  BIRTHDAY_EDIT_BUTTON,
  BIRTHDAY_EDIT_MODAL,
  BIRTHDAY_UPCOMING_BUTTON,
  BIRTHDAY_WISH_PREFIX,
} from "./ids";
import { buildDetailsEmbed, buildUpcomingEmbed } from "./views";

const MAX_SHOWN_WISHERS = 15;

async function handleWish(interaction: ButtonInteraction, guildId: string): Promise<void> {
  const [, targetId, yearStr] = interaction.customId.split(":");
  const year = Number(yearStr);
  const wisherId = interaction.user.id;

  if (!targetId || !Number.isInteger(year)) {
    await interaction.reply({ content: "هذا الزر ما عاد صالحاً.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (wisherId === targetId) {
    await interaction.reply({ content: "استمتع بيومك! الباقي بيرسلون لك تهانيهم.", flags: MessageFlags.Ephemeral });
    return;
  }

  const filter = { guildId, userId: targetId, year };
  const existing = await BirthdayWish.findOne(filter);
  if (existing?.wisherIds.includes(wisherId)) {
    await interaction.reply({ content: "أرسلت تهنئتك من قبل.", flags: MessageFlags.Ephemeral });
    return;
  }

  const doc = await BirthdayWish.findOneAndUpdate(
    filter,
    { $addToSet: { wisherIds: wisherId } },
    { upsert: true, new: true },
  );
  const ids = doc?.wisherIds ?? [wisherId];

  const base = interaction.message.embeds[0];
  if (!base) {
    await interaction.reply({ content: "تم إرسال تهنئتك!", flags: MessageFlags.Ephemeral });
    return;
  }

  const kept = (base.fields ?? [])
    .filter((f) => !f.name.startsWith("🎉 Wishes"))
    .map((f) => ({ name: f.name, value: f.value, inline: f.inline }));
  const shown = ids.slice(-MAX_SHOWN_WISHERS).map((id) => `<@${id}>`).join(" ");
  const extra = ids.length > MAX_SHOWN_WISHERS ? ` +${ids.length - MAX_SHOWN_WISHERS} more` : "";

  const embed = EmbedBuilder.from(base).setFields([
    ...kept,
    { name: `🎉 Wishes (${ids.length})`, value: `${shown}${extra}` },
  ]);
  await interaction.update({ embeds: [embed] });
}

export async function handleBirthdayButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;

  if (customId.startsWith(BIRTHDAY_WISH_PREFIX)) {
    await handleWish(interaction, guildId);
    return true;
  }

  if (customId === BIRTHDAY_UPCOMING_BUTTON) {
    const embed = await buildUpcomingEmbed(guildId);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === BIRTHDAY_DETAILS_BUTTON) {
    const b = await getBirthday(interaction.user.id, guildId);
    if (!b) {
      await interaction.reply({ content: "ما سجّلت عيد ميلادك بعد.", flags: MessageFlags.Ephemeral });
      return true;
    }
    const embed = buildDetailsEmbed(b, interaction.user.displayName);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  if (customId === BIRTHDAY_EDIT_BUTTON) {
    const modal = new ModalBuilder()
      .setCustomId(BIRTHDAY_EDIT_MODAL)
      .setTitle("تعديل عيد ميلادك")
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId("date")
            .setLabel("تاريخ ميلادك (يوم/شهر/سنة)")
            .setPlaceholder("مثال: 15/8/2001 أو 15/8 (السنة اختيارية)")
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

  const parsed = parseBirthdayInput(interaction.fields.getTextInputValue("date"));

  if (parsed === "format") {
    await interaction.reply({
      content: "الصيغة غلط. اكتب يوم/شهر/سنة، مثل `15/8/2001` (أو `15/8` بدون سنة).",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }
  if (parsed === "invalid") {
    await interaction.reply({ content: "هذا التاريخ غير صحيح.", flags: MessageFlags.Ephemeral });
    return true;
  }

  await setBirthday(interaction.user.id, guildId, parsed.day, parsed.month, parsed.year).catch((err) => {
    logger.error("فشل حفظ عيد الميلاد", err);
  });

  const shown = `${parsed.day}/${parsed.month}${parsed.year !== undefined ? `/${parsed.year}` : ""}`;
  await interaction.reply({
    content: `تم تسجيل عيد ميلادك: **${shown}**${parsed.year === undefined ? "\nما حددت سنة، فما راح يظهر عمرك." : ""}`,
    flags: MessageFlags.Ephemeral,
  });
  return true;
}
