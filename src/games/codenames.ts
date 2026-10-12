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
  type Message,
  type ModalSubmitInteraction,
} from "discord.js";
import { logger } from "../utils/logger";
import { WORDS } from "./words";

type Team = "red" | "blue";
type Role = "spy" | "guess";
type Kind = Team | "neutral" | "assassin";
type Over = { winner: Team; reason: string } | { cancelled: true };

interface Card {
  word: string;
  kind: Kind;
  revealed: boolean;
}

interface Player {
  team: Team;
  role: Role;
}

interface Game {
  id: string;
  channelId: string;
  hostId: string;
  phase: "lobby" | "play" | "over";
  players: Map<string, Player>;
  cards: Card[];
  starting: Team;
  turn: Team;
  step: "clue" | "guess";
  clue?: { word: string; num: number };
  guessesLeft: number;
  statusMsg?: Message;
  boardMsg?: Message;
  updated: number;
}

const games = new Map<string, Game>();
const byChannel = new Map<string, string>();

const TEAM_NAME: Record<Team, string> = { red: "الفريق الأحمر", blue: "الفريق الأزرق" };
const TEAM_SQUARE: Record<Team, string> = { red: "🟥", blue: "🟦" };
const TEAM_COLOR: Record<Team, number> = { red: 0xef4444, blue: 0x3b82f6 };
const other = (t: Team): Team => (t === "red" ? "blue" : "red");
const NO_PINGS = { parse: [] as never[] };

function drop(g: Game): void {
  games.delete(g.id);
  if (byChannel.get(g.channelId) === g.id) byChannel.delete(g.channelId);
}

/** ينظّف الألعاب الخاملة (ساعة بدون نشاط) */
setInterval(() => {
  const now = Date.now();
  for (const g of [...games.values()]) if (now - g.updated > 60 * 60 * 1000) drop(g);
}, 10 * 60 * 1000).unref();

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 25 بطاقة: 9 للفريق الأول، 8 للثاني، 7 محايدة، 1 قاتل */
function buildCards(starting: Team): Card[] {
  const kinds: Kind[] = [
    ...Array<Kind>(9).fill(starting),
    ...Array<Kind>(8).fill(other(starting)),
    ...Array<Kind>(7).fill("neutral"),
    "assassin",
  ];
  const words = shuffle([...new Set(WORDS)]).slice(0, 25);
  const k = shuffle(kinds);
  return words.map((word, i) => ({ word, kind: k[i], revealed: false }));
}

const remaining = (g: Game, t: Team): number => g.cards.filter((c) => c.kind === t && !c.revealed).length;

function members(g: Game, team: Team, role: Role): string[] {
  return [...g.players.entries()].filter(([, p]) => p.team === team && p.role === role).map(([id]) => `<@${id}>`);
}

// ───────────────────────── الواجهات ─────────────────────────

function lobbyView(g: Game) {
  const field = (team: Team) => {
    const spy = members(g, team, "spy");
    const guess = members(g, team, "guess");
    return [`القائد: ${spy.length ? spy.join(" ") : "—"}`, `المخمنون: ${guess.length ? guess.join(" ") : "—"}`].join("\n");
  };

  const embed = new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("Code Names")
    .setDescription(
      [
        `المضيف: <@${g.hostId}>`,
        "",
        "اختر فريقك ودورك بالأزرار. كل فريق يحتاج **قائداً** و**مخمناً** على الأقل.",
        "القائد يشوف ألوان البطاقات سراً ويعطي تلميحاً من كلمة وحدة ورقم، والمخمنون يختارون الكلمات.",
      ].join("\n"),
    )
    .addFields(
      { name: `${TEAM_SQUARE.red} ${TEAM_NAME.red}`, value: field("red"), inline: true },
      { name: `${TEAM_SQUARE.blue} ${TEAM_NAME.blue}`, value: field("blue"), inline: true },
    );

  const id = g.id;
  const rows = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`cn|${id}|j|red-spy`).setLabel("قائد الأحمر").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`cn|${id}|j|red-guess`).setLabel("مخمن الأحمر").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`cn|${id}|j|blue-spy`).setLabel("قائد الأزرق").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`cn|${id}|j|blue-guess`).setLabel("مخمن الأزرق").setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`cn|${id}|leave`).setLabel("انسحاب").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`cn|${id}|start`).setLabel("بدء اللعبة").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`cn|${id}|cancel`).setLabel("إلغاء").setStyle(ButtonStyle.Secondary),
    ),
  ];
  return { embeds: [embed], components: rows, allowedMentions: NO_PINGS };
}

/** لوحة 5×5 عامة: كل البطاقات رمادية حتى تنكشف */
function boardView(g: Game, revealAll = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let r = 0; r < 5; r++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let c = 0; c < 5; c++) {
      const i = r * 5 + c;
      const card = g.cards[i];
      const btn = new ButtonBuilder().setCustomId(`cn|${g.id}|g|${i}`).setLabel(card.word.slice(0, 80));
      if (card.revealed || revealAll) {
        btn.setDisabled(true);
        if (card.kind === "red") btn.setStyle(ButtonStyle.Danger);
        else if (card.kind === "blue") btn.setStyle(ButtonStyle.Primary);
        else if (card.kind === "assassin") btn.setStyle(ButtonStyle.Secondary).setEmoji("💀");
        else btn.setStyle(ButtonStyle.Secondary);
      } else {
        btn.setStyle(ButtonStyle.Secondary);
      }
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return { components: rows };
}

function statusView(g: Game, over?: Over) {
  const embed = new EmbedBuilder().setTitle("Code Names");

  const teamField = (t: Team) =>
    [`باقي: **${remaining(g, t)}** بطاقة`, `القائد: ${members(g, t, "spy").join(" ") || "—"}`, `المخمنون: ${members(g, t, "guess").join(" ") || "—"}`].join("\n");
  embed.addFields(
    { name: `${TEAM_SQUARE.red} ${TEAM_NAME.red}`, value: teamField("red"), inline: true },
    { name: `${TEAM_SQUARE.blue} ${TEAM_NAME.blue}`, value: teamField("blue"), inline: true },
  );

  if (over && "cancelled" in over) {
    embed.setColor(0x64748b).setDescription("تم إلغاء اللعبة.");
    return { embeds: [embed], components: [], allowedMentions: NO_PINGS };
  }
  if (over) {
    embed
      .setColor(TEAM_COLOR[over.winner])
      .setDescription(`${TEAM_SQUARE[over.winner]} **فاز ${TEAM_NAME[over.winner]}!**\n${over.reason}`);
    return { embeds: [embed], components: [], allowedMentions: NO_PINGS };
  }

  const spy = members(g, g.turn, "spy")[0];
  const state =
    g.step === "clue"
      ? `بانتظار تلميح القائد ${spy}`
      : `التلميح: **${g.clue?.word}** — **${g.clue?.num}**\nالتخمينات المتبقية: **${g.guessesLeft}**`;

  embed
    .setColor(TEAM_COLOR[g.turn])
    .setDescription([`الدور: ${TEAM_SQUARE[g.turn]} **${TEAM_NAME[g.turn]}**`, state, "", `الفريق الأول (9 بطاقات): ${TEAM_NAME[g.starting]}`].join("\n"));

  const id = g.id;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`cn|${id}|key`).setLabel("الخريطة السرية").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`cn|${id}|clue`).setLabel("إعطاء تلميح").setStyle(ButtonStyle.Primary).setDisabled(g.step !== "clue"),
    new ButtonBuilder().setCustomId(`cn|${id}|end`).setLabel("إنهاء الدور").setStyle(ButtonStyle.Secondary).setDisabled(g.step !== "guess"),
    new ButtonBuilder().setCustomId(`cn|${id}|cancel`).setLabel("إلغاء اللعبة").setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [row], allowedMentions: NO_PINGS };
}

/** الخريطة السرية: تظهر للقائد فقط (رد مخفي) */
function secretMap(g: Game, team: Team): EmbedBuilder {
  const sq: Record<Kind, string> = { red: "🟥", blue: "🟦", neutral: "⬜", assassin: "💀" };
  const lines: string[] = [];
  for (let r = 0; r < 5; r++) {
    const cells = g.cards.slice(r * 5, r * 5 + 5).map((c) => `${sq[c.kind]} ${c.revealed ? `~~${c.word}~~` : c.word}`);
    lines.push(cells.join("   "));
  }
  return new EmbedBuilder()
    .setColor(TEAM_COLOR[team])
    .setTitle("الخريطة السرية")
    .setDescription(["🟥 أحمر   🟦 أزرق   ⬜ محايد   💀 القاتل", "", ...lines, "", "لا تُري هذه الخريطة لأحد."].join("\n"));
}

// ───────────────────────── المنطق ─────────────────────────

export async function createLobby(interaction: ButtonInteraction): Promise<void> {
  const channelId = interaction.channelId;
  const existing = byChannel.get(channelId);
  if (existing && games.has(existing)) {
    await interaction.reply({ content: "فيه لعبة Code Names شغّالة في هذا الروم بالفعل.", flags: MessageFlags.Ephemeral });
    return;
  }

  const id = Math.random().toString(36).slice(2, 8);
  const g: Game = {
    id,
    channelId,
    hostId: interaction.user.id,
    phase: "lobby",
    players: new Map(),
    cards: [],
    starting: "red",
    turn: "red",
    step: "clue",
    guessesLeft: 0,
    updated: Date.now(),
  };
  games.set(id, g);
  byChannel.set(channelId, id);
  await interaction.reply(lobbyView(g));
}

function finish(g: Game, over: Over) {
  g.phase = "over";
  drop(g);
  return statusView(g, over);
}

function switchTurn(g: Game): void {
  g.turn = other(g.turn);
  g.step = "clue";
  g.clue = undefined;
  g.guessesLeft = 0;
}

async function refreshStatus(g: Game, view: ReturnType<typeof statusView>): Promise<void> {
  await g.statusMsg?.edit(view).catch((err: unknown) => logger.error("Code Names: فشل تحديث الحالة", err));
}

async function deny(i: ButtonInteraction | ModalSubmitInteraction, content: string): Promise<true> {
  await i.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
  return true;
}

export async function handleCodenamesButton(interaction: ButtonInteraction): Promise<boolean> {
  const [, id, action, arg = ""] = interaction.customId.split("|");
  const g = games.get(id);
  if (!g) return deny(interaction, "انتهت هذه اللعبة.");

  const uid = interaction.user.id;
  const me = g.players.get(uid);
  g.updated = Date.now();

  switch (action) {
    case "j": {
      if (g.phase !== "lobby") return deny(interaction, "اللعبة بدأت بالفعل.");
      const [team, role] = arg.split("-") as [Team, Role];
      if (role === "spy") {
        const taken = [...g.players.entries()].find(([pid, p]) => p.team === team && p.role === "spy" && pid !== uid);
        if (taken) return deny(interaction, `قائد ${TEAM_NAME[team]} محجوز بالفعل.`);
      }
      g.players.set(uid, { team, role });
      await interaction.update(lobbyView(g));
      return true;
    }

    case "leave": {
      if (g.phase !== "lobby") return deny(interaction, "ما تقدر تنسحب بعد بدء اللعبة.");
      g.players.delete(uid);
      await interaction.update(lobbyView(g));
      return true;
    }

    case "start": {
      if (g.phase !== "lobby") return deny(interaction, "اللعبة بدأت بالفعل.");
      if (uid !== g.hostId) return deny(interaction, "المضيف فقط يقدر يبدأ اللعبة.");
      for (const t of ["red", "blue"] as Team[]) {
        if (members(g, t, "spy").length < 1 || members(g, t, "guess").length < 1) {
          return deny(interaction, `${TEAM_NAME[t]} يحتاج قائداً ومخمناً واحداً على الأقل.`);
        }
      }
      g.starting = Math.random() < 0.5 ? "red" : "blue";
      g.turn = g.starting;
      g.step = "clue";
      g.cards = buildCards(g.starting);
      g.phase = "play";
      g.statusMsg = interaction.message;
      await interaction.update(statusView(g));
      const ch = interaction.channel;
      if (ch && "send" in ch) {
        g.boardMsg = await ch.send(boardView(g)).catch((err: unknown) => {
          logger.error("Code Names: فشل إرسال اللوحة", err);
          return undefined;
        });
      }
      return true;
    }

    case "cancel": {
      if (uid !== g.hostId) return deny(interaction, "المضيف فقط يقدر يلغي اللعبة.");
      const board = g.boardMsg;
      await interaction.update(finish(g, { cancelled: true }));
      await board?.delete().catch(() => undefined);
      return true;
    }

    case "key": {
      if (g.phase !== "play") return deny(interaction, "اللعبة ما بدأت.");
      if (!me || me.role !== "spy") return deny(interaction, "الخريطة السرية للقادة فقط.");
      await interaction.reply({ embeds: [secretMap(g, me.team)], flags: MessageFlags.Ephemeral });
      return true;
    }

    case "clue": {
      if (g.phase !== "play" || g.step !== "clue") return deny(interaction, "مو وقت التلميح.");
      if (!me || me.role !== "spy" || me.team !== g.turn) return deny(interaction, "التلميح لقائد الفريق صاحب الدور فقط.");
      const modal = new ModalBuilder()
        .setCustomId(`cn|${g.id}|clue_modal`)
        .setTitle("إعطاء تلميح")
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("word").setLabel("التلميح (كلمة وحدة)").setStyle(TextInputStyle.Short).setMaxLength(25).setRequired(true),
          ),
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId("num").setLabel("كم كلمة تقصد؟ (1 إلى 9)").setStyle(TextInputStyle.Short).setMaxLength(1).setRequired(true),
          ),
        );
      await interaction.showModal(modal);
      return true;
    }

    case "end": {
      if (g.phase !== "play" || g.step !== "guess") return deny(interaction, "مو وقت التخمين.");
      if (!me || me.role !== "guess" || me.team !== g.turn) return deny(interaction, "المخمنون في الفريق صاحب الدور فقط.");
      switchTurn(g);
      await interaction.update(statusView(g));
      return true;
    }

    case "g": {
      if (g.phase !== "play") return deny(interaction, "اللعبة ما بدأت.");
      if (g.step !== "guess") return deny(interaction, "لازم القائد يعطي تلميح أول.");
      if (!me || me.role !== "guess" || me.team !== g.turn) return deny(interaction, "التخمين للمخمنين في الفريق صاحب الدور فقط.");
      const card = g.cards[Number(arg)];
      if (!card || card.revealed) return deny(interaction, "هذي البطاقة انكشفت.");

      card.revealed = true;
      const team = g.turn;
      let over: Over | null = null;

      if (card.kind === "assassin") {
        over = { winner: other(team), reason: `${TEAM_NAME[team]} اختار القاتل المأجور (${card.word}).` };
      } else if (card.kind === team) {
        g.guessesLeft -= 1;
        if (remaining(g, team) === 0) over = { winner: team, reason: "كشفوا كل بطاقاتهم." };
        else if (g.guessesLeft <= 0) switchTurn(g);
      } else if (card.kind === other(team)) {
        if (remaining(g, other(team)) === 0) over = { winner: other(team), reason: `${TEAM_NAME[team]} كشف آخر بطاقة للخصم.` };
        else switchTurn(g);
      } else {
        switchTurn(g);
      }

      if (over) {
        await interaction.update(boardView(g, true));
        await refreshStatus(g, finish(g, over));
      } else {
        await interaction.update(boardView(g));
        await refreshStatus(g, statusView(g));
      }
      return true;
    }
  }
  return false;
}

export async function handleCodenamesModal(interaction: ModalSubmitInteraction): Promise<boolean> {
  const [, id, action] = interaction.customId.split("|");
  if (action !== "clue_modal") return false;

  const g = games.get(id);
  if (!g || g.phase !== "play") return deny(interaction, "انتهت هذه اللعبة.");
  const me = g.players.get(interaction.user.id);
  if (g.step !== "clue" || !me || me.role !== "spy" || me.team !== g.turn) return deny(interaction, "مو دورك تعطي تلميح.");

  const word = interaction.fields.getTextInputValue("word").trim();
  const num = Number(interaction.fields.getTextInputValue("num").trim());

  if (!word || /\s/.test(word)) return deny(interaction, "التلميح لازم يكون كلمة وحدة بدون مسافات.");
  if (!Number.isInteger(num) || num < 1 || num > 9) return deny(interaction, "الرقم لازم يكون من 1 إلى 9.");
  if (g.cards.some((c) => !c.revealed && (c.word === word || c.word.includes(word) || word.includes(c.word)))) {
    return deny(interaction, "ما يصير التلميح يكون من كلمات اللوحة.");
  }

  g.updated = Date.now();
  g.clue = { word, num };
  g.guessesLeft = num + 1;
  g.step = "guess";

  if (interaction.isFromMessage()) {
    await interaction.update(statusView(g));
  } else {
    await interaction.reply({ content: "تم إرسال تلميحك.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    await refreshStatus(g, statusView(g));
  }
  return true;
}
