import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, type BaseMessageOptions, type ButtonInteraction, type Guild, type Message } from "discord.js";
import { ThiefState } from "../database/models/ThiefState";
import { UserProfile } from "../database/models/UserProfile";
import { renderTop, type TopKind, type TopRow } from "./card";

export const TOP_TRIGGER = /^!\s*(?:توب|top)$/i;
const PREFIX = "top";
const LIMIT = 10;

async function names(guild: Guild, ids: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const members = await guild.members.fetch({ user: ids }).catch(() => null);
  members?.forEach((m) => map.set(m.id, m.displayName));
  return map;
}

async function rowsFor(guild: Guild, kind: TopKind): Promise<TopRow[]> {
  const guildId = guild.id;
  if (kind === "level") {
    const docs = await UserProfile.find({ guildId }).sort({ level: -1, xp: -1 }).limit(LIMIT).lean();
    const n = await names(guild, docs.map((d) => d.userId));
    return docs.map((d) => ({ name: n.get(d.userId) ?? "عضو غادر", value: d.level ?? 1, extra: d.messages ?? 0 }));
  }
  if (kind === "rich") {
    const docs = await UserProfile.aggregate<{ userId: string; total: number }>([
      { $match: { guildId } },
      { $project: { userId: 1, total: { $add: [{ $ifNull: ["$coins", 0] }, { $ifNull: ["$bank", 0] }] } } },
      { $match: { total: { $gt: 0 } } },
      { $sort: { total: -1 } },
      { $limit: LIMIT },
    ]);
    const n = await names(guild, docs.map((d) => d.userId));
    return docs.map((d) => ({ name: n.get(d.userId) ?? "عضو غادر", value: d.total }));
  }
  const docs = await ThiefState.find({ guildId, total: { $gt: 0 } }).sort({ total: -1 }).limit(LIMIT).lean();
  const n = await names(guild, docs.map((d) => d.userId));
  return docs.map((d) => ({ name: n.get(d.userId) ?? "عضو غادر", value: d.total ?? 0 }));
}

async function buildTop(guild: Guild, owner: string, kind: TopKind): Promise<BaseMessageOptions> {
  const rows = await rowsFor(guild, kind);
  const png = await renderTop(kind, rows);
  const btn = (k: TopKind, label: string) =>
    new ButtonBuilder().setCustomId(`${PREFIX}|${owner}|${k}`).setLabel(label).setStyle(kind === k ? ButtonStyle.Primary : ButtonStyle.Secondary);
  const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(btn("level", "توب لفل"), btn("rich", "أغنى الأشخاص"), btn("thief", "أشهر الحرامية"))];
  if (!png) {
    const text = rows.map((r, i) => `**${i + 1}.** ${r.name} — ${r.value.toLocaleString("en-US")}${r.extra !== undefined ? ` • ${r.extra} رسالة` : ""}`).join("\n") || "لا توجد بيانات حالياً";
    return { embeds: [new EmbedBuilder().setColor(0x3498db).setDescription(text)], components, files: [] };
  }
  const name = `top-${kind}.png`;
  return { embeds: [new EmbedBuilder().setColor(0x2b2d31).setImage(`attachment://${name}`)], files: [new AttachmentBuilder(png, { name })], components };
}

export async function handleTopMessage(message: Message<true>): Promise<void> {
  await message.channel.sendTyping().catch(() => undefined);
  await message.channel.send(await buildTop(message.guild, message.author.id, "level")).catch(() => undefined);
}

export async function handleTopButton(i: ButtonInteraction): Promise<boolean> {
  const [prefix, owner, kind] = i.customId.split("|");
  if (prefix !== PREFIX || !i.inGuild() || !i.guild) return false;
  if (i.user.id !== owner) {
    await i.reply({ content: "هذي مو قائمتك. اكتب `!توب`.", flags: MessageFlags.Ephemeral });
    return true;
  }
  await i.deferUpdate();
  const view = await buildTop(i.guild, owner, kind as TopKind);
  await i.editReply({ ...view, attachments: [] });
  return true;
}
