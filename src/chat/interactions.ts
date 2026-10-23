import {
  ChannelType,
  MessageFlags,
  type ButtonInteraction,
  type Guild,
  type GuildMember,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
  type TextChannel,
  type UserSelectMenuInteraction,
} from "discord.js";
import { ChatRoom, type IChatRoom } from "../database/models/ChatRoom";
import { logger } from "../utils/logger";
import {
  CHAT_ADD,
  CHAT_CANCEL,
  CHAT_CLEAR,
  CHAT_CLEAR_YES,
  CHAT_CREATE,
  CHAT_DELETE,
  CHAT_DELETE_YES,
  CHAT_DOOR,
  CHAT_INV_NO,
  CHAT_INV_OK,
  CHAT_INV_STOP,
  CHAT_INVITE,
  CHAT_INVITE_PICK,
  CHAT_KNOCK,
  CHAT_KNOCK_NO,
  CHAT_KNOCK_OK,
  CHAT_KNOCK_PICK,
  CHAT_LEAVE,
  CHAT_RADAR,
  CHAT_RADAR_JOIN,
  CHAT_RADAR_PICK,
  CHAT_REMOVE,
  CHAT_REMOVE_PICK,
  CHAT_RENAME,
  CHAT_RENAME_MODAL,
  CHAT_SET_INV,
  CHAT_SET_ZAJIL,
  CHAT_SETTINGS,
  CHAT_TRANSFER,
  CHAT_TRANSFER_PICK,
  CHAT_VOICE,
  CHAT_ZAJIL,
  CHAT_ZAJIL_MODAL,
  CHAT_ZAJIL_PICK,
  CHAT_ZAJIL_REPLY,
  parseCid,
} from "./ids";
import {
  INVITE_TTL_MS,
  MAX_MEMBERS,
  addMember,
  clearRoom,
  createRoom,
  createVoice,
  deleteRoom,
  getConfig,
  getRadarUserIds,
  getRoomByChannel,
  getRoomByOwner,
  getSettings,
  hasAccess,
  isOnRadar,
  knockDoor,
  removeMember,
  renameRoom,
  sendInvite,
  sendZajil,
  setDoor,
  setInvites,
  toggleRadar,
  toggleSetting,
  touchRoom,
  transferOwnership,
  type InviteResult,
} from "./service";
import {
  buildRenameModal,
  buildRoomPanel,
  buildZajilModal,
  confirmView,
  invitePickerView,
  knockListView,
  radarView,
  settingsView,
  stringPicker,
  zajilPickerView,
} from "./views";

const eph = (content: string) => ({ content, flags: MessageFlags.Ephemeral }) as const;
const NOT_OWNER = "⛔ هذا الزر لصاحب الدردشة فقط.";
const GENERIC_ERROR = "❌ صار خطأ، حاول مرة ثانية.";

const INVITE_MESSAGES: Record<InviteResult, (id: string) => string> = {
  ok: (id) => `✥ تم ارسال دعوة المراسلة لـ <@${id}> بنجاح`,
  self: () => "😅 ما تقدر تدعو نفسك.",
  bot: () => "❌ ما تقدر تدعو هذا الحساب.",
  already: (id) => `ℹ️ <@${id}> داخل الدردشة بالفعل.`,
  disabled: (id) => `🔕 <@${id}> أوقف استقبال الدعوات.`,
  dm_closed: (id) => `📪 ما قدرت أرسل لـ <@${id}> لأن الخاص عنده مقفل.`,
  full: () => `❌ وصلت الدردشة للحد الأقصى (${MAX_MEMBERS} عضو).`,
  no_room: () => "❌ ما عندك دردشة، اضغط «انشاء دردشة» أولاً.",
};

async function sendToChannel(guild: Guild, channelId: string, payload: Parameters<TextChannel["send"]>[0]): Promise<void> {
  const ch = await guild.channels.fetch(channelId).catch(() => null);
  if (ch && ch.type === ChannelType.GuildText) await (ch as TextChannel).send(payload).catch(() => undefined);
}

async function memberOptions(guild: Guild, ids: string[]): Promise<{ label: string; value: string; emoji: string }[]> {
  if (ids.length === 0) return [];
  const members = await guild.members.fetch({ user: ids }).catch(() => null);
  return ids.map((id) => ({ label: members?.get(id)?.displayName ?? id, value: id, emoji: "👤" }));
}

async function radarPayload(guild: Guild, userId: string) {
  const ids = await getRadarUserIds(guild.id, userId);
  const options = await memberOptions(guild, ids);
  return radarView(
    options.map((o) => ({ id: o.value, name: o.label })),
    await isOnRadar(guild.id, userId),
  );
}

async function replyError(interaction: { replied: boolean; deferred: boolean; reply: Function; followUp: Function }): Promise<void> {
  const payload = eph(GENERIC_ERROR);
  if (!interaction.replied && !interaction.deferred) await interaction.reply(payload).catch(() => undefined);
  else await interaction.followUp(payload).catch(() => undefined);
}

/* ═══════════════════════════ الأزرار ═══════════════════════════ */

export async function handleChatButton(interaction: ButtonInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("chat_")) return false;
  const { base, args } = parseCid(interaction.customId);
  const userId = interaction.user.id;

  try {
    /* ── أزرار تشتغل في الخاص (دعوات + زاجل) ── */
    switch (base) {
      case CHAT_INV_OK: {
        const [roomChannelId = "", inviterId = ""] = (args[0] ?? "").split(":");
        const room = await getRoomByChannel(roomChannelId);
        const stop = async (content: string): Promise<boolean> => {
          await interaction.update({ content, embeds: [], components: [] });
          return true;
        };

        if (!room) return stop("❌ هذه الدردشة لم تعد موجودة.");
        if (Date.now() - interaction.message.createdTimestamp > INVITE_TTL_MS) return stop("⌛ انتهت صلاحية هذه الدعوة.");
        if (hasAccess(room, userId)) return stop("ℹ️ أنت داخل هذه الدردشة بالفعل.");
        if (room.members.length >= MAX_MEMBERS) return stop("❌ الدردشة ممتلئة.");

        const guild = interaction.client.guilds.cache.get(room.guildId);
        if (!guild || !(await addMember(guild, room, userId))) return stop("❌ تعذّر الانضمام، ربما الدردشة انحذفت.");

        await interaction.update({
          embeds: [],
          components: [],
          content: `✥ تم قبول دعوة المراسلة!\n✥ للمراسلة توجه الى الدردشة الخاصة:\nhttps://discord.com/channels/${guild.id}/${room.channelId}`,
        });
        await sendToChannel(guild, room.channelId, {
          content: `✥ <@${inviterId || room.ownerId}>\nقام <@${userId}> بقبول دعوتك، هذه مساحة خاصة جديدة بينكما!`,
          allowedMentions: { users: [inviterId || room.ownerId, userId] },
        });
        return true;
      }

      case CHAT_INV_NO:
        await interaction.update({ content: "❌ تم رفض الدعوة.", embeds: [], components: [] });
        return true;

      case CHAT_INV_STOP: {
        const [roomChannelId = ""] = (args[0] ?? "").split(":");
        const room = await getRoomByChannel(roomChannelId);
        if (room) await setInvites(room.guildId, userId, false);
        await interaction.update({
          content: "🔕 تم إيقاف تلقي الدعوات. تقدر ترجع تفعّلها من زر 🔔 داخل السيرفر.",
          embeds: [],
          components: [],
        });
        return true;
      }

      case CHAT_ZAJIL_REPLY: {
        const [senderId = "", guildId = ""] = args;
        await interaction.showModal(buildZajilModal(senderId, guildId, true));
        return true;
      }
    }

    /* ── باقي الأزرار داخل السيرفر فقط ── */
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply(eph("❌ هذا الزر يشتغل داخل السيرفر فقط."));
      return true;
    }

    switch (base) {
      case CHAT_CANCEL:
        await interaction.update({ content: "تم الإلغاء.", components: [] });
        return true;

      /* ── لوحة الاستقبال ── */
      case CHAT_CREATE: {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const member = await guild.members.fetch(userId);
        const res = await createRoom(guild, member as GuildMember);
        if (res.ok) {
          await interaction.editReply(`✥ تم انشاء دردشتك الخاصة ${res.channel}`);
        } else if (res.reason === "has_room") {
          await interaction.editReply(`ℹ️ عندك دردشة بالفعل: <#${res.existing?.channelId}>`);
        } else if (res.reason === "no_config") {
          await interaction.editReply("⚠️ الدردشات الخاصة ما انضبطت بعد. اطلب من الإدارة كتابة الأمر `!لوحة دردشة`.");
        } else {
          await interaction.editReply("❌ ما قدرت أنشئ الدردشة. تأكد أن البوت عنده صلاحية إدارة القنوات وأن الكاتيجوري مو ممتلئ.");
        }
        return true;
      }

      case CHAT_INVITE: {
        const room = await getRoomByOwner(guild.id, userId);
        if (!room) {
          await interaction.reply(eph(INVITE_MESSAGES.no_room(userId)));
          return true;
        }
        await interaction.reply({ ...invitePickerView(room.channelId), flags: MessageFlags.Ephemeral });
        return true;
      }

      case CHAT_RADAR:
        await interaction.reply({ ...(await radarPayload(guild, userId)), flags: MessageFlags.Ephemeral });
        return true;

      case CHAT_RADAR_JOIN:
        await toggleRadar(guild.id, userId);
        await interaction.update(await radarPayload(guild, userId));
        return true;

      case CHAT_KNOCK: {
        const rooms = await ChatRoom.find({
          guildId: guild.id,
          closed: false,
          ownerId: { $ne: userId },
          members: { $ne: userId },
        }).limit(25);
        const list = rooms
          .map((r) => ({ channelId: r.channelId, name: guild.channels.cache.get(r.channelId)?.name }))
          .filter((r): r is { channelId: string; name: string } => !!r.name);
        await interaction.reply({ ...knockListView(list), flags: MessageFlags.Ephemeral });
        return true;
      }

      case CHAT_ZAJIL:
        await interaction.reply({ ...zajilPickerView(guild.id), flags: MessageFlags.Ephemeral });
        return true;

      case CHAT_SETTINGS:
        await interaction.reply({ ...settingsView(guild.name, await getSettings(guild.id, userId)), flags: MessageFlags.Ephemeral });
        return true;

      case CHAT_SET_ZAJIL:
      case CHAT_SET_INV: {
        const s = await toggleSetting(guild.id, userId, base === CHAT_SET_ZAJIL ? "zajil" : "invites");
        await interaction.update(settingsView(guild.name, s));
        return true;
      }
    }

    /* ── أزرار لوحة الغرفة ── */
    const roomBases = [
      CHAT_ADD, CHAT_REMOVE, CHAT_TRANSFER, CHAT_VOICE, CHAT_RENAME, CHAT_CLEAR, CHAT_CLEAR_YES,
      CHAT_DELETE, CHAT_DELETE_YES, CHAT_LEAVE, CHAT_DOOR, CHAT_KNOCK_OK, CHAT_KNOCK_NO,
    ];
    if (!roomBases.includes(base)) return false;

    const room: IChatRoom | null = await getRoomByChannel(interaction.channelId);
    if (!room) {
      await interaction.reply(eph("❌ هذي مو دردشة خاصة (أو انحذفت)."));
      return true;
    }
    touchRoom(room.channelId);
    const isOwner = room.ownerId === userId;

    if (base === CHAT_LEAVE) {
      if (isOwner) {
        await interaction.reply(eph("👑 أنت صاحب الدردشة: انقل الملكية لعضو أو احذف الدردشة."));
        return true;
      }
      if (!room.members.includes(userId)) {
        await interaction.reply(eph("ℹ️ أنت مو عضو بهذي الدردشة."));
        return true;
      }
      await sendToChannel(guild, room.channelId, { content: `🚪 غادر <@${userId}> الدردشة.`, allowedMentions: { parse: [] } });
      await removeMember(guild, room, userId);
      await interaction.reply(eph("✅ غادرت الدردشة."));
      return true;
    }

    if (!isOwner) {
      await interaction.reply(eph(NOT_OWNER));
      return true;
    }

    switch (base) {
      case CHAT_ADD:
        await interaction.reply({ ...invitePickerView(room.channelId), flags: MessageFlags.Ephemeral });
        return true;

      case CHAT_REMOVE:
      case CHAT_TRANSFER: {
        const options = await memberOptions(guild, room.members);
        if (options.length === 0) {
          await interaction.reply(eph("ℹ️ ما فيه أعضاء بالدردشة غيرك."));
          return true;
        }
        const remove = base === CHAT_REMOVE;
        await interaction.reply({
          content: remove ? "اختر العضو الذي تريد إزالته:" : "اختر المالك الجديد للدردشة:",
          components: [
            stringPicker(
              remove ? CHAT_REMOVE_PICK : CHAT_TRANSFER_PICK,
              remove ? "اختر العضو لطرده من الغرفة" : "اختر العضو لنقل الملكية له",
              options,
            ),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return true;
      }

      case CHAT_VOICE: {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const res = await createVoice(guild, room);
        await interaction.editReply(
          res.ok
            ? `🔊 تم إنشاء الصوتي: <#${res.id}>`
            : res.reason === "exists"
              ? `ℹ️ عندك صوتي بالفعل: <#${res.id}>`
              : "❌ ما قدرت أنشئ الصوتي، تأكد من صلاحيات البوت.",
        );
        return true;
      }

      case CHAT_RENAME:
        await interaction.showModal(buildRenameModal());
        return true;

      case CHAT_CLEAR:
        await interaction.reply({
          ...confirmView("🧹 تبي تمسح كل رسائل الدردشة؟\n_الرسائل الأقدم من 14 يوم ما تنمسح (قيد من ديسكورد)._", CHAT_CLEAR_YES),
          flags: MessageFlags.Ephemeral,
        });
        return true;

      case CHAT_CLEAR_YES: {
        await interaction.update({ content: "⏳ جاري المسح...", components: [] });
        const n = await clearRoom(guild, room);
        await interaction.editReply({ content: `🧹 تم مسح ${n} رسالة.` });
        return true;
      }

      case CHAT_DELETE:
        await interaction.reply({
          ...confirmView("⚠️ تبي تحذف الدردشة نهائياً (مع الصوتي لو موجود)؟ ما فيه رجعة.", CHAT_DELETE_YES),
          flags: MessageFlags.Ephemeral,
        });
        return true;

      case CHAT_DELETE_YES:
        await interaction.update({ content: "🗑️ جاري حذف الدردشة...", components: [] });
        await deleteRoom(guild, room, `حذفها المالك ${interaction.user.tag}`);
        return true;

      case CHAT_DOOR: {
        const closed = !room.closed;
        await setDoor(room, closed);
        const cfg = await getConfig(guild.id);
        await interaction.update({ components: buildRoomPanel(guild.name, cfg?.bannerUrl ?? null, closed).components });
        await interaction.followUp(eph(closed ? "🔒 تم إغلاق الباب: ما أحد يقدر يطرقه." : "🔓 تم فتح الباب: يقدر الناس يطرقونه."));
        return true;
      }

      case CHAT_KNOCK_OK:
      case CHAT_KNOCK_NO: {
        const [, targetId = ""] = (args[0] ?? "").split(":");
        if (base === CHAT_KNOCK_NO) {
          await interaction.update({ content: `❌ رفض <@${userId}> طلب دخول <@${targetId}>.`, components: [], allowedMentions: { parse: [] } });
          return true;
        }
        if (!hasAccess(room, targetId) && room.members.length >= MAX_MEMBERS) {
          await interaction.reply(eph(`❌ وصلت الدردشة للحد الأقصى (${MAX_MEMBERS} عضو).`));
          return true;
        }
        const ok = hasAccess(room, targetId) || (await addMember(guild, room, targetId));
        await interaction.update({
          content: ok ? `✅ وافق <@${userId}> على دخول <@${targetId}>، أهلاً به!` : "❌ تعذّرت إضافة العضو.",
          components: [],
          allowedMentions: { users: ok ? [targetId] : [] },
        });
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.error("خطأ في زر الدردشة الخاصة", err);
    await replyError(interaction);
    return true;
  }
}

/* ═══════════════════════════ القوائم ═══════════════════════════ */

export async function handleChatSelect(
  interaction: StringSelectMenuInteraction | UserSelectMenuInteraction,
): Promise<boolean> {
  if (!interaction.customId.startsWith("chat_")) return false;
  const { base, args } = parseCid(interaction.customId);
  const userId = interaction.user.id;
  const value = interaction.values[0];
  const guild = interaction.guild;

  if (!guild) {
    await interaction.reply(eph("❌ هذا يشتغل داخل السيرفر فقط."));
    return true;
  }

  try {
    switch (base) {
      case CHAT_INVITE_PICK: {
        const room = await getRoomByChannel(args[0] ?? "");
        if (!room || room.ownerId !== userId) {
          await interaction.update({ content: NOT_OWNER, components: [] });
          return true;
        }
        const res = await sendInvite(interaction.client, guild, room, userId, value);
        await interaction.update({ content: INVITE_MESSAGES[res](value), components: [], allowedMentions: { parse: [] } });
        return true;
      }

      case CHAT_RADAR_PICK: {
        const room = await getRoomByOwner(guild.id, userId);
        if (!room) {
          await interaction.update({ content: INVITE_MESSAGES.no_room(userId), embeds: [], components: [] });
          return true;
        }
        const res = await sendInvite(interaction.client, guild, room, userId, value);
        await interaction.update({ content: INVITE_MESSAGES[res](value), embeds: [], components: [], allowedMentions: { parse: [] } });
        return true;
      }

      case CHAT_KNOCK_PICK: {
        const room = await getRoomByChannel(value);
        if (!room) {
          await interaction.update({ content: "❌ هذي الغرفة ما عادت موجودة.", components: [] });
          return true;
        }
        const res = await knockDoor(guild, room, userId);
        const messages: Record<string, string> = {
          ok: "تم طرق الباب بنجاح! انتظر رد صاحب الغرفة.",
          closed: "🔒 صاحب الغرفة أغلق الباب.",
          member: "ℹ️ أنت داخل هذي الغرفة بالفعل.",
          cooldown: "⏳ طرقت هذا الباب قبل شوي، انتظر شوية.",
          no_room: "❌ هذي الغرفة ما عادت موجودة.",
          failed: "❌ ما قدرت أوصّل طلبك.",
        };
        await interaction.update({ content: messages[res], components: [] });
        return true;
      }

      case CHAT_REMOVE_PICK: {
        const room = await getRoomByChannel(interaction.channelId ?? "");
        if (!room || room.ownerId !== userId) {
          await interaction.update({ content: NOT_OWNER, components: [] });
          return true;
        }
        if (!room.members.includes(value)) {
          await interaction.update({ content: "ℹ️ هذا العضو مو بالدردشة.", components: [] });
          return true;
        }
        await removeMember(guild, room, value);
        await sendToChannel(guild, room.channelId, { content: `★ تمت ازالة <@${value}> من الدردشة`, allowedMentions: { parse: [] } });
        await interaction.update({ content: `تمت إزالة <@${value}> بنجاح.`, components: [], allowedMentions: { parse: [] } });
        return true;
      }

      case CHAT_TRANSFER_PICK: {
        const room = await getRoomByChannel(interaction.channelId ?? "");
        if (!room || room.ownerId !== userId) {
          await interaction.update({ content: NOT_OWNER, components: [] });
          return true;
        }
        const ok = await transferOwnership(guild, room, value);
        if (!ok) {
          await interaction.update({ content: "❌ تعذّر نقل الملكية (العضو لازم يكون داخل الدردشة).", components: [] });
          return true;
        }
        await sendToChannel(guild, room.channelId, {
          content: `👑 انتقلت ملكية الدردشة من <@${userId}> إلى <@${value}>.`,
          allowedMentions: { users: [value] },
        });
        await interaction.update({ content: `✅ صارت الملكية لـ <@${value}>.`, components: [], allowedMentions: { parse: [] } });
        return true;
      }

      case CHAT_ZAJIL_PICK: {
        const guildId = args[0] ?? guild.id;
        await interaction.showModal(buildZajilModal(value, guildId));
        return true;
      }
    }
    return false;
  } catch (err) {
    logger.error("خطأ في قائمة الدردشة الخاصة", err);
    await replyError(interaction);
    return true;
  }
}

/* ═══════════════════════════ النماذج ═══════════════════════════ */

export async function handleChatModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  if (!interaction.customId.startsWith("chat_")) return false;
  const { base, args } = parseCid(interaction.customId);
  const userId = interaction.user.id;

  try {
    if (base === CHAT_ZAJIL_MODAL) {
      const [targetId = "", guildId = ""] = args;
      const guild = interaction.client.guilds.cache.get(guildId);
      if (!guild) {
        await interaction.reply(eph("❌ ما قدرت أحدد السيرفر."));
        return true;
      }
      const text = interaction.fields.getTextInputValue("text").trim();
      if (!text) {
        await interaction.reply(eph("❌ الرسالة فاضية."));
        return true;
      }
      const res = await sendZajil(interaction.client, guild, userId, targetId, text);
      const messages: Record<string, string> = {
        ok: "🕊️ تم إرسال الزاجل بنجاح.",
        self: "😅 ما تقدر ترسل زاجل لنفسك.",
        bot: "❌ ما تقدر ترسل زاجل لهذا الحساب.",
        disabled: "🔕 هذا الشخص أوقف استقبال رسائل زاجل.",
        dm_closed: "📪 ما قدرت أوصّل الزاجل لأن الخاص عنده مقفل.",
        cooldown: "⏳ انتظر شوي قبل ترسل زاجل ثاني.",
      };
      await interaction.reply(eph(messages[res]));
      return true;
    }

    if (base === CHAT_RENAME_MODAL) {
      const guild = interaction.guild;
      const room = interaction.channelId ? await getRoomByChannel(interaction.channelId) : null;
      if (!guild || !room || room.ownerId !== userId) {
        await interaction.reply(eph(NOT_OWNER));
        return true;
      }
      const name = interaction.fields.getTextInputValue("name").trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const ok = await renameRoom(guild, room, name);
      await interaction.editReply(ok ? "✅ تم تغيير اسم الدردشة." : "❌ ما قدرت أغيّر الاسم (ديسكورد يحدّ تغيير الأسماء بمعدل مرتين كل 10 دقايق).");
      return true;
    }
    return false;
  } catch (err) {
    logger.error("خطأ في نموذج الدردشة الخاصة", err);
    await replyError(interaction);
    return true;
  }
}
