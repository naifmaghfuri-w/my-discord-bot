import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Interaction,
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";
import * as Discord from "discord.js";
import { Whisper, WhisperBlock, type IWhisper } from "../database/models/Whisper";
import { logger } from "../utils/logger";

/** "!همسة @شخص" لإرسال همسة، "!همسة فك @شخص" لفك حظر شخص */
export const WHISPER_TRIGGER = /^!\s*همس[ةه](?:\s+([\s\S]+))?$/;

const COLOR = 0xf43f5e;
const PREFIX = "wh";
const READ_DELETE_MS = 30_000;
const PROMPT_TTL_MS = 120_000;
const COOLDOWN_MS = 5_000;
const lastSent = new Map<string, number>();

const ephemeral = MessageFlags.Ephemeral;
const quote = (t: string) => t.split("\n").map((l) => `> ${l}`).join("\n");

function buildModal(fromId: string, toId: string, origId?: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`${PREFIX}|send|${fromId}|${toId}${origId ? `|${origId}` : ""}`)
    .setTitle("كتابة الهمسة");

  const input = new TextInputBuilder()
    .setCustomId("text")
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder("اكتب النص هنا...")
    .setMaxLength(250)
    .setRequired(true);

  // النماذج الحديثة (discord.js 14.22+) تدعم رفع صورة داخل النموذج. لو النسخة أقدم نكتفي بخانة النص
  const D = Discord as unknown as Record<string, any>;
  if (D.LabelBuilder && D.FileUploadBuilder) {
    const textLabel = new D.LabelBuilder().setLabel("اكتب همستك").setTextInputComponent(input);
    const file = new D.FileUploadBuilder().setCustomId("img").setRequired(false).setMinValues(0).setMaxValues(1);
    const fileLabel = new D.LabelBuilder().setLabel("صورة أو فيديو (اختياري)").setFileUploadComponent(file);
    (modal as any).addLabelComponents(textLabel, fileLabel);
  } else {
    input.setLabel("اكتب همستك");
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }
  return modal;
}

// ───────────────────────── الأمر النصي ─────────────────────────

export async function handleWhisperMessage(message: Message<true>): Promise<boolean> {
  const m = WHISPER_TRIGGER.exec(message.content.trim());
  if (!m) return false;

  const reply = (content: string) =>
    message.reply({ content, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);

  const rest = (m[1] ?? "").trim();
  const mention = /<@!?(\d+)>/.exec(rest);

  if (!mention) {
    await reply("✉️ الاستخدام: `!همسة @شخص`\nلفك حظر شخص: `!همسة فك @شخص`");
    return true;
  }
  const targetId = mention[1];
  const authorId = message.author.id;

  // فك حظر
  if (/^(فك|الغاء|إلغاء|الغاء حظر)\b/.test(rest)) {
    const res = await WhisperBlock.deleteOne({ guildId: message.guildId, blockerId: authorId, blockedId: targetId }).catch(() => null);
    await reply(res && res.deletedCount ? `✅ تم فك الحظر عن <@${targetId}>.` : "❌ هذا الشخص مو محظور عندك.");
    return true;
  }

  if (targetId === authorId) {
    await reply("😅 ما تقدر تهمس لنفسك.");
    return true;
  }
  const target = await message.client.users.fetch(targetId).catch(() => null);
  if (!target || target.bot) {
    await reply("❌ ما لقيت هذا العضو.");
    return true;
  }
  const blocked = await WhisperBlock.exists({ guildId: message.guildId, blockerId: targetId, blockedId: authorId }).catch(() => null);
  if (blocked) {
    await reply("🚫 ما تقدر ترسل همسة لهذا الشخص.");
    return true;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}|write|${authorId}|${targetId}`)
      .setLabel("كتابة الهمسة")
      .setEmoji("✍️")
      .setStyle(ButtonStyle.Primary),
  );
  const prompt = await message
    .reply({
      embeds: [new EmbedBuilder().setColor(COLOR).setDescription(`💌 همسة إلى <@${targetId}>\nاضغط الزر واكتب همستك.`)],
      components: [row],
      allowedMentions: { parse: [], repliedUser: false },
    })
    .catch(() => null);
  if (prompt) setTimeout(() => void prompt.delete().catch(() => undefined), PROMPT_TTL_MS);
  return true;
}

// ───────────────────────── التفاعلات ─────────────────────────

export async function handleWhisperInteraction(i: Interaction): Promise<boolean> {
  try {
    if (i.isButton() && i.customId.startsWith(`${PREFIX}|`)) {
      await handleButton(i);
      return true;
    }
    if (i.isModalSubmit() && i.customId.startsWith(`${PREFIX}|`)) {
      await handleModal(i);
      return true;
    }
  } catch (err) {
    logger.error("خطأ في الهمسات", err);
    if (i.isRepliable() && !i.replied && !i.deferred) {
      await i.reply({ content: "❌ حدث خطأ.", flags: ephemeral }).catch(() => undefined);
    }
    return true;
  }
  return false;
}

async function handleButton(i: ButtonInteraction): Promise<void> {
  const [, action, a, b, c] = i.customId.split("|");

  if (action === "read") {
    await i.deferUpdate().catch(() => undefined);
    return;
  }

  // كتابة همسة جديدة (صاحب الأمر فقط)
  if (action === "write") {
    if (i.user.id !== a) {
      await i.reply({ content: "🔒 هذا الزر لصاحب الأمر. اكتب `!همسة @شخص`.", flags: ephemeral });
      return;
    }
    await i.showModal(buildModal(a, b));
    return;
  }

  const doc = await Whisper.findById(a).catch(() => null);
  if (!doc) {
    await i.reply({ content: "⌛ انتهت صلاحية هذه الهمسة.", flags: ephemeral });
    return;
  }

  // عرض الهمسة
  if (action === "view") {
    const isRecipient = i.user.id === doc.toId;
    if (!isRecipient && i.user.id !== doc.fromId) {
      await i.reply({ content: "هذه الرسالة ليست لك.", flags: ephemeral });
      return;
    }

    const orig = doc.replyTo ? await Whisper.findById(doc.replyTo).catch(() => null) : null;
    const lines = [`**المرسل:** <@${doc.fromId}>`, ""];
    if (orig) lines.push("**الرسالة الأصلية:**", quote(orig.text), "", "**الردّ:**");
    lines.push(quote(doc.text));

    const embed = new EmbedBuilder()
      .setColor(COLOR)
      .setTitle("💌 محتوى الهمسة")
      .setDescription(lines.join("\n"))
      .setThumbnail(i.guild?.iconURL() ?? null);
    const isVideo = doc.mediaType === "video" && !!doc.imageUrl;
    if (doc.imageUrl && !isVideo) embed.setImage(doc.imageUrl);
    if (isVideo) embed.setDescription(`${lines.join("\n")}\n\n🎬 **فيديو مرفق** بالأسفل`);
    if (isRecipient) embed.setFooter({ text: "تُحذف رسالة «وصلتك همسة» بعد ٣٠ ثانية" });

    const row = new ActionRowBuilder<ButtonBuilder>();
    if (isRecipient) {
      row.addComponents(
        new ButtonBuilder().setCustomId(`${PREFIX}|reply|${doc.id}`).setLabel("الرد على الهمسة").setEmoji("↩️").setStyle(ButtonStyle.Success),
      );
      if (!doc.replyTo) {
        row.addComponents(
          new ButtonBuilder().setCustomId(`${PREFIX}|block|${doc.id}`).setLabel("حظر المرسل").setEmoji("🚫").setStyle(ButtonStyle.Danger),
        );
      }
    }

    await i.reply({
      // رابط الفيديو في المحتوى: ديسكورد يعرضه كمشغّل فيديو داخل الرسالة
      ...(isVideo ? { content: doc.imageUrl } : {}),
      embeds: [embed],
      components: row.components.length ? [row] : [],
      flags: ephemeral,
      allowedMentions: { parse: [] },
    });

    // المستلم فتحها: نعلّمها مقروءة ونحذف رسالة الإشعار بعد 30 ثانية
    if (isRecipient && !doc.readAt) {
      doc.readAt = new Date();
      await doc.save().catch(() => undefined);
      const readRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`${PREFIX}|read`).setLabel("مقروءة").setEmoji("✅").setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      const notice = i.message;
      await notice.edit({ components: [readRow] }).catch(() => undefined);
      setTimeout(() => void notice.delete().catch(() => undefined), READ_DELETE_MS);
    }
    return;
  }

  // الرد
  if (action === "reply") {
    if (i.user.id !== doc.toId) {
      await i.reply({ content: "هذه الرسالة ليست لك.", flags: ephemeral });
      return;
    }
    await i.showModal(buildModal(doc.toId, doc.fromId, doc.id));
    return;
  }

  // حظر المرسل
  if (action === "block") {
    if (i.user.id !== doc.toId) {
      await i.reply({ content: "هذه الرسالة ليست لك.", flags: ephemeral });
      return;
    }
    await WhisperBlock.updateOne(
      { guildId: doc.guildId, blockerId: doc.toId, blockedId: doc.fromId },
      { $setOnInsert: { guildId: doc.guildId, blockerId: doc.toId, blockedId: doc.fromId } },
      { upsert: true },
    ).catch(() => undefined);
    await i.reply({
      content: `🚫 تم حظر <@${doc.fromId}> من إرسال همسات لك.\nلفك الحظر: \`!همسة فك @شخص\``,
      flags: ephemeral,
      allowedMentions: { parse: [] },
    });
  }
}

async function handleModal(i: ModalSubmitInteraction): Promise<void> {
  const [, action, fromId, toId, origId] = i.customId.split("|");
  if (action !== "send" || !i.guildId) return;

  if (i.user.id !== fromId) {
    await i.reply({ content: "🔒 هذا مو لك.", flags: ephemeral });
    return;
  }

  const text = i.fields.getTextInputValue("text").trim();
  if (!text) {
    await i.reply({ content: "❌ اكتب نص الهمسة.", flags: ephemeral });
    return;
  }

  const now = Date.now();
  if (now - (lastSent.get(fromId) ?? 0) < COOLDOWN_MS) {
    await i.reply({ content: "⏳ انتظر ثواني قبل الهمسة التالية.", flags: ephemeral });
    return;
  }

  const blocked = await WhisperBlock.exists({ guildId: i.guildId, blockerId: toId, blockedId: fromId }).catch(() => null);
  if (blocked) {
    await i.reply({ content: "🚫 ما تقدر ترسل همسة لهذا الشخص.", flags: ephemeral });
    return;
  }

  // المرفق (اختياري): صورة أو فيديو. يظهر فقط إذا نسخة discord.js تدعم رفع الملفات في النموذج
  let mediaUrl: string | undefined;
  let mediaType: "image" | "video" | undefined;
  try {
    const files = (i.fields as any).getUploadedFiles?.("img") as
      | Map<string, { url: string; contentType?: string | null; size?: number }>
      | null
      | undefined;
    const first = files ? [...files.values()][0] : undefined;
    const ct = first?.contentType ?? "";
    if (first && ct.startsWith("image/")) {
      mediaUrl = first.url;
      mediaType = "image";
    } else if (first && ct.startsWith("video/")) {
      mediaUrl = first.url;
      mediaType = "video";
    }
  } catch {
    /* بدون مرفق */
  }

  const channel = i.channel;
  if (!channel || !("send" in channel)) {
    await i.reply({ content: "❌ ما أقدر أرسل هنا.", flags: ephemeral });
    return;
  }

  const doc = await Whisper.create({
    guildId: i.guildId,
    fromId,
    toId,
    text,
    ...(mediaUrl ? { imageUrl: mediaUrl, mediaType } : {}),
    ...(origId ? { replyTo: origId } : {}),
  });
  lastSent.set(fromId, now);

  const isReply = !!origId;
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(isReply ? "↩️ ردّ على همستك" : "💌 وصلتك همسة")
    .setThumbnail(i.guild?.iconURL() ?? null)
    .setDescription(
      isReply
        ? `<@${fromId}> — ردّ عليك <@${toId}> على الهمسة.`
        : `<@${fromId}> — همس لك <@${toId}>.\nاضغط الزرّ واقرأ ما كُتب لك — لا يفتحه غيركما.`,
    );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}|view|${doc.id}`)
      .setLabel(isReply ? "عرض الردّ" : "عرض الهمسة")
      .setEmoji("💌")
      .setStyle(ButtonStyle.Primary),
  );

  const sent = await channel
    .send({ content: `<@${toId}>`, embeds: [embed], components: [row], allowedMentions: { users: [toId] } })
    .catch((err: unknown) => {
      logger.error("فشل إرسال إشعار الهمسة", err);
      return null;
    });
  if (!sent) {
    await Whisper.deleteOne({ _id: doc._id }).catch(() => undefined);
    await i.reply({ content: "❌ ما قدرت أرسل الإشعار (تأكد من صلاحيات البوت بالروم).", flags: ephemeral });
    return;
  }

  await i.reply({ content: "✅ أُرسلت الهمسة.", flags: ephemeral });
  // نحذف رسالة "كتابة الهمسة" لو النموذج انفتح منها
  if (i.isFromMessage() && !origId) await i.message.delete().catch(() => undefined);
}

export type { IWhisper };
