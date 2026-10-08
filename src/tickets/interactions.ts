import { MessageFlags, type ButtonInteraction, type GuildMember, type ModalSubmitInteraction, type TextChannel } from "discord.js";
import { logger } from "../utils/logger";
import { TICKET_CANCEL, TICKET_CLAIM, TICKET_CLOSE, TICKET_CLOSE_YES, TICKET_MODAL, TICKET_OPEN } from "./ids";
import { claimTicket, closeTicket, getTicketByChannel, getTicketConfig, isStaff, openTicket } from "./service";
import { buildOpenModal, buildTicketMessage, confirmClose } from "./views";

const eph = (content: string) => ({ content, flags: MessageFlags.Ephemeral }) as const;

export async function handleTicketButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("ticket_")) return false;
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(eph("❌ يشتغل داخل السيرفر فقط."));
    return true;
  }

  try {
    if (interaction.customId === TICKET_OPEN) {
      await interaction.showModal(buildOpenModal());
      return true;
    }
    if (interaction.customId === TICKET_CANCEL) {
      await interaction.update({ content: "تم الإلغاء.", components: [] });
      return true;
    }

    const ticket = await getTicketByChannel(interaction.channelId);
    const config = await getTicketConfig(guild.id);
    if (!ticket || !config) {
      await interaction.reply(eph("❌ هذي مو تذكرة مفتوحة."));
      return true;
    }
    const member = (await guild.members.fetch(interaction.user.id)) as GuildMember;
    const staff = isStaff(member, config.supportRoleId);

    switch (interaction.customId) {
      case TICKET_CLAIM: {
        if (!staff) {
          await interaction.reply(eph("⛔ الاستلام لفريق الدعم فقط."));
          return true;
        }
        if (!(await claimTicket(ticket, interaction.user.id))) {
          await interaction.reply(eph("ℹ️ التذكرة مستلمة بالفعل."));
          return true;
        }
        const details = interaction.message.embeds[0]?.description?.split("\n\n").slice(1).join("\n\n") ?? "";
        const msg = buildTicketMessage({ ...ticket.toObject(), claimedBy: interaction.user.id }, details, config.supportRoleId, true);
        await interaction.update({ embeds: msg.embeds, components: msg.components });
        await (interaction.channel as TextChannel).send({ content: `✋ <@${interaction.user.id}> استلم التذكرة وراح يساعدك <@${ticket.ownerId}>.`, allowedMentions: { users: [ticket.ownerId] } });
        return true;
      }

      case TICKET_CLOSE:
        if (!staff && interaction.user.id !== ticket.ownerId) {
          await interaction.reply(eph("⛔ ما تقدر تغلق هذي التذكرة."));
          return true;
        }
        await interaction.reply({ ...confirmClose(), flags: MessageFlags.Ephemeral });
        return true;

      case TICKET_CLOSE_YES: {
        if (!staff && interaction.user.id !== ticket.ownerId) {
          await interaction.reply(eph("⛔ ما تقدر تغلق هذي التذكرة."));
          return true;
        }
        await interaction.update({ content: "⏳ جاري حفظ المحادثة وإغلاق التذكرة...", components: [] });
        await closeTicket(guild, interaction.channel as TextChannel, ticket, interaction.user.id);
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.error("خطأ في زر التذاكر", err);
    const payload = eph("❌ صار خطأ، حاول مرة ثانية.");
    if (!interaction.replied && !interaction.deferred) await interaction.reply(payload).catch(() => undefined);
    else await interaction.followUp(payload).catch(() => undefined);
    return true;
  }
}

export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (interaction.customId !== TICKET_MODAL) return false;
  const guild = interaction.guild;
  if (!guild) return true;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await guild.members.fetch(interaction.user.id);
    const subject = interaction.fields.getTextInputValue("subject").trim();
    const details = interaction.fields.getTextInputValue("details").trim();

    const res = await openTicket(guild, member, subject, details);
    if (res.ok) await interaction.editReply(`🎫 تم فتح تذكرتك: ${res.channel}`);
    else if (res.reason === "has_open") await interaction.editReply(`ℹ️ عندك تذكرة مفتوحة بالفعل: <#${res.existingChannelId}>`);
    else if (res.reason === "no_config") await interaction.editReply("⚠️ نظام التذاكر ما انضبط بعد. اطلب من الإدارة تشغيل `ticketpanel`.");
    else await interaction.editReply("❌ ما قدرت أفتح التذكرة. تأكد من صلاحيات البوت (إدارة القنوات) وأن الكاتيجوري مو ممتلئ.");
  } catch (err) {
    logger.error("خطأ في نموذج التذاكر", err);
    if (interaction.deferred) await interaction.editReply("❌ صار خطأ، حاول مرة ثانية.").catch(() => undefined);
  }
  return true;
}
