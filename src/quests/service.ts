import type { MessageCreateOptions } from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";
import { CURRENCY, XP as XP_ICON } from "../constants";
import { DailyQuest } from "../database/models/DailyQuest";
import { grantReward } from "../services/economy";
import { logger } from "../utils/logger";
import { ALL_QUESTS_BONUS, QUESTS, QUEST_MAP, type QuestId } from "./definitions";
import { renderQuestCard } from "./render/card";
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
    titleEn: quest.titleEn,
    isBonus: false,
    icon: quest.id,
    cardTitle: quest.title,
    cardText: quest.description,
    coins: quest.coins,
    xp: quest.xp,
    level: result.level,
    leveledUp: result.leveledUp,
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
      titleEn: ALL_QUESTS_BONUS.titleEn,
      isBonus: true,
      icon: "trophy",
      cardTitle: "أكملت كل المهام اليومية",
      cardText: `أنجزت ${QUESTS.length} مهام في يوم واحد!`,
      coins: ALL_QUESTS_BONUS.coins,
      xp: ALL_QUESTS_BONUS.xp,
      level: bonus.level,
      leveledUp: bonus.leveledUp,
    });
  }
}

interface AnnounceOptions {
  userId: string;
  titleEn: string;
  isBonus: boolean;
  icon: QuestId | "trophy";
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
    const hall = await getHall(client);
    if (!hall) {
      logger.warn("قناة الانجازات (QUESTS_CHANNEL_ID) غير موجودة أو ما قدر البوت يوصلها");
      return;
    }

    const levelUp = o.leveledUp ? `  🆙 **LVL UP!** (Level **${o.level}**)` : "";

    const content = [
      `╭ ᗆ <a:8wi:1552740253780152370> <@${o.userId}> <a:8wii:1552740179016425512>`,
      `**-** **${o.isBonus ? "All daily tasks completed" : "Daily task completed"}**`,
      `➔ **Task:** **${o.titleEn}**`,
      `➔ **Thou art a pillar of 𝐒𝐩𝐡𝐚𝐞𝐫𝐚.** <a:RoT_BeLli_ok:1538222647471513754>`,
      `➔ **Fashioned for greatness.** <a:6nice:1527585495125590076>`,
      "",
      `➔ **Obtained:** **${CURRENCY.name}: **\`${o.coins}\` ${CURRENCY.emoji}  **| XP: **\`${o.xp}\` ${XP_ICON.emoji}${levelUp}`,
      "",
      "**Hall of Deeds & Decrees:**",
      `<#${hall.id}>`,
    ].join("\n");

    const noPing = { parse: [] as never[] };

    // بطاقة الإنجاز كصورة (ترجع null إذا الخط العربي غير مثبت بعد)
    const buffer = await renderQuestCard({
      title: o.cardTitle,
      description: o.cardText,
      coins: o.coins,
      xp: o.xp,
      icon: o.icon,
    }).catch((err) => {
      logger.error("فشل توليد صورة بطاقة المهمة", err);
      return null;
    });

    const files = buffer ? [{ attachment: buffer, name: "quest.png" }] : [];

    // كل شيء (النص + البطاقة) في قاعة الانجازات فقط
    await hall.send({ content, files, allowedMentions: noPing });
  } catch (err) {
    logger.error("فشل إرسال إعلان المهمة", err);
  }
}
