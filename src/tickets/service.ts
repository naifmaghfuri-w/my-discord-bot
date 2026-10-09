import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type TextChannel,
} from "discord.js";
import { Ticket, type ITicket } from "../database/models/Ticket";
import { TicketConfig } from "../database/models/TicketConfig";
import { LOG_COLORS, sendLog } from "../logs/logger";
import { logger } from "../utils/logger";
import type { TicketType } from "./ids";
import { buildTicketMessage, ticketNumber, TYPE_EMOJI, TYPE_LABEL, type TicketContent } from "./views";

const ticketChannelIds = new Set<string>();

export const isTicketChannel = (id: string) => ticketChannelIds.has(id);

export async function loadTicketCache(): Promise<void> {
  const rows = await Ticket.find({ status: "open" }, { channelId: 1 }).lean();
  ticketChannelIds.clear();
  for (const r of rows) ticketChannelIds.add(r.channelId);
}

export const getTicketConfig = (guildId: string) => TicketConfig.findOne({ guildId });
export const getTicketByChannel = (channelId: string) => Ticket.findOne({ channelId, status: "open" });

export async function saveTicketConfig(guildId: string, categoryId: string, supportRoleId: string, bannerUrl: string | null) {
  return TicketConfig.findOneAndUpdate(
    { guildId },
    { $set: { categoryId, supportRoleId, ...(bannerUrl !== null ? { bannerUrl } : {}) } },
    { upsert: true, new: true },
  );
}

export function isStaff(member: GuildMember, supportRoleId: string): boolean {
  return (
    member.roles.cache.has(supportRoleId) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

export type OpenResult =
  | { ok: true; channel: TextChannel; ticket: ITicket }
  | { ok: false; reason: "no_config" | "has_open" | "failed"; existingChannelId?: string };

export async function openTicket(guild: Guild, member: GuildMember, content: TicketContent): Promise<OpenResult> {
  const { type, subject } = content;
  const config = await getTicketConfig(guild.id);
  if (!config) return { ok: false, reason: "no_config" };

  const existing = await Ticket.findOne({ guildId: guild.id, ownerId: member.id, status: "open" });
  if (existing) return { ok: false, reason: "has_open", existingChannelId: existing.channelId };

  try {
    const bumped = await TicketConfig.findOneAndUpdate({ guildId: guild.id }, { $inc: { counter: 1 } }, { new: true });
    const number = bumped?.counter ?? 1;
    const me = guild.members.me;

    const allow = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.EmbedLinks,
    ];
    const overwrites: OverwriteResolvable[] = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: member.id, allow },
      { id: config.supportRoleId, allow: [...allow, PermissionFlagsBits.ManageMessages] },
    ];
    if (me) overwrites.push({ id: me.id, allow: [...allow, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] });

    const channel = (await guild.channels.create({
      name: `${type}-${ticketNumber(number)}`,
      type: ChannelType.GuildText,
      parent: config.categoryId,
      topic: `${TYPE_LABEL[type]} • ${member.user.tag} • ${subject}`.slice(0, 1000),
      permissionOverwrites: overwrites,
      reason: `New ${type} ticket from ${member.user.tag}`,
    })) as TextChannel;

    const ticket = await Ticket.create({
      guildId: guild.id,
      channelId: channel.id,
      ownerId: member.id,
      number,
      subject,
      type,
    });
    ticketChannelIds.add(channel.id);

    await channel.send(buildTicketMessage(ticket, content, config.supportRoleId)).catch(() => undefined);

    await sendLog(
      guild,
      new EmbedBuilder()
        .setColor(LOG_COLORS.ticket)
        .setTitle(`${TYPE_EMOJI[type]} New ${TYPE_LABEL[type]} #${ticketNumber(number)}`)
        .setDescription(`**From:** <@${member.id}>\n**Subject:** ${subject}\n**Channel:** ${channel}`),
    );
    return { ok: true, channel, ticket };
  } catch (err) {
    logger.error("Failed to open ticket", err);
    return { ok: false, reason: "failed" };
  }
}

export async function claimTicket(ticket: ITicket, staffId: string): Promise<boolean> {
  const res = await Ticket.findOneAndUpdate(
    { channelId: ticket.channelId, status: "open", claimedBy: null },
    { $set: { claimedBy: staffId } },
  );
  return !!res;
}

/** Plain-text transcript of the ticket (last 1000 messages) */
export async function buildTranscript(channel: TextChannel): Promise<Buffer> {
  const all: string[] = [];
  let before: string | undefined;
  for (let i = 0; i < 10; i++) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) }).catch(() => null);
    if (!batch || batch.size === 0) break;
    const sorted = [...batch.values()];
    before = sorted[sorted.length - 1].id;
    for (const m of sorted) {
      const time = new Date(m.createdTimestamp).toISOString().replace("T", " ").slice(0, 16);
      const parts: string[] = [];
      if (m.content) parts.push(m.content);
      for (const a of m.attachments.values()) parts.push(`[attachment] ${a.url}`);
      for (const e of m.embeds) parts.push(`[embed] ${e.title ?? ""} ${e.description ?? ""}`.trim());
      all.push(`[${time}] ${m.author.tag} (${m.author.id}): ${parts.join(" | ") || "(empty)"}`);
    }
    if (batch.size < 100) break;
  }
  return Buffer.from(all.reverse().join("\n") || "(no messages)", "utf8");
}

export async function closeTicket(guild: Guild, channel: TextChannel, ticket: ITicket, closedById: string): Promise<void> {
  const transcript = await buildTranscript(channel);
  const type: TicketType = ticket.type ?? "help";
  const name = `${type}-${ticketNumber(ticket.number)}.txt`;

  await Ticket.updateOne({ channelId: ticket.channelId }, { $set: { status: "closed", closedAt: new Date() } });
  ticketChannelIds.delete(ticket.channelId);

  await sendLog(
    guild,
    new EmbedBuilder()
      .setColor(LOG_COLORS.ticket)
      .setTitle(`🔒 ${TYPE_LABEL[type]} closed #${ticketNumber(ticket.number)}`)
      .setDescription(
        `**Owner:** <@${ticket.ownerId}>\n**Subject:** ${ticket.subject}\n**Closed by:** <@${closedById}>${ticket.claimedBy ? `\n**Claimed by:** <@${ticket.claimedBy}>` : ""}`,
      ),
    [{ attachment: transcript, name }],
  );

  // نسخة لصاحب التذكرة بالخاص
  const owner = await guild.client.users.fetch(ticket.ownerId).catch(() => null);
  await owner
    ?.send({ content: `🔒 Your ticket **#${ticketNumber(ticket.number)}** in **${guild.name}** has been closed. Here is a transcript of the conversation:`, files: [{ attachment: transcript, name }] })
    .catch(() => undefined);

  await channel.delete(`Ticket #${ticket.number} closed`).catch(() => undefined);
}
