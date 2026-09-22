import { Events, type Message } from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";
import { QUEST_SETTINGS, type QuestId } from "../quests/definitions";
import { progressQuest, toAnnouncer } from "../quests/service";
import type { BotEvent } from "../types";
import { logger } from "../utils/logger";

const CUSTOM_EMOJI = /<a?:\w+:\d+>/g;
const UNICODE_EMOJI = /\p{Extended_Pictographic}/gu;
const MEOW = /م+ي+ا+و+/;

const lastCounted = new Map<string, number>();

function countEmojis(text: string): number {
  const custom = text.match(CUSTOM_EMOJI)?.length ?? 0;
  const unicode = text.replace(CUSTOM_EMOJI, "").match(UNICODE_EMOJI)?.length ?? 0;
  return custom + unicode;
}

const event: BotEvent = {
  name: Events.MessageCreate,
  async execute(client: BotClient, message: Message) {
    if (!message.guildId || message.author.bot || message.webhookId) return;

    const guildId = message.guildId;
    const userId = message.author.id;
    const channel = toAnnouncer(message.channel);
    const content = message.content ?? "";
    const jobs: Promise<void>[] = [];

    const track = (questId: QuestId, amount = 1, uid = userId) => {
      jobs.push(progressQuest(client, { guildId, userId: uid, questId, amount, channel }));
    };

    // أرسل 5 رسائل (بفاصل زمني ضد السبام)
    const now = Date.now();
    if (now - (lastCounted.get(userId) ?? 0) >= QUEST_SETTINGS.messageGapMs) {
      lastCounted.set(userId, now);
      track("messages");
    }

    // صورة أو فيديو
    if (message.attachments.some((a) => a.contentType?.startsWith("image/") || a.contentType?.startsWith("video/"))) {
      track("media");
    }

    // ستيكرات
    if (message.stickers.size > 0) track("stickers", message.stickers.size);

    // إيموجي
    const emojis = countEmojis(content);
    if (emojis > 0) track("emojis", emojis);

    // مياو
    if (MEOW.test(content)) track("meow");

    // قناة العد
    if (config.countingChannelId && message.channelId === config.countingChannelId && /^\d+$/.test(content.trim())) {
      track("counting");
    }

    // رد على عضو + استلام رد/منشن
    const mentioned = new Set<string>();
    message.mentions.users.forEach((u) => {
      if (!u.bot && u.id !== userId) mentioned.add(u.id);
    });

    if (message.reference?.messageId) {
      const ref = await message.fetchReference().catch(() => null);
      if (ref && !ref.author.bot && ref.author.id !== userId) {
        track("reply");
        mentioned.add(ref.author.id);
      }
    }
    mentioned.forEach((id) => track("mention", 1, id));

    const results = await Promise.allSettled(jobs);
    for (const r of results) {
      if (r.status === "rejected") logger.error("خطأ في تتبع المهام", r.reason);
    }
  },
};

export default event;
