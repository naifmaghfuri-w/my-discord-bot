import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, MessageFlags, ModalBuilder, PermissionFlagsBits,
  StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, type BaseMessageOptions, type Interaction, type Message,
} from "discord.js";
import { config } from "../config";
import { TalkConfig, TalkMemory, TalkPersona, TalkUsage, type ITalkConfig } from "../database/models/Talk";
import { logger } from "../utils/logger";
import { DEFAULT_MODEL, aiConfigured, askClaude, buildSystemPrompt, isExtractionAttempt, wantsVoice, type Turn } from "./ai";
import { sendVoiceReply, ttsAvailable } from "./tts";
import { VOICES, getVoice } from "./voices";

/** "!ذكاء": لوحة إعدادات البوت المتحدث (للمسؤولين) */
export const TALK_TRIGGER = /^!\s*ذكاء$/;

const ON = "<:status_on:1560828496048029736>";
const OFF = "<:status_off:1560828694417641523>";
const COLOR = 0x9b59b6;
const eph = { flags: MessageFlags.Ephemeral } as const;
type View = BaseMessageOptions;

/* ───────────── مساعدات ───────────── */

function dayKey(): string {
  const opts = { year: "numeric", month: "2-digit", day: "2-digit" } as const;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: process.env.TIMEZONE || "UTC", ...opts }).format(Date.now());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...opts }).format(Date.now());
  }
}

const isAdmin = (userId: string, perms: Readonly<{ has(p: bigint): boolean }> | null | undefined): boolean =>
  Boolean((config.ownerId && userId === config.ownerId) || perms?.has(PermissionFlagsBits.Administrator));

async function getConfig(guildId: string): Promise<ITalkConfig> {
  const doc = await TalkConfig.findOneAndUpdate({ guildId }, { $setOnInsert: { guildId } }, { upsert: true, new: true });
  if (!doc) throw new Error("تعذّر جلب إعدادات الذكاء");
  return doc;
}

async function takeQuota(guildId: string, limit: number): Promise<boolean> {
  if (limit <= 0) return true;
  try {
    const r = await TalkUsage.findOneAndUpdate({ guildId, day: dayKey(), count: { $lt: limit } }, { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } }, { upsert: true, new: true });
    return Boolean(r);
  } catch {
    return false; // مفتاح مكرر = وصل الحد
  }
}

const toDigits = (s: string): string => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[^\d]/g, "");
const toInt = (s: string): number => {
  const d = toDigits(s);
  return d ? Number(d) : NaN;
};

/* ───────────── الرد على الرسائل ───────────── */

const lastReply = new Map<string, number>();
const busy = new Set<string>();
let warnedNoKey = false;

/** يستدعيه messageCreate لكل رسالة عادية (لا ينتظره) */
export async function handleTalkReply(message: Message): Promise<void> {
  try {
    await talkReply(message);
  } catch (err) {
    logger.error("خطأ في رد الذكاء", err);
  }
}

async function talkReply(message: Message): Promise<void> {
  if (!message.inGuild() || message.author.bot) return;
  const raw = message.content.trim();
  if (!raw || raw.startsWith("!") || /^afk(\s|$)/i.test(raw)) return;
  const botId = message.client.user?.id;
  if (!botId) return;

  const cfg = await TalkConfig.findOne({ guildId: message.guildId });
  if (!cfg || !cfg.enabled) return;

  const inRoom = Boolean(cfg.roomId) && message.channelId === cfg.roomId;
  let addressed = inRoom;
  if (!addressed && cfg.mention) {
    addressed = message.mentions.has(botId, { ignoreEveryone: true, ignoreRoles: true });
    if (!addressed && message.reference?.messageId) {
      const ref = await message.fetchReference().catch(() => null);
      addressed = ref?.author.id === botId;
    }
  }
  if (!addressed) return;

  if (!aiConfigured()) {
    if (!warnedNoKey) logger.warn("ANTHROPIC_API_KEY غير مضبوط: الذكاء متوقف");
    warnedNoKey = true;
    return;
  }

  const key = `${message.guildId}:${message.author.id}`;
  if (busy.has(key)) return;
  if (Date.now() - (lastReply.get(key) ?? 0) < cfg.cooldownSec * 1000) return;

  // نص المستخدم بعد تنظيف المنشن
  const guild = message.guild;
  const text = raw
    .replace(new RegExp(`<@!?${botId}>`, "g"), "")
    .replace(/<@!?(\d+)>/g, (_m, id: string) => `@${message.mentions.members?.get(id)?.displayName ?? message.mentions.users.get(id)?.username ?? "عضو"}`)
    .trim();
  if (!text) return;

  if (isExtractionAttempt(text)) {
    await message.reply({ content: cfg.protectReply.slice(0, 500), allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
    lastReply.set(key, Date.now());
    return;
  }

  if (!(await takeQuota(message.guildId, cfg.dailyLimit))) return;
  busy.add(key);
  lastReply.set(key, Date.now());
  try {
    await message.channel.sendTyping().catch(() => undefined);

    const mentionedIds = [...message.mentions.users.values()].filter((u) => u.id !== botId && !u.bot).map((u) => u.id);
    const personas = await TalkPersona.find({ guildId: message.guildId, userId: { $in: [message.author.id, ...mentionedIds] } });
    const personaOf = (id: string) => personas.find((p) => p.userId === id);
    const fmtPersona = (id: string) => {
      const p = personaOf(id);
      return p ? `${p.name ? `يحب أن يُنادى "${p.name}". ` : ""}${p.description}` : "";
    };
    const speakerName = personaOf(message.author.id)?.name || message.member?.displayName || message.author.username;

    const emojis = cfg.emojis
      ? guild.emojis.cache.filter((e) => e.available !== false).first(30).map((e) => e.toString())
      : [];

    const wantVoice = ttsAvailable() && (wantsVoice(text) || (cfg.voiceRatio > 0 && Math.random() * 100 < cfg.voiceRatio));

    const system = buildSystemPrompt({
      botName: message.client.user?.displayName ?? "البوت",
      guildName: guild.name,
      personality: cfg.personality,
      speakerName,
      speakerPersona: fmtPersona(message.author.id),
      mentioned: mentionedIds.map((id) => ({ name: message.mentions.members?.get(id)?.displayName ?? message.mentions.users.get(id)?.username ?? "عضو", persona: fmtPersona(id) })),
      emojis,
      voice: wantVoice,
    });

    // السياق: ذاكرة العضو + الرسالة التي يرد عليها
    const history: Turn[] = [];
    if (cfg.memory > 0) {
      const mem = await TalkMemory.findOne({ guildId: message.guildId, userId: message.author.id });
      if (mem) history.push(...mem.turns.slice(-cfg.memory * 2).map((t) => ({ role: t.role, content: t.content }) as Turn));
    }
    let userContent = text;
    if (message.reference?.messageId) {
      const ref = await message.fetchReference().catch(() => null);
      if (ref && ref.author.id !== botId && ref.content) userContent = `[رداً على رسالة ${ref.member?.displayName ?? ref.author.username}: "${ref.content.slice(0, 300)}"]\n${text}`;
    }
    history.push({ role: "user", content: userContent.slice(0, 1500) });

    const answer = await askClaude(system, history, cfg.model || DEFAULT_MODEL);
    if (!answer) return;
    const reply = answer.replace(/@(everyone|here)/g, "@​$1").slice(0, 1900);

    let sentVoice = false;
    if (wantVoice) sentVoice = await sendVoiceReply(message, reply, cfg.voice);
    if (!sentVoice) {
      await message.reply({ content: reply, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
    }

    if (cfg.memory > 0) {
      await TalkMemory.updateOne(
        { guildId: message.guildId, userId: message.author.id },
        {
          $push: { turns: { $each: [{ role: "user", content: text.slice(0, 600) }, { role: "assistant", content: reply.slice(0, 600) }], $slice: -(cfg.memory * 2) } },
          $set: { updatedAt: new Date() },
        },
        { upsert: true },
      );
    }
  } finally {
    busy.delete(key);
  }
}

/* ───────────── اللوحة ───────────── */

const SETTINGS = [
  { v: "room", label: "الغرفة", desc: "الغرفة اللي يرد فيها على كل رسالة", emoji: "💬" },
  { v: "mention", label: "المنشن", desc: "يرد في أي غرفة عند منشنه أو الرد عليه", emoji: "🔔" },
  { v: "personality", label: "الشخصية", desc: "وصف أسلوب البوت وشخصيته", emoji: "🎭" },
  { v: "daily", label: "الحد اليومي", desc: "أقصى ردود في اليوم للسيرفر", emoji: "📊" },
  { v: "cooldown", label: "المهلة", desc: "ثواني بين رديّن للعضو نفسه", emoji: "⏳" },
  { v: "model", label: "الموديل", desc: "اسم النموذج (فارغ = الافتراضي)", emoji: "🧠" },
  { v: "voice", label: "الصوت", desc: "صوت الردود الصوتية", emoji: "🎙️" },
  { v: "ratio", label: "نسبة الصوت", desc: "نسبة الردود الصوتية (0 = عند الطلب فقط)", emoji: "🔊" },
  { v: "emojis", label: "الايموجي", desc: "يستعمل إيموجيات السيرفر في ردوده", emoji: "😀" },
  { v: "memory", label: "الذاكرة", desc: "كم دور يتذكر من كل عضو (0 = لا ذاكرة)", emoji: "🧵" },
  { v: "protect", label: "رد الحماية", desc: "رده على محاولات كشف التعليمات", emoji: "🛡️" },
] as const;

async function buildPanel(guildId: string, note?: string): Promise<View> {
  const cfg = await getConfig(guildId);
  const usage = await TalkUsage.findOne({ guildId, day: dayKey() });
  const keyOk = aiConfigured();
  const lines = [
    note ?? "",
    `${cfg.enabled ? ON : OFF} **الحالة:** ${cfg.enabled ? "شغّال" : "متوقف"}`,
    `${keyOk ? ON : OFF} **مفتاح Claude:** ${keyOk ? "مضبوط" : "ناقص (ANTHROPIC_API_KEY)"}`,
    `${ttsAvailable() ? ON : OFF} **توليد الصوت:** ${ttsAvailable() ? "متوفر" : "حزمة msedge-tts ناقصة"}`,
    "",
    `💬 **الغرفة:** ${cfg.roomId ? `<#${cfg.roomId}>` : "غير محددة"}`,
    `🔔 **المنشن:** ${cfg.mention ? "مفعّل" : "متوقف"}`,
    `🎭 **الشخصية:** ${cfg.personality ? cfg.personality.slice(0, 80) + (cfg.personality.length > 80 ? "…" : "") : "الافتراضية"}`,
    `📊 **الحد اليومي:** ${usage?.count ?? 0}/${cfg.dailyLimit > 0 ? cfg.dailyLimit : "∞"}`,
    `⏳ **المهلة:** ${cfg.cooldownSec} ثانية`,
    `🧠 **الموديل:** \`${cfg.model || DEFAULT_MODEL}\``,
    `🎙️ **الصوت:** ${getVoice(cfg.voice).label}`,
    `🔊 **نسبة الصوت:** ${cfg.voiceRatio}%`,
    `😀 **الايموجي:** ${cfg.emojis ? "مفعّل" : "متوقف"}`,
    `🧵 **الذاكرة:** ${cfg.memory} دور`,
  ].filter((l, i) => l !== "" || i > 0);
  const embed = new EmbedBuilder().setColor(COLOR).setTitle("🤖 البوت المتحدث").setDescription(lines.join("\n"));
  const menu = new StringSelectMenuBuilder()
    .setCustomId("tk|set")
    .setPlaceholder("اختر إعدادًا لتعديله")
    .addOptions(SETTINGS.map((s) => ({ label: s.label, value: s.v, description: s.desc, emoji: s.emoji })));
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("tk|toggle").setLabel(cfg.enabled ? "إيقاف" : "تشغيل").setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
        new ButtonBuilder().setCustomId("tk|personas").setLabel("شخصيات الأعضاء").setEmoji("👥").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("tk|clear").setLabel("مسح الذاكرة").setEmoji("🧹").setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

async function buildPersonas(guildId: string, note?: string): Promise<View> {
  const list = await TalkPersona.find({ guildId }).limit(20);
  const lines = list.map((p) => `<@${p.userId}>${p.name ? ` — **${p.name}**` : ""}: ${p.description.slice(0, 70)}${p.description.length > 70 ? "…" : ""}`);
  return {
    content: note,
    embeds: [new EmbedBuilder().setColor(COLOR).setTitle("👥 شخصيات الأعضاء").setDescription(lines.join("\n") || "ما فيه شخصيات محفوظة.\nالشخصية تعرّف البوت بالعضو وكيف يكلمه.")],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId("tk|padd").setLabel("إضافة / تعديل").setEmoji("➕").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("tk|pdel").setLabel("حذف").setEmoji("🗑️").setStyle(ButtonStyle.Danger),
      ),
    ],
  };
}

const input = (id: string, label: string, opts: { style?: TextInputStyle; required?: boolean; max?: number; value?: string; ph?: string } = {}) => {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(opts.style ?? TextInputStyle.Short).setRequired(opts.required ?? true).setMaxLength(opts.max ?? 100);
  if (opts.value) t.setValue(opts.value.slice(0, opts.max ?? 100));
  if (opts.ph) t.setPlaceholder(opts.ph);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(t);
};
const modal = (id: string, title: string, ...rows: ActionRowBuilder<TextInputBuilder>[]) => new ModalBuilder().setCustomId(id).setTitle(title).addComponents(...rows);

/** "!ذكاء": يفتح اللوحة للمسؤولين */
export async function handleTalkMessage(message: Message): Promise<boolean> {
  if (!message.inGuild() || !TALK_TRIGGER.test(message.content.trim())) return false;
  if (!isAdmin(message.author.id, message.member?.permissions)) {
    await message.reply({ content: "❌ هذي اللوحة للمسؤولين فقط.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return true;
  }
  await message.channel.send(await buildPanel(message.guildId)).catch(() => undefined);
  return true;
}

/* ───────────── التفاعلات ───────────── */

const NUMERIC: Record<string, { field: "dailyLimit" | "cooldownSec" | "voiceRatio" | "memory"; label: string; min: number; max: number; hint: string }> = {
  daily: { field: "dailyLimit", label: "الحد اليومي", min: 0, max: 100000, hint: "0 = بلا حد" },
  cooldown: { field: "cooldownSec", label: "المهلة بالثواني", min: 0, max: 600, hint: "مثال: 6" },
  ratio: { field: "voiceRatio", label: "نسبة الصوت %", min: 0, max: 100, hint: "0 = عند الطلب فقط" },
  memory: { field: "memory", label: "عدد الأدوار المحفوظة", min: 0, max: 20, hint: "0 = لا ذاكرة" },
};
const TEXTUAL: Record<string, { field: "personality" | "model" | "protectReply"; label: string; max: number; long: boolean; required: boolean }> = {
  personality: { field: "personality", label: "الشخصية", max: 1500, long: true, required: false },
  model: { field: "model", label: "اسم النموذج", max: 60, long: false, required: false },
  protect: { field: "protectReply", label: "رد الحماية", max: 300, long: true, required: true },
};

export async function handleTalkInteraction(i: Interaction): Promise<boolean> {
  if (!(i.isButton() || i.isStringSelectMenu() || i.isChannelSelectMenu() || i.isModalSubmit())) return false;
  if (!i.customId.startsWith("tk|")) return false;
  if (!i.inGuild()) return true;
  try {
    await route(i);
  } catch (err) {
    logger.error("خطأ في لوحة الذكاء", err);
    if (!i.replied && !i.deferred) await i.reply({ content: "⚠️ صار خطأ، حاول مرة ثانية.", ...eph }).catch(() => undefined);
  }
  return true;
}

type TalkI = Extract<Interaction, { customId: string }>;

async function route(i: TalkI): Promise<void> {
  const guildId = i.guildId as string;
  if (!isAdmin(i.user.id, i.memberPermissions)) {
    await i.reply({ content: "❌ للمسؤولين فقط.", ...eph });
    return;
  }
  const [, act, arg] = i.customId.split("|");
  /** يحدّث رسالة اللوحة لو التفاعل جاي منها، وإلا يرد */
  const refresh = async (view: View) => {
    if ("isFromMessage" in i && i.isModalSubmit() && !i.isFromMessage()) return i.reply({ ...view, ...eph });
    return (i as unknown as { update(v: View): Promise<unknown> }).update(view);
  };

  /* قائمة الإعدادات */
  if (act === "set" && i.isStringSelectMenu()) {
    const key = i.values[0];
    const cfg = await getConfig(guildId);
    if (key === "mention" || key === "emojis") {
      const field = key === "mention" ? "mention" : "emojis";
      await TalkConfig.updateOne({ guildId }, { $set: { [field]: !cfg[field] } });
      await i.update(await buildPanel(guildId));
      return;
    }
    if (key === "room") {
      const menu = new ChannelSelectMenuBuilder().setCustomId("tk|room").setPlaceholder("اختر الغرفة (اتركها فاضية للإزالة)").setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setMinValues(0).setMaxValues(1);
      await i.reply({ content: "اختر الغرفة اللي يرد فيها على كل رسالة:", components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu)], ...eph });
      return;
    }
    if (key === "voice") {
      const menu = new StringSelectMenuBuilder().setCustomId("tk|voice").setPlaceholder("اختر الصوت").addOptions(VOICES.map((v) => ({ label: v.label, value: v.id, default: v.id === cfg.voice })));
      await i.reply({ content: "اختر صوت الردود الصوتية:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ...eph });
      return;
    }
    const num = NUMERIC[key];
    if (num) {
      await i.showModal(modal(`tk|n|${key}`, num.label, input("v", `${num.label} (${num.min}-${num.max})`, { value: String(cfg[num.field]), ph: num.hint, max: 7 })));
      return;
    }
    const txt = TEXTUAL[key];
    if (txt) {
      await i.showModal(
        modal(`tk|t|${key}`, txt.label, input("v", txt.label, { style: txt.long ? TextInputStyle.Paragraph : TextInputStyle.Short, required: txt.required, max: txt.max, value: cfg[txt.field] })),
      );
    }
    return;
  }

  if (act === "room" && i.isChannelSelectMenu()) {
    const id = i.values[0] ?? "";
    await TalkConfig.updateOne({ guildId }, { $set: { roomId: id } }, { upsert: true });
    await i.update({ content: id ? `✅ الغرفة: <#${id}>` : "✅ أُزيلت الغرفة.", components: [] });
    return;
  }
  if (act === "voice" && i.isStringSelectMenu()) {
    const v = getVoice(i.values[0]);
    await TalkConfig.updateOne({ guildId }, { $set: { voice: v.id } }, { upsert: true });
    await i.update({ content: `✅ الصوت: ${v.label}`, components: [] });
    return;
  }

  /* نماذج الأرقام والنصوص */
  if (act === "n" && i.isModalSubmit()) {
    const def = NUMERIC[arg];
    const n = toInt(i.fields.getTextInputValue("v"));
    if (!def || Number.isNaN(n) || n < def.min || n > def.max) return void (await i.reply({ content: `❌ أدخل رقمًا بين ${def?.min} و ${def?.max}.`, ...eph }));
    await TalkConfig.updateOne({ guildId }, { $set: { [def.field]: n } }, { upsert: true });
    await refresh(await buildPanel(guildId));
    return;
  }
  if (act === "t" && i.isModalSubmit()) {
    const def = TEXTUAL[arg];
    if (!def) return;
    const value = i.fields.getTextInputValue("v").trim();
    if (def.required && !value) return void (await i.reply({ content: "❌ لا يمكن تركه فارغًا.", ...eph }));
    await TalkConfig.updateOne({ guildId }, { $set: { [def.field]: value } }, { upsert: true });
    await refresh(await buildPanel(guildId));
    return;
  }

  /* أزرار اللوحة */
  if (act === "toggle" && i.isButton()) {
    const cfg = await getConfig(guildId);
    await TalkConfig.updateOne({ guildId }, { $set: { enabled: !cfg.enabled } });
    await i.update(await buildPanel(guildId));
    return;
  }
  if (act === "clear" && i.isButton()) {
    const r = await TalkMemory.deleteMany({ guildId });
    await i.reply({ content: `🧹 مسحنا ذاكرة ${r.deletedCount} عضو.`, ...eph });
    return;
  }

  /* شخصيات الأعضاء */
  if (act === "personas" && i.isButton()) return void (await i.reply({ ...(await buildPersonas(guildId)), ...eph }));
  if (act === "padd" && i.isButton()) {
    await i.showModal(
      modal(
        "tk|pm",
        "شخصية عضو",
        input("member", "العضو (منشن أو ID)", { ph: "@user أو 1234567890", max: 40 }),
        input("name", "الاسم الذي يناديه به (اختياري)", { required: false, max: 30 }),
        input("desc", "وصف يعرّف البوت به", { style: TextInputStyle.Paragraph, max: 400, ph: "مثال: صديق قديم، يحب الكرة، مزّاح" }),
      ),
    );
    return;
  }
  if (act === "pm" && i.isModalSubmit()) {
    const id = toDigits(i.fields.getTextInputValue("member"));
    const member = id ? await i.guild?.members.fetch(id).catch(() => null) : null;
    if (!member || member.user.bot) return void (await i.reply({ content: "❌ العضو غير موجود في السيرفر.", ...eph }));
    await TalkPersona.updateOne(
      { guildId, userId: id },
      { $set: { name: i.fields.getTextInputValue("name").trim(), description: i.fields.getTextInputValue("desc").trim() } },
      { upsert: true },
    );
    await refresh(await buildPersonas(guildId, `✅ حُفظت شخصية ${member.displayName}.`));
    return;
  }
  if (act === "pdel" && i.isButton()) {
    await i.showModal(modal("tk|pdm", "حذف شخصية", input("member", "العضو (منشن أو ID)", { max: 40 })));
    return;
  }
  if (act === "pdm" && i.isModalSubmit()) {
    const id = toDigits(i.fields.getTextInputValue("member"));
    const r = id ? await TalkPersona.deleteOne({ guildId, userId: id }) : { deletedCount: 0 };
    await refresh(await buildPersonas(guildId, r.deletedCount ? "🗑️ تم حذف الشخصية." : "ما لقيت شخصية لهذا العضو."));
  }
}
