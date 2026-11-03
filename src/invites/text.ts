import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, MessageFlags, PermissionFlagsBits,
  type BaseMessageOptions, type ButtonInteraction, type ChannelSelectMenuInteraction, type Client, type Guild, type GuildMember, type Message,
} from "discord.js";
import { config } from "../config";
import { InviteConfig, InviteJoin } from "../database/models/InviteLog";
import { logger } from "../utils/logger";

/** !لوحة دخول (للمسؤولين) */
export const INVITE_PANEL_TRIGGER = /^!\s*لوحة\s+دخول$/;
/** !من دعا @شخص : يعرض من دعاه */
export const INVITE_WHO_TRIGGER = /^!\s*من\s+دعا(?:ه)?\s+<@!?(\d+)>$/;

const COLOR = 0x2ecc71;
const eph = { flags: MessageFlags.Ephemeral } as const;
const noPing = { parse: [] as never[], repliedUser: false };
const isAdmin = (userId: string, perms: Readonly<{ has(p: bigint): boolean }> | null | undefined): boolean =>
  Boolean((config.ownerId && userId === config.ownerId) || perms?.has(PermissionFlagsBits.Administrator));

/* ───────── كشف الداعي ───────── */

type Snap = { uses: number; inviterId: string | null };
const cache = new Map<string, Map<string, Snap>>();
const vanityUses = new Map<string, number>();

async function snapshot(guild: Guild): Promise<Map<string, Snap> | null> {
  if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return null;
  const list = await guild.invites.fetch().catch(() => null);
  if (!list) return null;
  return new Map(list.map((inv): [string, Snap] => [inv.code, { uses: inv.uses ?? 0, inviterId: inv.inviter?.id ?? null }]));
}

/** يخزّن حالة الدعوات الحالية لكل السيرفرات (يُستدعى عند تشغيل البوت) */
export async function seedInvites(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const snap = await snapshot(guild).catch(() => null);
    if (snap) cache.set(guild.id, snap);
    const v = await guild.fetchVanityData().catch(() => null);
    if (v) vanityUses.set(guild.id, v.uses);
  }
}

type Found = { kind: "invite"; code: string; inviterId: string | null } | { kind: "vanity" } | { kind: "unknown"; reason: "perm" | "ambiguous" | "none" };

async function detectInviter(guild: Guild): Promise<Found> {
  const before = cache.get(guild.id);
  const after = await snapshot(guild);
  if (!after) return { kind: "unknown", reason: "perm" };
  cache.set(guild.id, after);

  if (before) {
    // دعوة زاد استخدامها (أو دعوة جديدة استُخدمت)
    const inc = [...after].filter(([code, v]) => v.uses > (before.get(code)?.uses ?? 0));
    if (inc.length === 1) return { kind: "invite", code: inc[0][0], inviterId: inc[0][1].inviterId };
    if (inc.length > 1) return { kind: "unknown", reason: "ambiguous" };
    // دعوة اختفت (دعوة لمرة وحدة أو وصلت حدها)
    const gone = [...before].filter(([code]) => !after.has(code));
    if (gone.length === 1) return { kind: "invite", code: gone[0][0], inviterId: gone[0][1].inviterId };
  }
  const v = await guild.fetchVanityData().catch(() => null);
  if (v) {
    const prev = vanityUses.get(guild.id);
    vanityUses.set(guild.id, v.uses);
    if (prev !== undefined && v.uses > prev) return { kind: "vanity" };
  }
  return { kind: "unknown", reason: "none" };
}

/* ───────── دخول عضو ───────── */

export async function handleMemberJoin(member: GuildMember): Promise<void> {
  const guild = member.guild;
  const found = member.user.bot ? ({ kind: "unknown", reason: "none" } as Found) : await detectInviter(guild);
  const inviterId = found.kind === "invite" ? found.inviterId : null;
  await InviteJoin.create({ guildId: guild.id, userId: member.id, inviterId, code: found.kind === "invite" ? found.code : "", kind: found.kind }).catch(() => undefined);

  const cfg = await InviteConfig.findOne({ guildId: guild.id });
  if (!cfg?.enabled || !cfg.channelId) return;
  const ch = guild.channels.cache.get(cfg.channelId);
  if (!ch || !ch.isTextBased() || !("send" in ch)) return;

  const total = inviterId ? await InviteJoin.countDocuments({ guildId: guild.id, inviterId }) : 0;
  let inviterLine: string;
  if (member.user.bot) inviterLine = "بوت (أضافه أحد الإدارة)";
  else if (found.kind === "invite") inviterLine = inviterId ? `<@${inviterId}>` : "رابط بدون صاحب معروف";
  else if (found.kind === "vanity") inviterLine = "رابط السيرفر المخصص";
  else if (found.reason === "perm") inviterLine = "ما أقدر أحدد (البوت يحتاج صلاحية إدارة السيرفر)";
  else if (found.reason === "ambiguous") inviterLine = "ما أقدر أحدد (دخل أكثر من شخص بنفس اللحظة)";
  else inviterLine = "ما أقدر أحدد";

  const lines = [
    `**العضو:** <@${member.id}> (${member.user.username})`,
    `**عمر الحساب:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
    `**الداعي:** ${inviterLine}`,
  ];
  if (found.kind === "invite") lines.push(`**الدعوة:** \`${found.code}\``);
  if (inviterId) lines.push(`**عدد من دعاهم:** ${total}`);
  lines.push(`**عدد الأعضاء الآن:** ${guild.memberCount}`);
  const embed = new EmbedBuilder().setColor(COLOR).setTitle("دخول عضو جديد").setThumbnail(member.user.displayAvatarURL()).setDescription(lines.join("\n"));
  await ch.send({ embeds: [embed], allowedMentions: noPing }).catch((err) => logger.error("فشل إرسال سجل الدخول", err));
}

/* ───────── اللوحة ───────── */

async function panelView(guild: Guild, note?: string): Promise<BaseMessageOptions> {
  const cfg = await InviteConfig.findOneAndUpdate({ guildId: guild.id }, { $setOnInsert: { guildId: guild.id } }, { upsert: true, new: true });
  const canFetch = Boolean(guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild));
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("لوحة الدخول")
    .setDescription(
      [
        note ?? "",
        `**الحالة:** ${cfg?.enabled ? "شغّال" : "متوقف"}`,
        `**روم السجل:** ${cfg?.channelId ? `<#${cfg.channelId}>` : "غير محدد (اختره من القائمة)"}`,
        `**صلاحية البوت (إدارة السيرفر):** ${canFetch ? "موجودة" : "ناقصة، بدونها ما أقدر أعرف الداعي"}`,
        "",
        "عند دخول أي عضو أرسل في الروم من دخل ومن دعاه. وتقدر تسأل لاحقًا بـ `!من دعا @شخص`.",
      ].filter((x, i) => x !== "" || i > 0).join("\n"),
    );
  const menu = new ChannelSelectMenuBuilder().setCustomId("inv|ch").setPlaceholder("اختر روم سجل الدخول").setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("inv|toggle").setLabel(cfg?.enabled ? "إيقاف" : "تشغيل").setStyle(cfg?.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId("inv|top").setLabel("أكثر الداعين").setStyle(ButtonStyle.Primary),
      ),
    ],
  };
}

/** !لوحة دخول و !من دعا */
export async function handleInviteMessage(message: Message): Promise<boolean> {
  if (!message.inGuild()) return false;
  const text = message.content.trim();
  const panel = INVITE_PANEL_TRIGGER.test(text);
  const who = INVITE_WHO_TRIGGER.exec(text);
  if (!panel && !who) return false;
  if (!isAdmin(message.author.id, message.member?.permissions)) {
    await message.reply({ content: "❌ هذا للمسؤولين فقط.", allowedMentions: noPing }).catch(() => undefined);
    return true;
  }
  if (panel) {
    await message.channel.send(await panelView(message.guild)).catch(() => undefined);
    return true;
  }
  const userId = who![1];
  const rec = await InviteJoin.findOne({ guildId: message.guildId, userId }).sort({ at: -1 });
  let out: string;
  if (!rec) out = `ما عندي سجل دخول لـ <@${userId}> (دخل قبل تشغيل التتبع).`;
  else if (rec.kind === "invite" && rec.inviterId) out = `<@${userId}> دعاه <@${rec.inviterId}> (الدعوة \`${rec.code}\`).`;
  else if (rec.kind === "vanity") out = `<@${userId}> دخل من رابط السيرفر المخصص.`;
  else if (rec.kind === "invite") out = `<@${userId}> دخل من الدعوة \`${rec.code}\` وما لها صاحب معروف.`;
  else out = `ما قدرت أحدد من دعا <@${userId}>.`;
  await message.reply({ content: out, allowedMentions: noPing }).catch(() => undefined);
  return true;
}

export async function handleInviteComponent(i: ButtonInteraction | ChannelSelectMenuInteraction): Promise<void> {
  if (!i.inGuild() || !i.guild) return;
  if (!isAdmin(i.user.id, i.memberPermissions)) return void (await i.reply({ content: "❌ للمسؤولين فقط.", ...eph }));
  const act = i.customId.split("|")[1];
  const guild = i.guild;

  if (act === "ch" && i.isChannelSelectMenu()) {
    await InviteConfig.updateOne({ guildId: guild.id }, { $set: { channelId: i.values[0] } }, { upsert: true });
    return void (await i.update(await panelView(guild, `✅ روم السجل: <#${i.values[0]}>`)));
  }
  if (act === "toggle" && i.isButton()) {
    const cfg = await InviteConfig.findOne({ guildId: guild.id });
    await InviteConfig.updateOne({ guildId: guild.id }, { $set: { enabled: !(cfg?.enabled ?? true) } }, { upsert: true });
    return void (await i.update(await panelView(guild)));
  }
  if (act === "top" && i.isButton()) {
    const rows = await InviteJoin.aggregate<{ _id: string; n: number }>([
      { $match: { guildId: guild.id, inviterId: { $ne: null } } },
      { $group: { _id: "$inviterId", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 10 },
    ]);
    const text = rows.length ? rows.map((r, k) => `**${k + 1}.** <@${r._id}> — ${r.n}`).join("\n") : "ما فيه بيانات بعد.";
    return void (await i.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle("أكثر الداعين").setDescription(text)], allowedMentions: noPing, ...eph }));
  }
}
