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
import { addMessage, addNotify, getAfk, readInbox } from "./service";
import { INBOX_PREFIX, MESSAGE_PREFIX, MODAL_PREFIX, NOTIFY_PREFIX } from "./notice";
import { logger } from "../utils/logger";

/** true لو تعامل الكود مع هذا الزر (حتى يعرف المستدعي أنه ما يحتاج يكمل بحث ثاني) */
export async function handleAfkButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;

  if (customId.startsWith(NOTIFY_PREFIX)) {
    const targetId = customId.slice(NOTIFY_PREFIX.length);

    if (targetId === interaction.user.id) {
      await interaction.reply({ content: "ما تقدر تفعّل التنبيه لنفسك.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const still = await getAfk(guildId, targetId);
    if (!still) {
      await interaction.reply({ content: "العضو رجع بالفعل.", flags: MessageFlags.Ephemeral });
      return true;
    }

    await addNotify(guildId, targetId, interaction.user.id);
    await interaction.reply({
      content: "تم، بمنشنك أول ما يرجع.",
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  if (customId.startsWith(MESSAGE_PREFIX)) {
    const targetId = customId.slice(MESSAGE_PREFIX.length);

    const still = await getAfk(guildId, targetId);
    if (!still) {
      await interaction.reply({ content: "العضو رجع بالفعل.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const modal = new ModalBuilder().setCustomId(`${MODAL_PREFIX}${targetId}`).setTitle("اترك رسالة");
    const input = new TextInputBuilder()
      .setCustomId("content")
      .setLabel("رسالتك")
      .setStyle(TextInputStyle.Paragraph)
      .setMaxLength(200)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  if (customId.startsWith(INBOX_PREFIX)) {
    const ownerId = customId.slice(INBOX_PREFIX.length);

    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "هذا الصندوق خاص.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const inbox = await readInbox(guildId, ownerId).catch((err) => {
      logger.error("فشل قراءة صندوق AFK", err);
      return null;
    });

    if (!inbox || inbox.messages.length === 0) {
      await interaction.reply({ content: "صندوقك فاضي.", flags: MessageFlags.Ephemeral });
      return true;
    }

    const embed = new EmbedBuilder()
      .setColor(0xfbbf24)
      .setTitle("رسائلك")
      .setDescription(inbox.messages.map((m) => `**من <@${m.fromUserId}>:**\n${m.content}`).join("\n\n"));

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return true;
  }

  return false;
}

export async function handleAfkModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId || !customId.startsWith(MODAL_PREFIX)) return false;

  const targetId = customId.slice(MODAL_PREFIX.length);
  const content = interaction.fields.getTextInputValue("content").trim();

  if (!content) {
    await interaction.reply({ content: "الرسالة ما تكون فاضية.", flags: MessageFlags.Ephemeral });
    return true;
  }

  const ok = await addMessage(guildId, targetId, interaction.user.id, content).catch((err) => {
    logger.error("فشل حفظ رسالة AFK", err);
    return false;
  });

  await interaction.reply({
    content: ok ? "وصلت رسالتك، وبيشوفها أول ما يرجع." : "صار خطأ، أو العضو رجع قبل ما ترسل.",
    flags: MessageFlags.Ephemeral,
  });
  return true;
}
