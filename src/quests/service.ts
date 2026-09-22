import { EmbedBuilder, type MessageCreateOptions } from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";
import { CURRENCY, jenny } from "../constants";
import { DailyQuest } from "../database/models/DailyQuest";
import { grantReward } from "../services/economy";
import { logger } from "../utils/logger";
import { ALL_QUESTS_BONUS, QUESTS, QUEST_MAP, pickFlavor, type QuestId } from "./definitions";
import { todayKey } from "./time";

/** أي قناة نقدر نرسل فيها رسائل */
export interface Announcer {
  id: string;
  send(options: MessageCreateOptions): Promise<unknown>;
}

export function toAnnouncer(channel: unknown): Announcer | null {
  if (channel && typeof channel === "object" && "send" in channel && "id" in channel) {
    return channel as Announcer;
  }
  return null;
}

// كاش: مهام اكتملت اليوم، نتجنب بها استعلامات قاعدة البيانات مع كل رسالة
const finished = new Set<string>();

interface ProgressOptions {
  guildId: string;
  userId: string;
  questId: QuestId;
  amount?: number;
  /** القناة اللي صار فيها الحدث (للإعلان). null = مثل الصوت */
  channel?: Announcer | null;
}

/** يزيد تقدم مهمة، وإذا اكتملت يعطي المكافأة ويعلن الإنجاز */
export async function progressQuest(client: BotClient, opts: ProgressOptions): Promise<void> {
  const { guildId, userId, questId } = opts;
  const amount = opts.amount ?? 1;
  const quest = QUEST_MAP[questId];
  const dateKey = todayKey();

  const cacheKey = `${dateKey}:${guildId}:${userId}:${questId}`;
  if (finished.has(cacheKey)) return;
  if (finished.size > 50_000) finished.clear();

  // نحاول مرتين: خطأ التكرار (11000) قد يحدث من سباق إنشاء الوثيقة أو لأن المهمة مكتملة
  let doc = null;
  let alreadyDone = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      doc = await DailyQuest.findOneAndUpdate(
        { guildId, userId, dateKey, completed: { $ne: questId } },
        { $inc: { [`progress.${questId}`]: amount } as Record<string, number> },
        { upsert: true, new: true },
      );
      alreadyDone = false;
      break;
    } catch (err) {
      if ((err as { code?: number }).code !== 11000) throw err;
      alreadyDone = true;
    }
  }

  if (alreadyDone || !doc) {
    finished.add(cacheKey);
    return;
  }

  const value = doc.progress?.[questId] ?? 0;
  if (value < quest.target) return;

  // تعليم المهمة كمكتملة بشكل ذري: أول واحد ينجح فقط ياخذ المكافأة
  const marked = await DailyQuest.findOneAndUpdate(
    { _id: doc._id, completed: { $ne: questId } },
    { $addToSet: { completed: questId } },
    { new: true },
  );
  finished.add(cacheKey);
  if (!marked) return;

  const result = await grantReward(userId, guildId, quest.coins, quest.xp);
  await announce(client, {
    userId,
    origin: opts.channel ?? null,
    header: "اتممت مهمة يومية",
    lineTitle: `✥ **المهمة:** ${quest.title}`,
    cardTitle: `${quest.icon} ${quest.title}`,
    cardText: quest.description,
    coins: quest.coins,
    xp: quest.xp,
    ...result,
  });

  // مكافأة إكمال كل المهام
  const doneCount = marked.completed.filter((id) => id !== "all").length;
  if (doneCount >= QUESTS.length) {
    const bonusDoc = await DailyQuest.findOneAndUpdate(
      { _id: doc._id, completed: { $ne: "all" } },
      { $addToSet: { completed: "all" } },
      { new: true },
    );
    if (!bonusDoc) return;

    const bonus = await grantReward(userId, guildId, ALL_QUESTS_BONUS.coins, ALL_QUESTS_BONUS.xp);
    await announce(client, {
      userId,
      origin: opts.channel ?? null,
      header: "أكملت **جميع المهام اليومية** 🎉",
      lineTitle: "✥ **المكافأة الكبرى**",
      cardTitle: "🏆 أكملت كل المهام اليومية",
      cardText: `أنجزت ${QUESTS.length} مهام في يوم واحد!`,
      coins: ALL_QUESTS_BONUS.coins,
      xp: ALL_QUESTS_BONUS.xp,
      ...bonus,
    });
  }
}

interface AnnounceOptions {
  userId: string;
  origin: Announcer | null;
  header: string;
  lineTitle: string;
  cardTitle: string;
  cardText: string;
  coins: number;
  xp: number;
  level: number;
  leveledUp: boolean;
}

async function getHall(client: BotClient): Promise<Announcer | null> {
  if (!config.questsChannelId) return null;
  const channel = await client.channels.fetch(config.questsChannelId).catch(() => null);
  return toAnnouncer(channel);
}

async function announce(client: BotClient, o: AnnounceOptions): Promise<void> {
  try {
    const user = await client.users.fetch(o.userId).catch(() => null);
    const hall = await getHall(client);

    const rewardLine =
      `${CURRENCY.name}: ${jenny(o.coins)} | XP: **${o.xp}**` +
      (o.leveledUp ? `  🆙 **LVL UP!** (المستوى **${o.level}**)` : "");

    const content = [
      `✶ <@${o.userId}> ${o.header}`,
      o.lineTitle,
      ...pickFlavor().map((l) => `• ${l}`),
      "",
      "• **حصلت على:**",
      rewardLine,
    ].join("\n");

    const card = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(o.cardTitle)
      .setDescription(o.cardText)
      .addFields(
        { name: CURRENCY.name, value: `${CURRENCY.emoji} **${o.coins}**`, inline: true },
        { name: "XP", value: `✨ **${o.xp}**`, inline: true },
      )
      .setFooter({ text: "اكتملت بنجاح ✅" })
      .setTimestamp();
    if (user) card.setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL() });

    const noPing = { parse: [] as never[] };

    if (o.origin && hall && o.origin.id !== hall.id) {
      // النص في الشات، والبطاقة في قاعة الانجازات
      await o.origin.send({
        content: `${content}\n\n✶ قاعة الانجازات والمهام والاشعارات:\n<#${hall.id}>`,
        allowedMentions: noPing,
      });
      await hall.send({ embeds: [card], allowedMentions: noPing });
      return;
    }

    const target = o.origin ?? hall;
    if (target) await target.send({ content, embeds: [card], allowedMentions: noPing });
  } catch (err) {
    logger.error("فشل إرسال إعلان المهمة", err);
  }
}
