import { randomInt } from "node:crypto";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  type Message,
} from "discord.js";
import { transferWallet } from "../bank/service";
import { jenny, REWARDS } from "../constants";
import { UserProfile } from "../database/models/UserProfile";
import { getProfile, reward } from "../services/economy";
import { logger } from "../utils/logger";

/** "!عملة" ... كل التفاصيل بعدها نحللها بالكود */
export const COIN_TRIGGER = /^!\s*عملة(?:\s+([\s\S]+))?$/;

type Side = "head" | "tail";
const LABEL: Record<Side, string> = { head: "صورة", tail: "كتابة" };
const EMOJI: Record<Side, string> = { head: "🖼️", tail: "✍️" };
const MAX_BET = 1_000_000_000;

/** لاعبين مشغولين بتحدي جاري (يمنع فتح أكثر من تحدي بنفس الوقت) */
const busy = new Set<string>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const flip = (): Side => (randomInt(2) === 0 ? "head" : "tail");
const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

async function walletOf(userId: string, guildId: string): Promise<number> {
  const p = await UserProfile.findOne({ userId, guildId }, { coins: 1 }).lean().catch(() => null);
  return p?.coins ?? 0;
}

function sideRow(prefix: string, disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    (["head", "tail"] as Side[]).map((s) =>
      new ButtonBuilder()
        .setCustomId(`${prefix}|${s}`)
        .setLabel(LABEL[s])
        .setEmoji(EMOJI[s])
        .setStyle(ButtonStyle.Primary)
        .setDisabled(disabled),
    ),
  );
}

/** يرجع true إذا الرسالة أمر !عملة */
export async function handleCoinMessage(message: Message<true>): Promise<boolean> {
  const m = COIN_TRIGGER.exec(message.content.trim());
  if (!m) return false;

  const rest = toLatin(m[1] ?? "").trim();
  const mention = /<@!?(\d+)>/.exec(rest);

  if (mention) {
    await startDuel(message, mention[1], toLatin(rest.replace(mention[0], "")).replace(/[,،\s]/g, ""));
    return true;
  }
  await soloFlip(message, rest);
  return true;
}

// ───────────────────────── فردي ─────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function formatTimeLeft(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.ceil((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours} ساعة و${minutes} دقيقة` : `${minutes} دقيقة`;
}

/** لعبة فردية: مرة كل 24 ساعة، والفوز يعطي جائزة (نفس أمر coinflip القديم) */
async function playSolo(userId: string, guildId: string, guess: Side): Promise<string> {
  const threshold = new Date(Date.now() - DAY_MS);
  // نحجز الدور أول (ذري): يمنع اللعب مرتين بالضغط السريع، وتنحسب المحاولة ربح أو خسر
  const claimed = await UserProfile.findOneAndUpdate(
    { userId, guildId, $or: [{ lastCoinflipAt: { $exists: false } }, { lastCoinflipAt: { $lte: threshold } }] },
    { $set: { lastCoinflipAt: new Date() } },
    { upsert: true, new: true },
  ).catch(() => null);

  if (!claimed) {
    const profile = await getProfile(userId, guildId);
    const last = profile.lastCoinflipAt?.getTime() ?? Date.now();
    return `⏳ تقدر تلعب مرة ثانية بعد ${formatTimeLeft(Math.max(0, DAY_MS - (Date.now() - last)))}.`;
  }

  const result = flip();
  const won = guess === result;
  if (won) await reward(userId, guildId, REWARDS.coinflipWin, true);
  return `🪙 طلعت **${LABEL[result]}** ${EMOJI[result]}\n${won ? `🎉 ربحت ${jenny(REWARDS.coinflipWin)}!` : "😅 خسرت، جرب بكرة!"}`;
}

async function soloFlip(message: Message<true>, arg: string): Promise<void> {
  const direct: Side | null = /^صور[ةه]$/.test(arg) ? "head" : /^كتاب[ةه]$/.test(arg) ? "tail" : null;
  if (direct) {
    const text = await playSolo(message.author.id, message.guildId, direct);
    await message.reply({ content: text, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }

  const sent = await message
    .reply({
      content: "🪙 اختر: **صورة** أو **كتابة**؟ (مرة كل 24 ساعة)",
      components: [sideRow("coinsolo")],
      allowedMentions: { repliedUser: false },
    })
    .catch(() => null);
  if (!sent) return;

  const col = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30_000 });
  col.on("collect", async (i) => {
    if (i.user.id !== message.author.id) {
      await i.reply({ content: "🔒 هذا مو لك. اكتب `!عملة` لنفسك.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
      return;
    }
    col.stop("picked");
    const guess = i.customId.split("|")[1] as Side;
    const text = await playSolo(i.user.id, message.guildId, guess).catch((err) => {
      logger.error("فشل العملة الفردية", err);
      return "❌ حدث خطأ، حاول مرة ثانية.";
    });
    await i.update({ content: text, components: [] }).catch(() => undefined);
  });
  col.on("end", (_c, reason) => {
    if (reason === "time") void sent.edit({ content: "⌛ انتهى الوقت.", components: [] }).catch(() => undefined);
  });
}

// ───────────────────────── تحدي لاعبين ─────────────────────────

async function startDuel(message: Message<true>, targetId: string, amountStr: string): Promise<void> {
  const guildId = message.guildId;
  const authorId = message.author.id;
  const say = (content: string) =>
    message.reply({ content, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);

  const amount = Number(amountStr);
  if (!amountStr || !Number.isSafeInteger(amount) || amount < 1 || amount > MAX_BET) {
    await say("❌ الاستخدام: `!عملة @شخص مبلغ`\nأو `!عملة صورة` / `!عملة كتابة` للعب لحالك.");
    return;
  }
  if (targetId === authorId) {
    await say("😅 ما تقدر تتحدى نفسك.");
    return;
  }
  const target = await message.client.users.fetch(targetId).catch(() => null);
  if (!target || target.bot) {
    await say("❌ ما لقيت هذا العضو.");
    return;
  }
  if (busy.has(authorId) || busy.has(targetId)) {
    await say("⏳ أحدكم عنده تحدي عملة جاري.");
    return;
  }
  const [mine, theirs] = await Promise.all([walletOf(authorId, guildId), walletOf(targetId, guildId)]);
  if (mine < amount) {
    await say("❌ رصيد محفظتك ما يكفي لهذا المبلغ.");
    return;
  }
  if (theirs < amount) {
    await say(`❌ رصيد <@${targetId}> ما يكفي لهذا المبلغ.`);
    return;
  }

  busy.add(authorId);
  busy.add(targetId);
  const release = () => {
    busy.delete(authorId);
    busy.delete(targetId);
  };

  try {
    const players = [authorId, targetId];

    // 1) طلب التحدي
    const askRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("coin|yes").setLabel("قبول").setEmoji("🪙").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("coin|no").setLabel("رفض").setEmoji("❌").setStyle(ButtonStyle.Danger),
    );
    const sent = await message.channel.send({
      content: `🪙 <@${authorId}> يتحداك <@${targetId}> على **${jenny(amount)}**!\nوافق أو ارفض بالأسفل.`,
      components: [askRow],
      allowedMentions: { users: [targetId] },
    });

    const ask = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 });
    let started = false;

    ask.on("collect", async (i) => {
      const isTarget = i.user.id === targetId;
      const isAuthor = i.user.id === authorId;
      if (!isTarget && !(isAuthor && i.customId === "coin|no")) {
        await i.reply({ content: "🔒 هذا الطلب موجّه لشخص ثاني.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
        return;
      }
      if (i.customId === "coin|no") {
        ask.stop("declined");
        await i
          .update({ content: isAuthor ? "❌ تم إلغاء التحدي." : `💔 <@${targetId}> رفض التحدي.`, components: [], allowedMentions: { parse: [] } })
          .catch(() => undefined);
        return;
      }

      // قبول: نتأكد من الرصيد مرة ثانية
      const [a, b] = await Promise.all([walletOf(authorId, guildId), walletOf(targetId, guildId)]);
      if (a < amount || b < amount) {
        ask.stop("funds");
        await i.update({ content: "❌ أحدكم ما عاد يملك المبلغ، انلغى التحدي.", components: [] }).catch(() => undefined);
        return;
      }
      started = true;
      ask.stop("accepted");
      await i.deferUpdate().catch(() => undefined);
      await runPick(sent, authorId, targetId, amount, players).catch((err) => {
        logger.error("فشل تحدي العملة", err);
        release();
      });
    });

    ask.on("end", (_c, reason) => {
      if (reason === "time") void sent.edit({ content: "⌛ ما انقبل التحدي، انتهى الوقت.", components: [] }).catch(() => undefined);
      if (!started) release();
    });
  } catch (err) {
    logger.error("فشل بدء تحدي العملة", err);
    release();
  }
}

function pickEmbed(authorId: string, targetId: string, amount: number, picked: Set<string>): EmbedBuilder {
  const st = (id: string) => (picked.has(id) ? "✅ اختار" : "⏳ ينتظر");
  return new EmbedBuilder()
    .setColor(0xf5c542)
    .setTitle("🪙 تحدي العملة")
    .setDescription(
      [
        `المبلغ: **${jenny(amount)}**`,
        "",
        "اختاروا **صورة** أو **كتابة** بنفس الوقت. اللي تطلع عليه العملة يفوز!",
        "اختيارك يظهر لك بس، وإذا اخترتوا نفس الجهة يصير تعادل.",
        "",
        `<@${authorId}>: ${st(authorId)}`,
        `<@${targetId}>: ${st(targetId)}`,
      ].join("\n"),
    );
}

async function runPick(
  sent: Message<true>,
  authorId: string,
  targetId: string,
  amount: number,
  players: string[],
): Promise<void> {
  const release = () => {
    busy.delete(authorId);
    busy.delete(targetId);
  };
  const picks = new Map<string, Side>();
  const guildId = sent.guildId;

  await sent
    .edit({
      content: `<@${authorId}> <@${targetId}>`,
      embeds: [pickEmbed(authorId, targetId, amount, new Set())],
      components: [sideRow("coinpick")],
      allowedMentions: { users: players },
    })
    .catch(() => undefined);

  const col = sent.createMessageComponentCollector({ componentType: ComponentType.Button, time: 45_000 });

  col.on("collect", async (i) => {
    if (!players.includes(i.user.id)) {
      await i.reply({ content: "🔒 التحدي بين اللاعبين بس.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
      return;
    }
    if (picks.has(i.user.id)) {
      await i.reply({ content: "✋ اخترت من قبل.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
      return;
    }
    const side = i.customId.split("|")[1] as Side;
    picks.set(i.user.id, side);
    await i.reply({ content: `✅ اخترت **${LABEL[side]}** ${EMOJI[side]}`, flags: MessageFlags.Ephemeral }).catch(() => undefined);

    if (picks.size < 2) {
      await sent
        .edit({ embeds: [pickEmbed(authorId, targetId, amount, new Set(picks.keys()))] })
        .catch(() => undefined);
      return;
    }
    col.stop("done");
  });

  col.on("end", async (_c, reason) => {
    try {
      if (reason !== "done") {
        await sent.edit({ content: "⌛ انتهى الوقت ولا انخصم شي.", embeds: [], components: [] }).catch(() => undefined);
        return;
      }

      const a = picks.get(authorId)!;
      const b = picks.get(targetId)!;
      if (a === b) {
        await sent
          .edit({
            content: `🤝 تعادل! الاثنين اختاروا **${LABEL[a]}** ${EMOJI[a]}، ولا انخصم شي.`,
            embeds: [],
            components: [],
          })
          .catch(() => undefined);
        return;
      }

      await sent.edit({ content: "🪙 العملة تدور...", embeds: [], components: [] }).catch(() => undefined);
      await sleep(1800);

      const result = flip();
      const winnerId = a === result ? authorId : targetId;
      const loserId = winnerId === authorId ? targetId : authorId;

      const moved = await transferWallet(loserId, winnerId, guildId, amount).catch((err) => {
        logger.error("فشل تحويل مبلغ العملة", err);
        return { ok: false as const, reason: "error" as const };
      });

      if (!moved.ok) {
        await sent
          .edit({ content: `🪙 طلعت **${LABEL[result]}** ${EMOJI[result]}\n❌ بس تعذّر نقل المبلغ (رصيد <@${loserId}> ما يكفي).`, allowedMentions: { parse: [] } })
          .catch(() => undefined);
        return;
      }

      await sent
        .edit({
          content: [
            `🪙 طلعت **${LABEL[result]}** ${EMOJI[result]}`,
            `🎉 فاز <@${winnerId}> وكسب **${jenny(amount)}** من <@${loserId}>!`,
          ].join("\n"),
          allowedMentions: { parse: [] },
        })
        .catch(() => undefined);
    } finally {
      release();
    }
  });
}
