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
  TICKET_MODAL,
  TICKET_OPEN,
} from "./ids";

const COLOR = 0x0ea5e9;

export function buildTicketPanel(guildName: string, bannerUrl: string | null) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🎫 الدعم الفني")
    .setDescription(
      [
        "تحتاج مساعدة؟ عندك استفسار أو شكوى أو اقتراح؟",
        "اضغط الزر بالأسفل لفتح تذكرة خاصة بينك وبين فريق الإدارة.",
        "",
        "• اكتب مشكلتك بوضوح عشان نخدمك أسرع",
        "• تذكرة واحدة مفتوحة لكل عضو",
        "• تُحفظ نسخة من المحادثة عند الإغلاق",
      ].join("\n"),
    )
    .setFooter({ text: guildName });
  if (bannerUrl) embed.setImage(bannerUrl);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(TICKET_OPEN).setLabel("فتح تذكرة").setEmoji("🎫").setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

export function buildOpenModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(TICKET_MODAL)
    .setTitle("فتح تذكرة")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("subject").setLabel("عنوان المشكلة").setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(80).setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("details").setLabel("التفاصيل").setStyle(TextInputStyle.Paragraph).setMinLength(5).setMaxLength(1000).setRequired(true),
      ),
    );
}

export function buildTicketMessage(ticket: Pick<ITicket, "ownerId" | "number" | "subject" | "claimedBy">, details: string, supportRoleId: string, claimed = false) {
  const embed = new EmbedBuilder()
    .setColor(claimed ? 0x22c55e : COLOR)
    .setTitle(`🎫 تذكرة #${String(ticket.number).padStart(4, "0")}`)
    .setDescription(`**العنوان:** ${ticket.subject}\n\n${details}`)
    .addFields(
      { name: "صاحب التذكرة", value: `<@${ticket.ownerId}>`, inline: true },
      { name: "الحالة", value: ticket.claimedBy ? `✋ استلمها <@${ticket.claimedBy}>` : "⏳ بانتظار الدعم", inline: true },
    );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(TICKET_CLAIM).setLabel(claimed ? "تم الاستلام" : "استلام").setEmoji("✋").setStyle(ButtonStyle.Success).setDisabled(claimed),
    new ButtonBuilder().setCustomId(TICKET_CLOSE).setLabel("إغلاق التذكرة").setEmoji("🔒").setStyle(ButtonStyle.Danger),
  );
  return {
    content: `<@${ticket.ownerId}> <@&${supportRoleId}>`,
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [ticket.ownerId], roles: [supportRoleId] },
  };
}

export function confirmClose() {
  return {
    content: "🔒 تأكيد إغلاق التذكرة؟ بيتم حفظ نسخة من المحادثة ثم تنحذف القناة.",
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(TICKET_CLOSE_YES).setLabel("تأكيد الإغلاق").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(TICKET_CANCEL).setLabel("إلغاء").setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}
