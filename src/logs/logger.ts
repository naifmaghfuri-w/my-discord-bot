import {
  ChannelType,
  EmbedBuilder,
  type ChatInputCommandInteraction,
  type Guild,
  type TextChannel,
} from "discord.js";
import { config } from "../config";
import { LogConfig } from "../database/models/LogConfig";
import { logger } from "../utils/logger";

const cache = new Map<string, { channelId: string | null; at: number }>();
const TTL = 60_000;

export async function getLogChannelId(guildId: string): Promise<string | null> {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.at < TTL) return hit.channelId;

  const row = await LogConfig.findOne({ guildId }).lean().catch(() => null);
  const channelId = row?.channelId ?? config.logChannelId ?? null;
  cache.set(guildId, { channelId, at: Date.now() });
  return channelId;
}

export async function setLogChannel(guildId: string, channelId: string | null): Promise<void> {
  if (channelId) await LogConfig.updateOne({ guildId }, { $set: { channelId } }, { upsert: true });
  else await LogConfig.deleteOne({ guildId });
  cache.delete(guildId);
}

export const LOG_COLORS = {
  mod: 0xef4444,
  info: 0x38bdf8,
  join: 0x22c55e,
  leave: 0xf59e0b,
  edit: 0xa78bfa,
  delete: 0xf43f5e,
  chat: 0x8b5cf6,
  ticket: 0x0ea5e9,
} as const;

/** يرسل سجلاً لقناة السجلات (لو ما انضبطت أو فشل الإرسال ما يكسر شيء) */
export async function sendLog(
  guild: Guild,
  embed: EmbedBuilder,
  files: { attachment: Buffer; name: string }[] = [],
): Promise<void> {
  try {
    const channelId = await getLogChannelId(guild.id);
    if (!channelId) return;
    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (!ch || ch.type !== ChannelType.GuildText) return;
    await (ch as TextChannel).send({ embeds: [embed.setTimestamp()], files, allowedMentions: { parse: [] } });
  } catch (err) {
    logger.error("فشل إرسال سجل", err);
  }
}

export async function logModAction(
  interaction: ChatInputCommandInteraction,
  action: string,
  target: { id: string; tag?: string } | null,
  details: { reason?: string; extra?: string } = {},
): Promise<void> {
  if (!interaction.guild) return;
  const lines = [
    `**المشرف:** <@${interaction.user.id}> (${interaction.user.tag})`,
    target ? `**الهدف:** <@${target.id}>${target.tag ? ` (${target.tag})` : ""}` : "",
    details.reason ? `**السبب:** ${details.reason}` : "",
    details.extra ?? "",
    `**القناة:** <#${interaction.channelId}>`,
  ].filter(Boolean);

  await sendLog(
    interaction.guild,
    new EmbedBuilder().setColor(LOG_COLORS.mod).setTitle(`🛡️ ${action}`).setDescription(lines.join("\n")),
  );
}
