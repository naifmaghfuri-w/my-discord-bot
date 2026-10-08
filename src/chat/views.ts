import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import type { IChatSettings } from "../database/models/ChatSettings";
import {
  CHAT_ADD,
  CHAT_CANCEL,
  CHAT_CLEAR,
  CHAT_CREATE,
  CHAT_DELETE,
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
  CHAT_RENAME,
  CHAT_RENAME_MODAL,
  CHAT_SET_INV,
  CHAT_SET_ZAJIL,
  CHAT_SETTINGS,
  CHAT_TRANSFER,
  CHAT_VOICE,
  CHAT_ZAJIL,
  CHAT_ZAJIL_MODAL,
  CHAT_ZAJIL_PICK,
  CHAT_ZAJIL_REPLY,
  cid,
} from "./ids";

const COLOR = 0xa78bfa;

const INTRO = [
  "✥ تمنحك هذه اللوحة القدرة الكاملة على إنشاء دردشتك الخاصة، حيث تتحكم بكل الصلاحيات: إضافة من تشاء، إزالة من لا ترغب به، مسح الشات، وحتى حذف الدردشة بالكامل",
  "",
  "✥ الخصوصية في هذه الدردشات محفوظة لك الحق في اختيار من يمكنه الدخول اليها",
  "",
  "✥ أي دردشة خاصة تبقى خاملة 3 أيام ستُمحى تلقائيًا",
];

function baseEmbed(guildName: string, bannerUrl: string | null): EmbedBuilder {
  const e = new EmbedBuilder().setColor(COLOR).setFooter({ text: guildName });
  if (bannerUrl) e.setImage(bannerUrl);
  return e;
}

function btn(id: string, label: string | null, style: ButtonStyle, emoji?: string): ButtonBuilder {
  const b = new ButtonBuilder().setCustomId(id).setStyle(style);
  if (label) b.setLabel(label);
  if (emoji) b.setEmoji(emoji);
  return b;
}

/* ───────────── لوحة الاستقبال (تُنشر بقناة الغرف) ───────────── */

export function buildLobbyPanel(guildName: string, bannerUrl: string | null) {
  const embed = baseEmbed(guildName, bannerUrl).setTitle("✶ انشاء دردشة خاصة").setDescription(INTRO.join("\n"));
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_CREATE, "انشاء دردشة", ButtonStyle.Primary, "💬"),
        btn(CHAT_INVITE, "ارسال دعوة", ButtonStyle.Primary, "✉️"),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_RADAR, "رادار البحث", ButtonStyle.Success, "📡"),
        btn(CHAT_KNOCK, "طرق الباب", ButtonStyle.Success, "🚪"),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_ZAJIL, "زاجل", ButtonStyle.Primary, "🕊️"),
        btn(CHAT_SETTINGS, null, ButtonStyle.Danger, "🔔"),
      ),
    ],
  };
}

/* ───────────── لوحة التحكم داخل الغرفة ───────────── */

export function buildRoomPanel(guildName: string, bannerUrl: string | null, closed: boolean) {
  const embed = baseEmbed(guildName, bannerUrl)
    .setTitle("✶ انشاء دردشة خاصة")
    .setDescription([...INTRO, "", "✥ استعمل الازرار التالية للتحكم الكامل بدردشتك الخاصة"].join("\n"));

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_ADD, "اضافة عضو", ButtonStyle.Primary),
        btn(CHAT_REMOVE, "ازالة عضو", ButtonStyle.Primary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_TRANSFER, "نقل الملكية", ButtonStyle.Secondary),
        btn(CHAT_VOICE, "انشاء صوتي", ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_RENAME, "تغيير الاسم", ButtonStyle.Secondary),
        btn(CHAT_CLEAR, "مسح الشات", ButtonStyle.Secondary),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_DELETE, "حذف الدردشة", ButtonStyle.Danger),
        btn(CHAT_LEAVE, "مغادرة الدردشة", ButtonStyle.Success),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        closed ? btn(CHAT_DOOR, "فتح الباب", ButtonStyle.Success, "🔓") : btn(CHAT_DOOR, "اغلاق الباب", ButtonStyle.Danger, "🔒"),
      ),
    ],
  };
}

/* ───────────── الدعوة (تصل بالخاص) ───────────── */

export function buildInviteDm(inviterId: string, guildName: string, bannerUrl: string | null, roomChannelId: string) {
  const embed = baseEmbed(guildName, bannerUrl).setDescription(`✶ تلقيت دعوة مراسلة\n✶ من: <@${inviterId}>`);
  const extra = `${roomChannelId}:${inviterId}`;
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(cid(CHAT_INV_OK, extra), "قبول", ButtonStyle.Success),
        btn(cid(CHAT_INV_NO, extra), "رفض", ButtonStyle.Danger),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(btn(cid(CHAT_INV_STOP, extra), "ايقاف تلقي الدعوات", ButtonStyle.Secondary)),
    ],
  };
}

/* ───────────── طلب طرق الباب (داخل الغرفة، لصاحبها) ───────────── */

export function buildKnockMessage(roomChannelId: string, ownerId: string, userId: string) {
  const extra = `${roomChannelId}:${userId}`;
  return {
    content: `🚪 <@${ownerId}> فيه أحد يطرق بابك!\n<@${userId}> يطلب الدخول لدردشتك.`,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(cid(CHAT_KNOCK_OK, extra), "قبول", ButtonStyle.Success),
        btn(cid(CHAT_KNOCK_NO, extra), "رفض", ButtonStyle.Danger),
      ),
    ],
  };
}

/* ───────────── زاجل ───────────── */

export function buildZajilDm(senderId: string, guildId: string, guildName: string, text: string) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🕊️ وصلك زاجل!")
    .setDescription(`من: <@${senderId}>\n\n${text}`)
    .setFooter({ text: guildName });
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(cid(CHAT_ZAJIL_REPLY, senderId, guildId), "رد", ButtonStyle.Primary, "↩️"),
      ),
    ],
  };
}

export function buildZajilModal(targetId: string, guildId: string, replyTo = false): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(cid(CHAT_ZAJIL_MODAL, targetId, guildId))
    .setTitle(replyTo ? "رد زاجل" : "إرسال زاجل")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("text")
          .setLabel("نص الرسالة")
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(1)
          .setMaxLength(500)
          .setRequired(true),
      ),
    );
}

export function buildRenameModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(CHAT_RENAME_MODAL)
    .setTitle("تغيير اسم الدردشة")
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId("name").setLabel("الاسم الجديد").setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(50).setRequired(true),
      ),
    );
}

/* ───────────── قوائم الاختيار ───────────── */

export function userPicker(customId: string, placeholder: string) {
  return new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1),
  );
}

export function stringPicker(customId: string, placeholder: string, options: { label: string; value: string; emoji?: string }[]) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(options.slice(0, 25).map((o) => ({ label: o.label.slice(0, 100) || "—", value: o.value, ...(o.emoji ? { emoji: o.emoji } : {}) }))),
  );
}

export const invitePickerView = (roomChannelId: string) => ({
  content: "من تريد دعوته؟",
  components: [userPicker(cid(CHAT_INVITE_PICK, roomChannelId), "اختر العضو لإرسال الدعوة")],
});

export const zajilPickerView = (guildId: string) => ({
  content: "✉️ اختر الشخص الذي تريد إرسال رسالة زاجل له:",
  components: [userPicker(cid(CHAT_ZAJIL_PICK, guildId), "اختر الشخص الذي تريد مراسلته")],
});

export function knockListView(rooms: { channelId: string; name: string }[]) {
  if (rooms.length === 0) return { content: "🚪 ما فيه غرف أبوابها مفتوحة حالياً.", components: [] };
  return {
    content: "اختر الغرفة التي تريد طرق بابها:",
    components: [stringPicker(CHAT_KNOCK_PICK, "اختر غرفة الدردشة لطرق بابها", rooms.map((r) => ({ label: r.name, value: r.channelId, emoji: "🚪" })))],
  };
}

export function radarView(people: { id: string; name: string }[], onRadar: boolean) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("✥ رادار المحادثات")
    .setDescription(
      [
        "• هنا ستجد الاشخاص المتاحين للدردشة حاليا !",
        "• للانضمام للرادار واضافة اسمك اضغط انضمام",
        "",
        "_اختر شخصاً من القائمة لإرسال دعوة لدردشتك. البقاء بالرادار ساعة واحدة._",
      ].join("\n"),
    );

  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
  if (people.length > 0) {
    rows.push(stringPicker(CHAT_RADAR_PICK, "اختر شخصاً لدعوته", people.map((p) => ({ label: p.name, value: p.id, emoji: "👤" }))));
  } else {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("chat_radar_empty")
          .setPlaceholder("لا يوجد أشخاص متاحين حالياً")
          .setDisabled(true)
          .addOptions({ label: "—", value: "none" }),
      ),
    );
  }
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      onRadar ? btn(CHAT_RADAR_JOIN, "مغادرة الرادار", ButtonStyle.Danger) : btn(CHAT_RADAR_JOIN, "الانضمام للرادار", ButtonStyle.Success),
    ),
  );
  return { embeds: [embed], components: rows, content: "" };
}

export function settingsView(guildName: string, s: Pick<IChatSettings, "zajil" | "invites">) {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("✶ لوحة التحكم بالاشعارات والدعوات")
    .setDescription(
      [
        "هنا يمكنك التحكم بـ الاشعارات والدعوات التي تتلقاها",
        "اختار الزر المناسب للتفعيل او التعطيل",
        "",
        "✉️ **زاجل:** استقبال رسائل زاجل من الاعضاء",
        "🚪 **الدعوات:** استقبال دعوات الانضمام للدردشات الخاصة",
      ].join("\n"),
    )
    .setFooter({ text: guildName });

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(CHAT_SET_ZAJIL, `زاجل: ${s.zajil ? "مفعل" : "معطل"}`, s.zajil ? ButtonStyle.Success : ButtonStyle.Danger),
        btn(CHAT_SET_INV, `الدعوات: ${s.invites ? "مفعل" : "معطل"}`, s.invites ? ButtonStyle.Success : ButtonStyle.Danger),
      ),
    ],
    content: "",
  };
}

export function confirmView(text: string, yesId: string) {
  return {
    content: text,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(yesId, "تأكيد", ButtonStyle.Danger),
        btn(CHAT_CANCEL, "إلغاء", ButtonStyle.Secondary),
      ),
    ],
  };
}
