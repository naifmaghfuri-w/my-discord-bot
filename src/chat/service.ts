import {
  ChannelType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildMember,
  type OverwriteResolvable,
  type PermissionOverwriteOptions,
  type TextChannel,
} from "discord.js";
import { ChatConfig } from "../database/models/ChatConfig";
import { ChatRoom, type IChatRoom } from "../database/models/ChatRoom";
import { ChatSettings, type IChatSettings } from "../database/models/ChatSettings";
import { EmbedBuilder as LogEmbed } from "discord.js";
import { LOG_COLORS, sendLog } from "../logs/logger";
import { logger } from "../utils/logger";
import { buildInviteDm, buildKnockMessage, buildRoomPanel, buildZajilDm } from "./views";

export const ROOM_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const MAX_MEMBERS = 24;
export const RADAR_TTL_MS = 60 * 60 * 1000;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
export const ROOM_PREFIX = "✧||💬┊";

const MEMBER_PERMS: PermissionOverwriteOptions = {
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  AttachFiles: true,
  EmbedLinks: true,
  AddReactions: true,
  UseExternalEmojis: true,
};

const VOICE_PERMS: PermissionOverwriteOptions = { ViewChannel: true, Connect: true, Speak: true, Stream: true };

/* ───────────── كاش الغرف (حتى ما نسأل الداتابيس عن كل رسالة بالسيرفر) ───────────── */

const roomChannelIds = new Set<string>();
const lastTouch = new Map<string, number>();

export async function loadRoomCache(): Promise<void> {
  const rooms = await ChatRoom.find({}, { channelId: 1 }).lean();
  roomChannelIds.clear();
  for (const r of rooms) roomChannelIds.add(r.channelId);
  logger.info(`تم تحميل ${roomChannelIds.size} دردشة خاصة`);
}

export function isRoomChannel(channelId: string): boolean {
  return roomChannelIds.has(channelId);
}

/** يسجّل نشاطاً بالغرفة (بحد أقصى مرة كل 5 دقائق لكل غرفة) */
export function touchRoom(channelId: string): void {
  if (!roomChannelIds.has(channelId)) return;
  const now = Date.now();
  if (now - (lastTouch.get(channelId) ?? 0) < 5 * 60 * 1000) return;
  lastTouch.set(channelId, now);
  ChatRoom.updateOne({ channelId }, { $set: { lastActivityAt: new Date() } }).catch(() => undefined);
}

/* ───────────── الإعدادات والبحث ───────────── */

export async function getConfig(guildId: string) {
  return ChatConfig.findOne({ guildId });
}

export async function setConfig(guildId: string, categoryId: string, bannerUrl: string | null) {
  return ChatConfig.findOneAndUpdate(
    { guildId },
    { $set: { categoryId, ...(bannerUrl !== null ? { bannerUrl } : {}) } },
    { upsert: true, new: true },
  );
}

export const getRoomByOwner = (guildId: string, ownerId: string) => ChatRoom.findOne({ guildId, ownerId });
export const getRoomByChannel = (channelId: string) => ChatRoom.findOne({ channelId });

export function hasAccess(room: IChatRoom, userId: string): boolean {
  return room.ownerId === userId || room.members.includes(userId);
}

/** اسم الغرفة من اسم العضو */
export function roomName(name: string): string {
  const clean = name.replace(/[@#:`]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "دردشة";
  return `${ROOM_PREFIX} ${clean}`.slice(0, 100);
}

/* ───────────── إنشاء / حذف الغرف ───────────── */

export type CreateRoomResult =
  | { ok: true; room: IChatRoom; channel: TextChannel }
  | { ok: false; reason: "no_config" | "has_room" | "failed"; existing?: IChatRoom };

export async function createRoom(guild: Guild, member: GuildMember): Promise<CreateRoomResult> {
  const config = await getConfig(guild.id);
  if (!config) return { ok: false, reason: "no_config" };

  const existing = await getRoomByOwner(guild.id, member.id);
  if (existing) return { ok: false, reason: "has_room", existing };

  try {
    const me = guild.members.me;
    const overwrites: OverwriteResolvable[] = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AddReactions,
          PermissionFlagsBits.UseExternalEmojis,
        ],
      },
    ];
    if (me) {
      overwrites.push({
        id: me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
        ],
      });
    }

    const channel = (await guild.channels.create({
      name: roomName(member.displayName),
      type: ChannelType.GuildText,
      parent: config.categoryId,
      permissionOverwrites: overwrites,
      reason: `دردشة خاصة لـ ${member.user.tag}`,
    })) as TextChannel;

    const room = await ChatRoom.create({ guildId: guild.id, channelId: channel.id, ownerId: member.id });
    roomChannelIds.add(channel.id);

    const panel = buildRoomPanel(guild.name, config.bannerUrl, false);
    const sent = await channel
      .send({ content: `<@${member.id}>`, ...panel, allowedMentions: { users: [member.id] } })
      .catch(() => null);
    if (sent) {
      room.panelMessageId = sent.id;
      await room.save();
    }
    await sendLog(
      guild,
      new LogEmbed().setColor(LOG_COLORS.chat).setTitle("💬 دردشة خاصة جديدة").setDescription(`**المالك:** <@${member.id}>\n**القناة:** ${channel}`),
    );
    return { ok: true, room, channel };
  } catch (err) {
    logger.error("فشل إنشاء دردشة خاصة", err);
    return { ok: false, reason: "failed" };
  }
}

export async function deleteRoom(guild: Guild | null, room: IChatRoom, reason: string): Promise<void> {
  roomChannelIds.delete(room.channelId);
  await ChatRoom.deleteOne({ channelId: room.channelId });
  if (!guild) return;
  await sendLog(
    guild,
    new LogEmbed().setColor(LOG_COLORS.chat).setTitle("🗑️ دردشة خاصة محذوفة").setDescription(`**المالك:** <@${room.ownerId}>\n**السبب:** ${reason}`),
  );
  if (room.voiceChannelId) {
    await guild.channels.delete(room.voiceChannelId, reason).catch(() => undefined);
  }
  await guild.channels.delete(room.channelId, reason).catch(() => undefined);
}

/* ───────────── الأعضاء ───────────── */

async function textChannel(guild: Guild, id: string): Promise<TextChannel | null> {
  const ch = await guild.channels.fetch(id).catch(() => null);
  return ch && ch.type === ChannelType.GuildText ? (ch as TextChannel) : null;
}

export async function addMember(guild: Guild, room: IChatRoom, userId: string): Promise<boolean> {
  const ch = await textChannel(guild, room.channelId);
  if (!ch) return false;
  await ch.permissionOverwrites.edit(userId, MEMBER_PERMS).catch((err) => logger.error("فشل إضافة صلاحية", err));

  if (room.voiceChannelId) {
    const vc = await guild.channels.fetch(room.voiceChannelId).catch(() => null);
    if (vc && "permissionOverwrites" in vc) await vc.permissionOverwrites.edit(userId, VOICE_PERMS).catch(() => undefined);
  }
  await ChatRoom.updateOne({ channelId: room.channelId }, { $addToSet: { members: userId } });
  return true;
}

export async function removeMember(guild: Guild, room: IChatRoom, userId: string): Promise<void> {
  const ch = await textChannel(guild, room.channelId);
  await ch?.permissionOverwrites.delete(userId).catch(() => undefined);

  if (room.voiceChannelId) {
    const vc = await guild.channels.fetch(room.voiceChannelId).catch(() => null);
    if (vc && "permissionOverwrites" in vc) await vc.permissionOverwrites.delete(userId).catch(() => undefined);
    // لو كان داخل الصوتي نطلعه
    const m = guild.members.cache.get(userId);
    if (m?.voice.channelId === room.voiceChannelId) await m.voice.disconnect().catch(() => undefined);
  }
  await ChatRoom.updateOne({ channelId: room.channelId }, { $pull: { members: userId } });
}

export async function transferOwnership(guild: Guild, room: IChatRoom, newOwnerId: string): Promise<boolean> {
  if (!room.members.includes(newOwnerId)) return false;
  const oldOwner = room.ownerId;
  const taken = await ChatRoom.findOneAndUpdate(
    { channelId: room.channelId, ownerId: oldOwner, members: newOwnerId },
    { $set: { ownerId: newOwnerId }, $pull: { members: newOwnerId } },
  );
  if (!taken) return false;
  await ChatRoom.updateOne({ channelId: room.channelId }, { $addToSet: { members: oldOwner } });
  void guild;
  return true;
}

export async function setDoor(room: IChatRoom, closed: boolean): Promise<void> {
  await ChatRoom.updateOne({ channelId: room.channelId }, { $set: { closed } });
}

export async function renameRoom(guild: Guild, room: IChatRoom, name: string): Promise<boolean> {
  const ch = await textChannel(guild, room.channelId);
  if (!ch) return false;
  await ch.setName(roomName(name)).catch((err) => logger.error("فشل تغيير اسم الغرفة", err));
  return true;
}

export async function createVoice(guild: Guild, room: IChatRoom): Promise<{ ok: true; id: string } | { ok: false; reason: "exists" | "failed"; id?: string }> {
  if (room.voiceChannelId) return { ok: false, reason: "exists", id: room.voiceChannelId };
  const text = await textChannel(guild, room.channelId);
  if (!text) return { ok: false, reason: "failed" };

  try {
    const me = guild.members.me;
    const overwrites: OverwriteResolvable[] = [
      { id: guild.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect] },
      ...[room.ownerId, ...room.members].map((id) => ({
        id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream],
      })),
    ];
    if (me) {
      overwrites.push({
        id: me.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],
      });
    }
    const vc = await guild.channels.create({
      name: `🔊┊${text.name.replace(ROOM_PREFIX, "").trim()}`.slice(0, 100),
      type: ChannelType.GuildVoice,
      parent: text.parentId,
      permissionOverwrites: overwrites,
      reason: "صوتي لدردشة خاصة",
    });
    await ChatRoom.updateOne({ channelId: room.channelId }, { $set: { voiceChannelId: vc.id } });
    return { ok: true, id: vc.id };
  } catch (err) {
    logger.error("فشل إنشاء الصوتي", err);
    return { ok: false, reason: "failed" };
  }
}

/** يمسح رسائل الغرفة (عدا اللوحة). الرسائل الأقدم من 14 يوم ما تنمسح (قيد ديسكورد) */
export async function clearRoom(guild: Guild, room: IChatRoom): Promise<number> {
  const ch = await textChannel(guild, room.channelId);
  if (!ch) return 0;
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const batch = await ch.messages.fetch({ limit: 100 }).catch(() => null);
    if (!batch) break;
    const deletable = batch.filter((m) => m.id !== room.panelMessageId && !m.pinned);
    if (deletable.size === 0) break;
    const res = await ch.bulkDelete(deletable, true).catch(() => null);
    if (!res || res.size === 0) break;
    total += res.size;
  }
  return total;
}

/* ───────────── إعدادات المستخدم والرادار ───────────── */

export async function getSettings(guildId: string, userId: string): Promise<IChatSettings> {
  const found = await ChatSettings.findOne({ guildId, userId });
  if (found) return found;
  try {
    return await ChatSettings.create({ guildId, userId });
  } catch {
    // سباق: انوجد بنفس اللحظة من طلب ثاني
    return (await ChatSettings.findOne({ guildId, userId })) as IChatSettings;
  }
}

export async function toggleSetting(guildId: string, userId: string, key: "zajil" | "invites"): Promise<IChatSettings> {
  const cur = await getSettings(guildId, userId);
  const doc = await ChatSettings.findOneAndUpdate({ guildId, userId }, { $set: { [key]: !cur[key] } }, { new: true });
  return doc ?? cur;
}

export async function setInvites(guildId: string, userId: string, value: boolean): Promise<void> {
  await ChatSettings.updateOne({ guildId, userId }, { $set: { invites: value } }, { upsert: true });
}

export async function toggleRadar(guildId: string, userId: string): Promise<boolean> {
  const cur = await getSettings(guildId, userId);
  const active = !!cur.radarUntil && cur.radarUntil.getTime() > Date.now();
  await ChatSettings.updateOne(
    { guildId, userId },
    { $set: { radarUntil: active ? null : new Date(Date.now() + RADAR_TTL_MS) } },
  );
  return !active;
}

export async function getRadarUserIds(guildId: string, excludeId: string): Promise<string[]> {
  const rows = await ChatSettings.find({ guildId, radarUntil: { $gt: new Date() }, userId: { $ne: excludeId } })
    .limit(25)
    .lean();
  return rows.map((r) => r.userId);
}

export async function isOnRadar(guildId: string, userId: string): Promise<boolean> {
  const s = await ChatSettings.findOne({ guildId, userId, radarUntil: { $gt: new Date() } }).lean();
  return !!s;
}

/* ───────────── الدعوات / الطرق / زاجل ───────────── */

export type InviteResult = "ok" | "self" | "bot" | "already" | "disabled" | "dm_closed" | "full" | "no_room";

export async function sendInvite(client: Client, guild: Guild, room: IChatRoom, inviterId: string, targetId: string): Promise<InviteResult> {
  if (targetId === inviterId) return "self";
  const user = await client.users.fetch(targetId).catch(() => null);
  if (!user || user.bot) return "bot";
  if (hasAccess(room, targetId)) return "already";
  if (room.members.length >= MAX_MEMBERS) return "full";

  const settings = await getSettings(guild.id, targetId);
  if (!settings.invites) return "disabled";

  const config = await getConfig(guild.id);
  try {
    await user.send(buildInviteDm(inviterId, guild.name, config?.bannerUrl ?? null, room.channelId));
    return "ok";
  } catch {
    return "dm_closed";
  }
}

const knockCooldown = new Map<string, number>();

export type KnockResult = "ok" | "closed" | "member" | "cooldown" | "no_room" | "failed";

export async function knockDoor(guild: Guild, room: IChatRoom, userId: string): Promise<KnockResult> {
  if (room.closed) return "closed";
  if (hasAccess(room, userId)) return "member";
  const key = `${room.channelId}:${userId}`;
  if (Date.now() - (knockCooldown.get(key) ?? 0) < 3 * 60 * 1000) return "cooldown";

  const ch = await textChannel(guild, room.channelId);
  if (!ch) return "no_room";
  knockCooldown.set(key, Date.now());

  const sent = await ch
    .send({ ...buildKnockMessage(room.channelId, room.ownerId, userId), allowedMentions: { users: [room.ownerId] } })
    .catch(() => null);
  return sent ? "ok" : "failed";
}

const zajilCooldown = new Map<string, number>();

export type ZajilResult = "ok" | "self" | "bot" | "disabled" | "dm_closed" | "cooldown";

export async function sendZajil(client: Client, guild: Guild, senderId: string, targetId: string, text: string): Promise<ZajilResult> {
  if (senderId === targetId) return "self";
  if (Date.now() - (zajilCooldown.get(senderId) ?? 0) < 20_000) return "cooldown";

  const user = await client.users.fetch(targetId).catch(() => null);
  if (!user || user.bot) return "bot";
  const settings = await getSettings(guild.id, targetId);
  if (!settings.zajil) return "disabled";

  try {
    await user.send(buildZajilDm(senderId, guild.id, guild.name, text));
    zajilCooldown.set(senderId, Date.now());
    return "ok";
  } catch {
    return "dm_closed";
  }
}

/* ───────────── حذف الخاملة ───────────── */

export async function cleanIdleRooms(client: Client): Promise<number> {
  const stale = await ChatRoom.find({ lastActivityAt: { $lt: new Date(Date.now() - ROOM_TTL_MS) } });
  let removed = 0;
  for (const room of stale) {
    const guild = client.guilds.cache.get(room.guildId) ?? null;
    await deleteRoom(guild, room, "دردشة خاملة أكثر من 3 أيام");
    removed++;
    client.users
      .fetch(room.ownerId)
      .then((u) => u.send("🗑️ تم حذف دردشتك الخاصة تلقائياً لأنها بقيت خاملة 3 أيام."))
      .catch(() => undefined);
  }
  return removed;
}
