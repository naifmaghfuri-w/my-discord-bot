import { EmbedBuilder } from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";
import { CURRENCY, jenny, xp as xpText } from "../constants";
import { WeeklyQuest } from "../database/models/WeeklyQuest";
import { grantReward } from "../services/economy";
import { logger } from "../utils/logger";
import type { QuestId } from "./definitions";
import type { Announcer } from "./service";
import { toAnnouncer } from "./service";
import { WEEKLY_QUEST_MAP } from "./weekly";
import { weekKey } from "./weeklyTime";

const finished = new Set<string>();

interface WeeklyProgressOptions {
  guildId: string;
  userId: string;
  questId: QuestId;
  amount?: number;
}

/** يزيد تقدم مهمة أسبوعية إن كانت موجودة بقائمة WEEKLY_QUESTS، ويعلن عند الإكمال */
export async function progressWeeklyQuest(client: BotClient, opts: WeeklyProgressOptions): Promise<void> {
  const quest = WEEKLY_QUEST_MAP[opts.questId];
  if (!quest) return; // هذا النوع ما له مهمة أسبوعية

  const { guildId, userId } = opts;
  const amount = opts.amount ?? 1;
  const wKey = weekKey();

  const cacheKey = `${wKey}:${guildId}:${userId}:${quest.id}`;
  if (finished.has(cacheKey)) return;
  if (finished.size > 50_000) finished.clear();

  let doc = null;
  try {
    doc = await WeeklyQuest.findOneAndUpdate(
      { guildId, userId, weekKey: wKey, completed: { $ne: quest.id } },
      { $inc: { [`progress.${quest.id}`]: amount } as Record<string, number> },
      { upsert: true, new: true },
    );
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    finished.add(cacheKey);
    return;
  }
  if (!doc) return;

  const value = doc.progress?.[quest.id] ?? 0;
  if (value < quest.target) return;

  const marked = await WeeklyQuest.findOneAndUpdate(
    { _id: doc._id, completed: { $ne: quest.id } },
    { $addToSet: { completed: quest.id } },
    { new: true },
  );
  finished.add(cacheKey);
  if (!marked) return;

  const result = await grantReward(userId, guildId, quest.coins, quest.xp);
  await announceWeekly(client, {
    userId,
    icon: quest.icon,
    title: quest.title,
    coins: quest.coins,
    xp: quest.xp,
    level: result.level,
    leveledUp: result.leveledUp,
  });
}

interface AnnounceOptions {
  userId: string;
  icon: string;
  title: string;
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

async function announceWeekly(client: BotClient, o: AnnounceOptions): Promise<void> {
  try {
    const hall = await getHall(client);
    if (!hall) return;

    const levelUp = o.leveledUp ? `  🆙 **LVL UP!** (Level **${o.level}**)` : "";
    const embed = new EmbedBuilder()
      .setColor(0x8b5cf6)
      .setTitle(`${o.icon} Weekly task completed`)
      .setDescription(`**${o.title}**`)
      .addFields({
        name: "Obtained",
        value: `${CURRENCY.name}: ${jenny(o.coins)} | ${xpText(o.xp)}${levelUp}`,
      });

    await hall.send({ content: `<@${o.userId}>`, embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    logger.error("فشل إرسال إعلان مهمة أسبوعية", err);
  }
}
