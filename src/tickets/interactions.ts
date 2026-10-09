import {
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type GuildMember,
  type ModalSubmitInteraction,
  type TextChannel,
} from "discord.js";
import { logger } from "../utils/logger";
import {
  TICKET_CANCEL,
  TICKET_CLAIM,
  TICKET_CLOSE,
  TICKET_CLOSE_YES,
  TICKET_MODAL_HELP,
  TICKET_MODAL_LEGACY,
  TICKET_MODAL_REPORT,
  TICKET_OPEN_HELP,
  TICKET_OPEN_LEGACY,
  TICKET_OPEN_REPORT,
  type TicketType,
} from "./ids";
import { claimTicket, closeTicket, getTicketByChannel, getTicketConfig, isStaff, openTicket } from "./service";
import { buildHelpModal, buildReportModal, confirmClose, ticketControls } from "./views";

const eph = (content: string) => ({ content, flags: MessageFlags.Ephemeral }) as const;

export async function handleTicketButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("ticket_")) return false;
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply(eph("❌ This only works inside a server."));
    return true;
  }

  try {
    if (interaction.customId === TICKET_OPEN_HELP || interaction.customId === TICKET_OPEN_LEGACY) {
      await interaction.showModal(buildHelpModal());
      return true;
    }
    if (interaction.customId === TICKET_OPEN_REPORT) {
      await interaction.showModal(buildReportModal());
      return true;
    }
    if (interaction.customId === TICKET_CANCEL) {
      await interaction.update({ content: "Cancelled.", components: [] });
      return true;
    }

    const ticket = await getTicketByChannel(interaction.channelId);
    const config = await getTicketConfig(guild.id);
    if (!ticket || !config) {
      await interaction.reply(eph("❌ This isn't an open ticket."));
      return true;
    }
    const member = (await guild.members.fetch(interaction.user.id)) as GuildMember;
    const staff = isStaff(member, config.supportRoleId);

    switch (interaction.customId) {
      case TICKET_CLAIM: {
        if (!staff) {
          await interaction.reply(eph("⛔ Only the support team can claim tickets."));
          return true;
        }
        if (!(await claimTicket(ticket, interaction.user.id))) {
          await interaction.reply(eph("ℹ️ This ticket has already been claimed."));
          return true;
        }
        // نحدّث الإيمبد الموجود (الحالة واللون) بدون ما نعيد بناء محتواه
        const base = interaction.message.embeds[0];
        const fields = (base?.fields ?? []).map((f) =>
          f.name === "Status"
            ? { name: f.name, value: `✋ Claimed by <@${interaction.user.id}>`, inline: f.inline }
            : { name: f.name, value: f.value, inline: f.inline },
        );
        const embed = base ? EmbedBuilder.from(base).setColor(0x22c55e).setFields(fields) : undefined;
        await interaction.update({ ...(embed ? { embeds: [embed] } : {}), components: ticketControls(true) });
        await (interaction.channel as TextChannel).send({
          content: `✋ <@${interaction.user.id}> has claimed this ticket and will help you, <@${ticket.ownerId}>.`,
          allowedMentions: { users: [ticket.ownerId, interaction.user.id] },
        });
        return true;
      }

      case TICKET_CLOSE:
        if (!staff && interaction.user.id !== ticket.ownerId) {
          await interaction.reply(eph("⛔ You can't close this ticket."));
          return true;
        }
        await interaction.reply({ ...confirmClose(), flags: MessageFlags.Ephemeral });
        return true;

      case TICKET_CLOSE_YES: {
        if (!staff && interaction.user.id !== ticket.ownerId) {
          await interaction.reply(eph("⛔ You can't close this ticket."));
          return true;
        }
        await interaction.update({ content: "⏳ Saving the transcript and closing the ticket...", components: [] });
        await closeTicket(guild, interaction.channel as TextChannel, ticket, interaction.user.id);
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.error("Ticket button error", err);
    const payload = eph("❌ Something went wrong, please try again.");
    if (!interaction.replied && !interaction.deferred) await interaction.reply(payload).catch(() => undefined);
    else await interaction.followUp(payload).catch(() => undefined);
    return true;
  }
}

export async function handleTicketModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const id = interaction.customId;
  const type: TicketType | null =
    id === TICKET_MODAL_HELP || id === TICKET_MODAL_LEGACY ? "help" : id === TICKET_MODAL_REPORT ? "report" : null;
  if (!type) return false;

  const guild = interaction.guild;
  if (!guild) return true;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await guild.members.fetch(interaction.user.id);
    const subject = interaction.fields.getTextInputValue("subject").trim();
    const details = interaction.fields.getTextInputValue("details").trim();
    const evidence = type === "report" ? interaction.fields.getTextInputValue("evidence").trim() || undefined : undefined;

    const res = await openTicket(guild, member, { type, subject, details, evidence });
    if (res.ok) await interaction.editReply(`🎫 Your ticket has been opened: ${res.channel}`);
    else if (res.reason === "has_open") await interaction.editReply(`ℹ️ You already have an open ticket: <#${res.existingChannelId}>`);
    else if (res.reason === "no_config") await interaction.editReply("⚠️ The ticket system hasn't been set up yet. Ask the staff to run `ticketpanel`.");
    else await interaction.editReply("❌ I couldn't open the ticket. Make sure I have the Manage Channels permission and the category isn't full.");
  } catch (err) {
    logger.error("Ticket modal error", err);
    if (interaction.deferred) await interaction.editReply("❌ Something went wrong, please try again.").catch(() => undefined);
  }
  return true;
}
