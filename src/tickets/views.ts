import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type { ITicket } from "../database/models/Ticket";
import {
  TICKET_CANCEL,
  TICKET_CLAIM,
  TICKET_CLOSE,
  TICKET_CLOSE_YES,
  TICKET_MODAL_HELP,
  TICKET_MODAL_REPORT,
  TICKET_OPEN_HELP,
  TICKET_OPEN_REPORT,
  type TicketType,
} from "./ids";

const COLORS = { help: 0x38bdf8, report: 0xef4444, claimed: 0x22c55e } as const;

export const TYPE_LABEL: Record<TicketType, string> = { help: "Help Request", report: "Report" };
export const TYPE_EMOJI: Record<TicketType, string> = { help: "💬", report: "🚨" };

export const ticketNumber = (n: number) => String(n).padStart(4, "0");

export function buildTicketPanel(guildName: string, bannerUrl: string | null) {
  const embed = new EmbedBuilder()
    .setColor(COLORS.help)
    .setTitle("🎫 Support Center")
    .setDescription(
      [
        "Need a hand, or want to flag a problem? Open a private ticket and the staff team will get back to you.",
        "",
        "**What you can open a ticket for**",
        "• Asking for help, advice or guidance",
        "• Reporting a member or a staff member",
        "• Reporting a bug or a problem in the server",
        "• Anything else that needs staff attention",
        "",
        "**Before you open one**",
        "• Pick the button that matches your case",
        "• Describe the issue clearly so we can help faster",
        "• Only one open ticket per member",
        "• A transcript is saved when the ticket is closed",
      ].join("\n"),
    )
    .setFooter({ text: guildName });
  if (bannerUrl) embed.setImage(bannerUrl);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(TICKET_OPEN_HELP).setLabel("Request Help").setEmoji("💬").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(TICKET_OPEN_REPORT).setLabel("Submit Report").setEmoji("🚨").setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

const input = (id: string, label: string, style: TextInputStyle, min: number, max: number, required: boolean, placeholder?: string) => {
  const b = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setMinLength(min).setMaxLength(max).setRequired(required);
  if (placeholder) b.setPlaceholder(placeholder);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(b);
};

export function buildHelpModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(TICKET_MODAL_HELP)
    .setTitle("Request Help")
    .addComponents(
      input("subject", "What do you need help with?", TextInputStyle.Short, 3, 80, true),
      input("details", "Details", TextInputStyle.Paragraph, 5, 1000, true, "Explain your situation as clearly as you can"),
    );
}

export function buildReportModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(TICKET_MODAL_REPORT)
    .setTitle("Submit Report")
    .addComponents(
      input("subject", "Who or what are you reporting?", TextInputStyle.Short, 3, 80, true, "Username, user ID, or a short title"),
      input("details", "What happened?", TextInputStyle.Paragraph, 5, 1000, true),
      input("evidence", "Evidence (optional)", TextInputStyle.Paragraph, 0, 500, false, "Links to messages or screenshots"),
    );
}

export interface TicketContent {
  type: TicketType;
  subject: string;
  details: string;
  evidence?: string;
}

export function ticketControls(claimed: boolean) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_CLAIM)
        .setLabel(claimed ? "Claimed" : "Claim")
        .setEmoji("✋")
        .setStyle(ButtonStyle.Success)
        .setDisabled(claimed),
      new ButtonBuilder().setCustomId(TICKET_CLOSE).setLabel("Close Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
    ),
  ];
}

export function buildTicketMessage(
  ticket: Pick<ITicket, "ownerId" | "number" | "claimedBy">,
  content: TicketContent,
  supportRoleId: string,
) {
  const claimed = !!ticket.claimedBy;
  const embed = new EmbedBuilder()
    .setColor(claimed ? COLORS.claimed : COLORS[content.type])
    .setTitle(`${TYPE_EMOJI[content.type]} ${TYPE_LABEL[content.type]} #${ticketNumber(ticket.number)}`)
    .setDescription(`**${content.subject}**\n\n${content.details}`)
    .addFields(
      { name: "Opened by", value: `<@${ticket.ownerId}>`, inline: true },
      { name: "Status", value: claimed ? `✋ Claimed by <@${ticket.claimedBy}>` : "⏳ Waiting for staff", inline: true },
    );
  if (content.evidence) embed.addFields({ name: "Evidence", value: content.evidence });

  return {
    content: `<@${ticket.ownerId}> <@&${supportRoleId}>`,
    embeds: [embed],
    components: ticketControls(claimed),
    allowedMentions: { users: [ticket.ownerId], roles: [supportRoleId] },
  };
}

export function confirmClose() {
  return {
    content: "🔒 Close this ticket? A transcript will be saved and the channel will be deleted.",
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(TICKET_CLOSE_YES).setLabel("Confirm").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(TICKET_CANCEL).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}
