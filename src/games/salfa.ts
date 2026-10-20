import { randomInt } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Message,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from "discord.js";
import { reward } from "../services/economy";
import { logger } from "../utils/logger";
import { guideEmbed } from "./guides";
import { salfaBanner, vsCard } from "./salfa_img";

/** !سالفة → لعبة برا السالفة */
export const SALFA_TRIGGER = /^!\s*سالفة$/;

type Phase = "lobby" | "talk" | "vote" | "guess" | "over";
type Timer = ReturnType<typeof setTimeout>;
type Reply = ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction;

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 20;
const LOBBY_MS = 60_000;
const ASK_MS = 60_000;
const ANSWER_MS = 60_000;
const VOTE_MS = 60_000;
const GUESS_MS = 45_000;
/** أقل عدد لاعبين بعد الطرد عشان تكمل اللعبة */
const MIN_ACTIVE = 3;

/** المكافآت بالنقاط. لو عندك نظام نقاط عامة بدّل awardPoints تحت */
const POINTS = { outsider: 3, insider: 1 };
const COINS_PER_POINT = 100;

const COLOR = 0x9f1239;
const NO_PINGS = { parse: [] as never[] };

const ANIMALS = [
  "أسد", "نمر", "فيل", "زرافة", "قرد", "حمار وحشي", "دب", "ذئب", "ثعلب", "أرنب", "غزال", "جمل", "حصان", "بقرة", "خروف", "ماعز",
  "دجاجة", "ديك", "بطة", "إوزة", "نسر", "صقر", "بومة", "ببغاء", "طاووس", "بطريق", "دلفين", "حوت", "قرش", "أخطبوط", "سلحفاة",
  "تمساح", "ثعبان", "ضفدع", "فراشة", "نحلة", "نملة", "عقرب", "كنغر", "باندا", "وحيد القرن", "فرس النهر", "ضبع", "فهد", "قنفذ",
  "سنجاب", "خفاش", "لاما",
];

interface Salfa {
  id: string;
  channelId: string;
  guildId: string;
  hostId: string;
  phase: Phase;
  players: Set<string>;
  names: Map<string, string>;
  avatars: Map<string, string>;
  animal: string;
  outsider: string;
  votes: Map<string, string>;
  skip: Set<string>;
  queue: string[];
  round: number;
  total: number;
  asker: string;
  answerer: string;
  step: "ask" | "answer";
  question: string;
  log: { q: string; a: string }[];
  note: string;
  vsImg: Buffer | null;
  deadline: number;
  timer?: Timer;
  msg?: Message;
  updated: number;
}

let bannerImg: Buffer | null = null;
const games = new Map<string, Salfa>();
const byChannel = new Map<string, string>();

function drop(g: Salfa): void {
  if (g.timer) clearTimeout(g.timer);
  games.delete(g.id);
  if (byChannel.get(g.channelId) === g.id) byChannel.delete(g.channelId);
}

setInterval(() => {
  const now = Date.now();
  for (const g of [...games.values()]) if (now - g.updated > 60 * 60 * 1000) drop(g);
}, 10 * 60 * 1000).unref();

function arm(g: Salfa, ms: number, fn: () => void): void {
  if (g.timer) clearTimeout(g.timer);
  g.deadline = Date.now() + ms;
  g.timer = setTimeout(fn, ms);
}

const unix = (ms: number): number => Math.floor(ms / 1000);
const need = (g: Salfa): number => Math.floor(g.players.size / 2) + 1;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function btn(g: Salfa, action: string, label: string, style: ButtonStyle, emoji?: string, disabled = false): ButtonBuilder {
  const b = new ButtonBuilder().setCustomId(`sf|${g.id}|${action}`).setLabel(label).setStyle(style).setDisabled(disabled);
  if (emoji) b.setEmoji(emoji);
  return b;
}

type Row = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

function view(g: Salfa) {
  const embed = new EmbedBuilder().setColor(COLOR).setTitle("🕵️ برا السالفة");
  const list = [...g.players].map((p) => `<@${p}>`).join(" ") || "—";
  const rows: Row[] = [];
  const files: { attachment: Buffer; name: string }[] = [];

  if (g.phase === "lobby") {
    embed.setDescription(
      [
        `ستبدأ اللعبة <t:${unix(g.deadline)}:R> **(${g.players.size} / ${MAX_PLAYERS})**`,
        `الحد الأدنى للبدء: **${MIN_PLAYERS}** لاعبين`,
        "",
        `اللاعبون: ${list}`,
      ].join("\n"),
    );
    if (bannerImg) {
      files.push({ attachment: bannerImg, name: "salfa.png" });
      embed.setImage("attachment://salfa.png");
    }
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        btn(g, "join", "دخول", ButtonStyle.Secondary, "🚪"),
        btn(g, "leave", "خروج", ButtonStyle.Secondary, "↩️"),
        btn(g, "help", "الشرح", ButtonStyle.Secondary, "ℹ️"),
        btn(g, "start", "بدء", ButtonStyle.Primary, "▶️", g.players.size < MIN_PLAYERS),
      ),
    );
  } else if (g.phase === "talk") {
    const lines: string[] = [];
    if (g.note) lines.push(`⚠️ ${g.note}`, "");
    lines.push(`🎤 الجولة **${g.round} / ${g.total}** • اللاعبون: **${g.players.size}**`, `<@${g.asker}> اسأل <@${g.answerer}>`);
    if (g.step === "ask") {
      lines.push(`⏱️ الوقت: <t:${unix(g.deadline)}:R>`, "اضغط **السؤال** واكتب سؤالاً عن الحيوان بدون ما تكشفه.");
    } else {
      lines.push("", `**السؤال:** ${g.question}`, `⏳ في انتظار الإجابة من <@${g.answerer}> — <t:${unix(g.deadline)}:R>`);
    }
    embed.setDescription(lines.join("\n"));
    if (g.log.length) {
      embed.addFields({
        name: "آخر الأسئلة",
        value: g.log
          .slice(-2)
          .map((x) => `**س:** ${x.q}\n**ج:** ${x.a}`)
          .join("\n\n")
          .slice(0, 1000),
      });
    }
    if (g.vsImg) {
      files.push({ attachment: g.vsImg, name: "vs.png" });
      embed.setImage("attachment://vs.png");
    }
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        g.step === "ask" ? btn(g, "ask", "السؤال", ButtonStyle.Secondary, "❓") : btn(g, "answer", "الإجابة", ButtonStyle.Secondary, "💬"),
        btn(g, "role", "اعرف دورك", ButtonStyle.Primary, "🐾"),
        btn(g, "skip", `التصويت (${g.skip.size}/${need(g)})`, ButtonStyle.Secondary, "🗳️"),
        btn(g, "cancel", "إلغاء", ButtonStyle.Danger),
      ),
    );
  } else if (g.phase === "vote") {
    embed.setDescription(
      [
        "🗳️ صوّتوا على من تظنونه **برا السالفة** من القائمة.",
        `⏱️ ينتهي التصويت <t:${unix(g.deadline)}:R>`,
        `صوّت **${g.votes.size} / ${g.players.size}**`,
      ].join("\n"),
    );
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`sf|${g.id}|vote`)
          .setPlaceholder("اختر برا السالفة")
          .addOptions([...g.players].map((p) => ({ label: (g.names.get(p) ?? p).slice(0, 100), value: p }))),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(btn(g, "role", "اعرف دورك", ButtonStyle.Primary, "🐾")),
    );
  } else if (g.phase === "guess") {
    embed.setDescription(
      [
        `🎯 انكشف برا السالفة: <@${g.outsider}>`,
        "عنده فرصة أخيرة: لو خمّن الحيوان الصحيح يفوز بالجولة!",
        `⏱️ ينتهي الوقت <t:${unix(g.deadline)}:R>`,
      ].join("\n"),
    );
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(btn(g, "guess", "خمّن الحيوان", ButtonStyle.Success, "🐾")));
  }
  // attachments: [] يمسح الصور القديمة عند كل تحديث
  return { embeds: [embed], components: rows, files, attachments: [] as never[], allowedMentions: NO_PINGS };
}

async function push(g: Salfa): Promise<void> {
  await g.msg?.edit(view(g)).catch((err: unknown) => logger.error("سالفة: فشل تحديث الرسالة", err));
}

async function awardPoints(userId: string, guildId: string, points: number): Promise<void> {
  try {
    await reward(userId, guildId, points * COINS_PER_POINT, true);
  } catch (err) {
    logger.error("سالفة: فشل منح المكافأة", err);
  }
}

async function cancelGame(g: Salfa, text: string): Promise<void> {
  if (g.phase === "over") return;
  g.phase = "over";
  drop(g);
  const embed = new EmbedBuilder().setColor(0x64748b).setTitle("🕵️ برا السالفة").setDescription(text);
  await g.msg?.edit({ embeds: [embed], components: [], files: [], attachments: [], allowedMentions: NO_PINGS }).catch(() => undefined);
}

async function finishGame(g: Salfa, winner: "outsider" | "insiders", reason: string): Promise<void> {
  if (g.phase === "over") return;
  g.phase = "over";
  drop(g);

  const insiders = [...g.players].filter((p) => p !== g.outsider);
  const winners = winner === "outsider" ? [g.outsider] : insiders;
  const pts = winner === "outsider" ? POINTS.outsider : POINTS.insider;
  for (const w of winners) await awardPoints(w, g.guildId, pts);

  const embed = new EmbedBuilder()
    .setColor(winner === "outsider" ? 0xef4444 : 0x22c55e)
    .setTitle(winner === "outsider" ? "🕵️ فاز برا السالفة!" : "🎉 فاز داخل السالفة!")
    .setDescription(
      [
        reason,
        "",
        `🐾 الحيوان: **${g.animal}**`,
        `🕵️ برا السالفة: <@${g.outsider}>`,
        "",
        winner === "outsider"
          ? `🏆 <@${g.outsider}> +${POINTS.outsider} نقاط عامة`
          : `🏆 الفائزون: ${insiders.map((p) => `<@${p}>`).join(" ")} (+${POINTS.insider} نقطة عامة لكل فائز)`,
      ].join("\n"),
    );
  await g.msg?.edit({ embeds: [embed], components: [], files: [], attachments: [], allowedMentions: NO_PINGS }).catch(() => undefined);
}

/* ───────────── جولات الأسئلة ───────────── */

async function startTalk(g: Salfa): Promise<void> {
  const ids = [...g.players];
  g.outsider = ids[randomInt(ids.length)];
  g.animal = ANIMALS[randomInt(ANIMALS.length)];
  g.phase = "talk";
  g.skip.clear();
  g.queue = shuffle(ids);
  g.round = 0;
  g.total = Math.min(8, Math.max(3, ids.length));
  g.log = [];
  g.note = "";
  await nextRound(g);
}

async function nextRound(g: Salfa): Promise<void> {
  if (g.phase !== "talk") return;
  if (g.round >= g.total) {
    startVote(g);
    return;
  }
  while (g.queue.length && !g.players.has(g.queue[0])) g.queue.shift();
  if (!g.queue.length) g.queue = shuffle([...g.players]);
  g.round += 1;
  g.asker = g.queue.shift() as string;
  const others = [...g.players].filter((p) => p !== g.asker);
  g.answerer = others[randomInt(others.length)];
  g.step = "ask";
  g.question = "";
  g.vsImg = await vsCard(g.avatars.get(g.asker), g.avatars.get(g.answerer)).catch(() => null);
  arm(g, ASK_MS, () => void stepTimeout(g));
}

/** مهلة السؤال/الإجابة: يُطرد اللاعب المتأخر */
async function stepTimeout(g: Salfa): Promise<void> {
  if (g.phase !== "talk") return;
  await kick(g, g.step === "ask" ? g.asker : g.answerer);
}

async function kick(g: Salfa, uid: string): Promise<void> {
  g.players.delete(uid);
  g.skip.delete(uid);
  const role = uid === g.outsider ? "برا السالفة" : "داخل السالفة";
  const note = `تم طرد <@${uid}> من اللعبة لعدم تفاعله وكان هذا اللاعب ${role}`;
  if (uid === g.outsider) {
    await finishGame(g, "insiders", `${note}.`);
    return;
  }
  if (g.players.size < MIN_ACTIVE) {
    await finishGame(g, "outsider", `${note}\nانتهت اللعبة بسبب وجود لاعبين فقط.`);
    return;
  }
  g.note = note;
  await nextRound(g);
  await push(g);
}

function startVote(g: Salfa): void {
  g.phase = "vote";
  g.votes.clear();
  g.vsImg = null;
  g.note = "";
  arm(g, VOTE_MS, () => void resolveVotes(g));
}

async function resolveVotes(g: Salfa): Promise<void> {
  if (g.phase !== "vote") return;
  const tally = new Map<string, number>();
  for (const t of g.votes.values()) tally.set(t, (tally.get(t) ?? 0) + 1);
  let top = 0;
  let tops: string[] = [];
  for (const [id, n] of tally) {
    if (n > top) {
      top = n;
      tops = [id];
    } else if (n === top) tops.push(id);
  }

  if (tops.length === 1 && tops[0] === g.outsider) {
    g.phase = "guess";
    arm(g, GUESS_MS, () => void finishGame(g, "insiders", "انتهى وقت برا السالفة بدون تخمين."));
    await push(g);
    return;
  }
  const reason =
    tops.length === 0 ? "ما صوّت أحد، فنجا برا السالفة." : tops.length > 1 ? "تعادلت الأصوات، فنجا برا السالفة." : `صوّتوا على <@${tops[0]}> وهو بريء!`;
  await finishGame(g, "outsider", reason);
}

/* ───────────── الإنشاء والتفاعلات ───────────── */

const nameOf = (i: ButtonInteraction | StringSelectMenuInteraction): string =>
  i.member && "displayName" in i.member ? i.member.displayName : i.user.displayName;
const avatarOf = (u: { displayAvatarURL: (o: { extension: "png"; size: 256 }) => string }): string => u.displayAvatarURL({ extension: "png", size: 256 });

async function deny(i: Reply, content: string): Promise<true> {
  await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  return true;
}

export async function createSalfa(message: Message<true>): Promise<void> {
  const channelId = message.channelId;
  const existing = byChannel.get(channelId);
  if (existing && games.has(existing)) {
    await message.reply({ content: "فيه لعبة سالفة شغّالة في هذا الروم بالفعل.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  if (!bannerImg) bannerImg = await salfaBanner();

  const id = Math.random().toString(36).slice(2, 8);
  const g: Salfa = {
    id,
    channelId,
    guildId: message.guildId,
    hostId: message.author.id,
    phase: "lobby",
    players: new Set([message.author.id]),
    names: new Map([[message.author.id, message.member?.displayName ?? message.author.displayName]]),
    avatars: new Map([[message.author.id, avatarOf(message.author)]]),
    animal: "",
    outsider: "",
    votes: new Map(),
    skip: new Set(),
    queue: [],
    round: 0,
    total: 0,
    asker: "",
    answerer: "",
    step: "ask",
    question: "",
    log: [],
    note: "",
    vsImg: null,
    deadline: 0,
    updated: Date.now(),
  };
  games.set(id, g);
  byChannel.set(channelId, id);
  arm(g, LOBBY_MS, () => {
    void (async () => {
      if (g.phase !== "lobby") return;
      if (g.players.size >= MIN_PLAYERS) {
        await startTalk(g);
        await push(g);
      } else await cancelGame(g, `ما اكتمل العدد (الحد الأدنى ${MIN_PLAYERS} لاعبين)، انلغت اللعبة.`);
    })();
  });
  g.msg = (await message.channel.send(view(g)).catch((err: unknown) => {
    logger.error("سالفة: فشل إرسال اللوبي", err);
    return undefined;
  })) ?? undefined;
  if (!g.msg) drop(g);
}

export async function handleSalfaButton(interaction: ButtonInteraction): Promise<boolean> {
  const [, id, action] = interaction.customId.split("|");
  const g = games.get(id);
  if (!g) return deny(interaction, "انتهت هذه اللعبة.");
  const uid = interaction.user.id;
  g.updated = Date.now();

  switch (action) {
    case "join": {
      if (g.phase !== "lobby") return deny(interaction, "اللعبة بدأت بالفعل.");
      if (g.players.has(uid)) return deny(interaction, "أنت داخل اللعبة بالفعل.");
      if (g.players.size >= MAX_PLAYERS) return deny(interaction, "اللعبة ممتلئة.");
      g.players.add(uid);
      g.names.set(uid, nameOf(interaction));
      g.avatars.set(uid, avatarOf(interaction.user));
      if (g.players.size >= MAX_PLAYERS) {
        await interaction.deferUpdate().catch(() => undefined);
        await startTalk(g);
        await push(g);
        return true;
      }
      await interaction.update(view(g));
      return true;
    }

    case "leave": {
      if (g.phase !== "lobby") return deny(interaction, "ما تقدر تخرج بعد بدء اللعبة.");
      if (!g.players.has(uid)) return deny(interaction, "أنت مو داخل اللعبة.");
      g.players.delete(uid);
      if (g.players.size === 0) {
        await interaction.deferUpdate().catch(() => undefined);
        await cancelGame(g, "خرج كل اللاعبين، انلغت اللعبة.");
        return true;
      }
      if (uid === g.hostId) g.hostId = [...g.players][0];
      await interaction.update(view(g));
      return true;
    }

    case "start": {
      if (g.phase !== "lobby") return deny(interaction, "اللعبة بدأت بالفعل.");
      if (uid !== g.hostId) return deny(interaction, "اللي فتح اللعبة بس يقدر يبدأها.");
      if (g.players.size < MIN_PLAYERS) return deny(interaction, `تحتاج ${MIN_PLAYERS} لاعبين على الأقل.`);
      await interaction.deferUpdate().catch(() => undefined);
      await startTalk(g);
      await push(g);
      return true;
    }

    case "help": {
      await interaction.reply({ embeds: [guideEmbed("سالفة")], flags: MessageFlags.Ephemeral });
      return true;
    }

    case "role": {
      if (g.phase === "lobby") return deny(interaction, "اللعبة ما بدأت.");
      if (!g.players.has(uid)) return deny(interaction, "أنت مو من لاعبين هذي الجولة.");
      const text =
        uid === g.outsider
          ? "🕵️ أنت **برا السالفة**! ما تعرف الحيوان، تابع الأسئلة والأجوبة وحاول تعرفه."
          : `🐾 الحيوان هو: **${g.animal}**\nلا تكشفه لبرا السالفة!`;
      await interaction.reply({ content: text, flags: MessageFlags.Ephemeral });
      return true;
    }

    case "ask": {
      if (g.phase !== "talk" || g.step !== "ask") return deny(interaction, "مو وقت السؤال.");
      if (uid !== g.asker) return deny(interaction, "السؤال للاعب اللي عليه الدور بس.");
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`sf|${g.id}|askm`)
          .setTitle("اكتب سؤالك")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder().setCustomId("q").setLabel("سؤالك عن الحيوان (بدون كشفه)").setStyle(TextInputStyle.Short).setMaxLength(150).setRequired(true),
            ),
          ),
      );
      return true;
    }

    case "answer": {
      if (g.phase !== "talk" || g.step !== "answer") return deny(interaction, "مو وقت الإجابة.");
      if (uid !== g.answerer) return deny(interaction, "الإجابة للاعب المسؤول بس.");
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`sf|${g.id}|ansm`)
          .setTitle("اكتب إجابتك")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder().setCustomId("a").setLabel("إجابتك").setStyle(TextInputStyle.Short).setMaxLength(200).setRequired(true),
            ),
          ),
      );
      return true;
    }

    case "skip": {
      if (g.phase !== "talk") return deny(interaction, "مو وقت النقاش.");
      if (!g.players.has(uid)) return deny(interaction, "أنت مو من لاعبين هذي الجولة.");
      if (g.skip.has(uid)) g.skip.delete(uid);
      else g.skip.add(uid);
      if (g.skip.size >= need(g)) startVote(g);
      await interaction.update(view(g));
      return true;
    }

    case "cancel": {
      if (uid !== g.hostId) return deny(interaction, "اللي فتح اللعبة بس يقدر يلغيها.");
      await interaction.deferUpdate().catch(() => undefined);
      await cancelGame(g, "تم إلغاء اللعبة.");
      return true;
    }

    case "guess": {
      if (g.phase !== "guess") return deny(interaction, "مو وقت التخمين.");
      if (uid !== g.outsider) return deny(interaction, "هذا الزر لبرا السالفة فقط.");
      const others = shuffle(ANIMALS.filter((a) => a !== g.animal)).slice(0, 24);
      const options = shuffle([...others, g.animal]).map((a) => ({ label: a, value: a }));
      await interaction.reply({
        content: "🐾 اختر الحيوان اللي تظنه:",
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId(`sf|${g.id}|pick`).setPlaceholder("خمّن الحيوان").addOptions(options),
          ),
        ],
      });
      return true;
    }
  }
  return false;
}

export async function handleSalfaModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const [, id, action] = interaction.customId.split("|");
  const g = games.get(id);
  if (!g) return deny(interaction, "انتهت هذه اللعبة.");
  const uid = interaction.user.id;
  g.updated = Date.now();

  if (action === "askm") {
    if (g.phase !== "talk" || g.step !== "ask" || uid !== g.asker) return deny(interaction, "مو دورك تسأل.");
    const q = interaction.fields.getTextInputValue("q").trim();
    if (!q) return deny(interaction, "اكتب سؤالاً.");
    g.question = q;
    g.step = "answer";
    arm(g, ANSWER_MS, () => void stepTimeout(g));
    if (interaction.isFromMessage()) await interaction.update(view(g));
    else {
      await interaction.reply({ content: "تم إرسال سؤالك.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
      await push(g);
    }
    return true;
  }

  if (action === "ansm") {
    if (g.phase !== "talk" || g.step !== "answer" || uid !== g.answerer) return deny(interaction, "مو دورك تجاوب.");
    const a = interaction.fields.getTextInputValue("a").trim();
    if (!a) return deny(interaction, "اكتب إجابة.");
    if (interaction.isFromMessage()) await interaction.deferUpdate().catch(() => undefined);
    else await interaction.reply({ content: "تم إرسال إجابتك.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    g.log.push({ q: g.question, a });
    if (g.log.length > 10) g.log.shift();
    g.note = "";
    g.question = "";
    await nextRound(g);
    await push(g);
    return true;
  }
  return false;
}

export async function handleSalfaSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const [, id, action] = interaction.customId.split("|");
  const g = games.get(id);
  if (!g) return deny(interaction, "انتهت هذه اللعبة.");
  const uid = interaction.user.id;
  const value = interaction.values[0];
  g.updated = Date.now();

  if (action === "vote") {
    if (g.phase !== "vote") return deny(interaction, "انتهى التصويت.");
    if (!g.players.has(uid)) return deny(interaction, "أنت مو من لاعبين هذي الجولة.");
    if (!g.players.has(value)) return deny(interaction, "هذا اللاعب مو داخل اللعبة.");
    if (value === uid) return deny(interaction, "ما تقدر تصوّت على نفسك.");
    g.votes.set(uid, value);
    await interaction.reply({ content: `✅ صوّتّ على <@${value}> (تقدر تغيّر صوتك قبل انتهاء الوقت).`, flags: MessageFlags.Ephemeral, allowedMentions: NO_PINGS });
    if (g.votes.size >= g.players.size) await resolveVotes(g);
    else await push(g);
    return true;
  }

  if (action === "pick") {
    if (g.phase !== "guess") return deny(interaction, "انتهى وقت التخمين.");
    if (uid !== g.outsider) return deny(interaction, "التخمين لبرا السالفة فقط.");
    const correct = value === g.animal;
    await interaction.update({ content: correct ? `✅ خمّنت **${value}** وهو صحيح!` : `❌ خمّنت **${value}** وهو خطأ.`, components: [] });
    await finishGame(
      g,
      correct ? "outsider" : "insiders",
      correct ? `انكشف برا السالفة لكنه خمّن الحيوان الصحيح (**${value}**)!` : `انكشف برا السالفة وخمّن **${value}** وأخطأ.`,
    );
    return true;
  }
  return false;
}
