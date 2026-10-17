import {
  ActionRowBuilder,
  ActivityType,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  Routes,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type Client,
  type Guild,
  type Interaction,
  type Message,
  type StringSelectMenuInteraction,
} from "discord.js";
import { config } from "../config";
import { BotStatus } from "../database/models/BotStatus";
import { logger } from "../utils/logger";

/** "!ايقونة البوت": لوحة تخصيص البوت (اسم/صورة/بنر/نبذة) داخل هذا السيرفر فقط. للمالك فقط */
export const BOT_PROFILE_TRIGGER = /^!\s*[اأإ]يقونة\s+البوت$/;

const PREFIX = "bp";
const COLOR = 0x5865f2;
const ephemeral = MessageFlags.Ephemeral;
const IMAGE_WAIT_MS = 60_000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const URL_RE = /https?:\/\/\S+/i;

const isOwner = (id: string) => !!config.ownerId && id === config.ownerId;

type Field = "nick" | "avatar" | "banner" | "bio";

// ───────────────────────── اللوحة ─────────────────────────

async function buildPanel(guild: Guild) {
  const me = (await guild.members.fetchMe().catch(() => null)) ?? guild.members.me;
  const m = me as unknown as { displayName?: string; avatar?: string | null; banner?: string | null } | null;
  const name = m?.displayName ?? guild.client.user.username;

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("تخصيص البوت")
    .setDescription(
      [
        `**الاسم الحالي:** ${name}.`,
        `**الصورة:** ${m?.avatar ? "مخصصة لهذا السيرفر" : "الافتراضية"}`,
        `**البنر:** ${m?.banner ? "مخصص لهذا السيرفر" : "الافتراضي"}`,
        "",
        "الاسم والصورة والبنر والنبذة تنطبق على **هذا السيرفر فقط**.\nالحالة وحدة للبوت كله (ديسكورد ما يسمح بغير كذا).",
      ].join("\n"),
    )
    .setThumbnail(me?.displayAvatarURL({ size: 256 }) ?? guild.client.user.displayAvatarURL({ size: 256 }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`${PREFIX}|menu`)
    .setPlaceholder("اختر ما تبغى تعدله")
    .addOptions(
      { label: "تغيير اسم البوت", value: "nick", emoji: "✏️" },
      { label: "تغيير صورة البوت", value: "avatar", emoji: "🖼️" },
      { label: "تغيير بنر البوت", value: "banner", emoji: "🎨" },
      { label: "تغيير النبذة", value: "bio", emoji: "📝" },
      { label: "تغيير حالة البوت (لكل السيرفرات)", value: "status", emoji: "💬" },
      { label: "حذف حالة البوت", value: "status_clear", emoji: "🧹" },
      { label: "إرجاع كل شي للافتراضي", value: "reset", emoji: "♻️" },
    );

  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
}

// ───────────────────────── التطبيق على السيرفر ─────────────────────────

async function patchMe(guild: Guild, body: Record<string, unknown>): Promise<void> {
  await guild.client.rest.patch(Routes.guildMember(guild.id, "@me"), { body });
}

async function toDataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("download");
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(type)) throw new Error("type");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("size");
  return `data:${type};base64,${buf.toString("base64")}`;
}

function errorText(err: unknown): string {
  const e = err as { message?: string; code?: number | string; rawError?: { message?: string } };
  if (e?.message === "download") return "ما قدرت أنزّل الصورة.";
  if (e?.message === "type") return "الملف لازم يكون صورة (PNG أو JPG أو GIF أو WEBP).";
  if (e?.message === "size") return "حجم الصورة كبير (الحد 8MB).";
  if (e?.code === 50013 || e?.code === 50001) return "البوت ما عنده صلاحية، تأكد من صلاحية **تغيير الاسم المستعار**.";
  if (e?.code === 50035) return `Discord رفض القيمة: ${e.rawError?.message ?? e.message ?? ""}`;
  if (e?.code === 20028 || e?.code === 429) return "تغييرات كثيرة بوقت قصير، جرب بعد شوي.";
  return e?.message ?? "خطأ غير معروف.";
}

async function apply(guild: Guild, field: Field, value: string): Promise<void> {
  if (field === "nick") return patchMe(guild, { nick: value });
  if (field === "bio") return patchMe(guild, { bio: value });
  return patchMe(guild, { [field]: await toDataUri(value) });
}

// ───────────────────────── الحالة (عامة لكل السيرفرات) ─────────────────────────

function setPresenceText(client: Client, text: string): void {
  client.user?.setPresence({
    status: "online",
    activities: text ? [{ name: "Custom Status", type: ActivityType.Custom, state: text }] : [],
  });
}

/** استدعها مرة عند تشغيل البوت (في حدث ready) عشان ترجع الحالة المحفوظة بعد إعادة التشغيل */
export async function applyBotStatus(client: Client): Promise<void> {
  const doc = await BotStatus.findOne({ key: "main" }).lean().catch(() => null);
  if (doc?.text) setPresenceText(client, doc.text);
}

async function saveStatus(client: Client, text: string): Promise<void> {
  await BotStatus.updateOne({ key: "main" }, { $set: { text } }, { upsert: true });
  setPresenceText(client, text);
}

// ───────────────────────── الأمر النصي ─────────────────────────

export async function handleBotProfileMessage(message: Message<true>): Promise<boolean> {
  if (!BOT_PROFILE_TRIGGER.test(message.content.trim())) return false;
  if (!isOwner(message.author.id)) return true; // غير المالك: ما يصير شي
  await message.channel.send(await buildPanel(message.guild)).catch(() => undefined);
  return true;
}

// ───────────────────────── التفاعلات ─────────────────────────

export async function handleBotProfileInteraction(i: Interaction): Promise<boolean> {
  const id = "customId" in i ? (i.customId as string) : "";
  if (!id.startsWith(`${PREFIX}|`)) return false;

  try {
    if (!i.inGuild() || !i.guild) return true;
    if (!isOwner(i.user.id)) {
      if (i.isRepliable()) await i.reply({ content: "🔒 هذا للمالك فقط.", flags: ephemeral });
      return true;
    }

    if (i.isStringSelectMenu()) {
      await handleSelect(i);
      return true;
    }

    if (i.isModalSubmit()) {
      const field = id.split("|")[1] as Field;
      const value = i.fields.getTextInputValue("v").trim();
      if (!value) {
        await i.reply({ content: "❌ القيمة فاضية.", flags: ephemeral });
        return true;
      }
      await i.deferReply({ flags: ephemeral });
      try {
        if ((field as string) === "status") {
          await saveStatus(i.client, value);
          await i.editReply({ content: "✅ تم تغيير حالة البوت (تظهر في كل السيرفرات)." });
          return true;
        }
        await apply(i.guild, field, value);
        await i.editReply({ content: "✅ تم التحديث لهذا السيرفر." });
        if (i.isFromMessage()) await i.message.edit(await buildPanel(i.guild)).catch(() => undefined);
      } catch (err) {
        logger.error("فشل تخصيص البوت", err);
        await i.editReply({ content: `❌ ${errorText(err)}` });
      }
      return true;
    }
  } catch (err) {
    logger.error("خطأ في تخصيص البوت", err);
  }
  return true;
}

async function handleSelect(i: StringSelectMenuInteraction<"cached" | "raw">): Promise<void> {
  const guild = i.guild!;
  const choice = i.values[0];

  if (choice === "status_clear") {
    await i.deferReply({ flags: ephemeral });
    try {
      await saveStatus(i.client, "");
      await i.editReply({ content: "✅ انحذفت حالة البوت." });
    } catch (err) {
      logger.error("فشل حذف الحالة", err);
      await i.editReply({ content: `❌ ${errorText(err)}` });
    }
    return;
  }

  if (choice === "nick" || choice === "bio" || choice === "status") {
    const meta = {
      nick: { label: "الاسم الجديد للبوت في هذا السيرفر", title: "تغيير اسم البوت", max: 32, short: true },
      bio: { label: "النبذة الجديدة", title: "تغيير النبذة", max: 190, short: false },
      status: { label: "نص الحالة (يظهر في كل السيرفرات)", title: "تغيير حالة البوت", max: 128, short: true },
    }[choice];
    const input = new TextInputBuilder()
      .setCustomId("v")
      .setLabel(meta.label)
      .setStyle(meta.short ? TextInputStyle.Short : TextInputStyle.Paragraph)
      .setMaxLength(meta.max)
      .setRequired(true);
    await i.showModal(
      new ModalBuilder()
        .setCustomId(`${PREFIX}|${choice}`)
        .setTitle(meta.title)
        .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)),
    );
    return;
  }

  if (choice === "reset") {
    await i.deferReply({ flags: ephemeral });
    try {
      await patchMe(guild, { nick: null, avatar: null, banner: null, bio: "" });
      await i.editReply({ content: "✅ رجع كل شي للافتراضي في هذا السيرفر." });
      await i.message.edit(await buildPanel(guild)).catch(() => undefined);
    } catch (err) {
      logger.error("فشل إعادة ضبط البوت", err);
      await i.editReply({ content: `❌ ${errorText(err)}` });
    }
    return;
  }

  // صورة / بنر: ننتظر رسالة فيها صورة من المالك
  const field = choice as "avatar" | "banner";
  const label = field === "avatar" ? "الصورة" : "البنر";
  await i.reply({
    content: `📷 أرسل ${label} الجديدة الحين في هذا الروم (صورة مرفقة أو رابط) خلال 60 ثانية.`,
    flags: ephemeral,
  });

  const channel = i.channel;
  if (!channel || !("awaitMessages" in channel)) return;
  const got = await channel
    .awaitMessages({
      filter: (m: Message) =>
        m.author.id === i.user.id && (m.attachments.size > 0 || URL_RE.test(m.content)),
      max: 1,
      time: IMAGE_WAIT_MS,
    })
    .then((c) => c.first() ?? null)
    .catch(() => null);

  if (!got) {
    await i.editReply({ content: "⌛ انتهى الوقت." }).catch(() => undefined);
    return;
  }

  const url = got.attachments.first()?.url ?? URL_RE.exec(got.content)?.[0];
  if (!url) {
    await i.editReply({ content: "❌ ما لقيت صورة." }).catch(() => undefined);
    return;
  }

  try {
    await apply(guild, field, url);
    await got.delete().catch(() => undefined);
    await i.editReply({ content: `✅ تم تغيير ${label} لهذا السيرفر.` });
    await i.message.edit(await buildPanel(guild)).catch(() => undefined);
  } catch (err) {
    logger.error("فشل تغيير صورة البوت", err);
    await i.editReply({ content: `❌ ${errorText(err)}` }).catch(() => undefined);
  }
}
