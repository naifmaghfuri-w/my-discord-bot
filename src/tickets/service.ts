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
import { buildTicketMessage } from "./views";

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

export async function openTicket(guild: Guild, member: GuildMember, subject: string, details: string): Promise<OpenResult> {
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
      name: `ticket-${String(number).padStart(4, "0")}`,
      type: ChannelType.GuildText,
      parent: config.categoryId,
      topic: `تذكرة ${member.user.tag} • ${subject}`.slice(0, 1000),
      permissionOverwrites: overwrites,
      reason: `تذكرة جديدة من ${member.user.tag}`,
    })) as TextChannel;

    const ticket = await Ticket.create({
      guildId: guild.id,
      channelId: channel.id,
      ownerId: member.id,
      number,
      subject,
    });
    ticketChannelIds.add(channel.id);

    await channel.send(buildTicketMessage(ticket, details, config.supportRoleId)).catch(() => undefined);

    await sendLog(
      guild,
      new EmbedBuilder()
        .setColor(LOG_COLORS.ticket)
        .setTitle(`🎫 تذكرة جديدة #${String(number).padStart(4, "0")}`)
        .setDescription(`**من:** <@${member.id}>\n**العنوان:** ${subject}\n**القناة:** ${channel}`),
    );
    return { ok: true, channel, ticket };
  } catch (err) {
    logger.error("فشل فتح تذكرة", err);
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

/** نسخة نصية من محادثة التذكرة (آخر 1000 رسالة) */
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
      for (const a of m.attachments.values()) parts.push(`[مرفق] ${a.url}`);
      for (const e of m.embeds) parts.push(`[embed] ${e.title ?? ""} ${e.description ?? ""}`.trim());
      all.push(`[${time}] ${m.author.tag} (${m.author.id}): ${parts.join(" | ") || "(فارغ)"}`);
    }
    if (batch.size < 100) break;
  }
  return Buffer.from(all.reverse().join("\n") || "(لا توجد رسائل)", "utf8");
}

export async function closeTicket(guild: Guild, channel: TextChannel, ticket: ITicket, closedById: string): Promise<void> {
  const transcript = await buildTranscript(channel);
  const name = `ticket-${String(ticket.number).padStart(4, "0")}.txt`;

  await Ticket.updateOne({ channelId: ticket.channelId }, { $set: { status: "closed", closedAt: new Date() } });
  ticketChannelIds.delete(ticket.channelId);

  await sendLog(
    guild,
    new EmbedBuilder()
      .setColor(LOG_COLORS.ticket)
      .setTitle(`🔒 تذكرة مغلقة #${String(ticket.number).padStart(4, "0")}`)
      .setDescription(
        `**صاحبها:** <@${ticket.ownerId}>\n**العنوان:** ${ticket.subject}\n**أغلقها:** <@${closedById}>${ticket.claimedBy ? `\n**استلمها:** <@${ticket.claimedBy}>` : ""}`,
      ),
    [{ attachment: transcript, name }],
  );

  // نسخة لصاحب التذكرة بالخاص
  const owner = await guild.client.users.fetch(ticket.ownerId).catch(() => null);
  await owner
    ?.send({ content: `🔒 تم إغلاق تذكرتك **#${String(ticket.number).padStart(4, "0")}** في **${guild.name}**. هذي نسخة من المحادثة:`, files: [{ attachment: transcript, name }] })
    .catch(() => undefined);

  await channel.delete(`إغلاق تذكرة #${ticket.number}`).catch(() => undefined);
}
