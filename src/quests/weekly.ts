import type { QuestId } from "./definitions";

export interface WeeklyQuestDef {
  id: QuestId;
  icon: string;
  title: string;
  target: number;
  coins: number;
  xp: number;
}

/** مهام أسبوعية: نفس أنواع المهام اليومية بس أهداف ومكافآت أكبر */
export const WEEKLY_QUESTS: WeeklyQuestDef[] = [
  { id: "messages", icon: "✉️", title: "أرسل 50 رسالة هذا الأسبوع", target: 50, coins: 150, xp: 100 },
  { id: "reactions", icon: "⭐", title: "أضف 20 رياكشن هذا الأسبوع", target: 20, coins: 120, xp: 90 },
  { id: "media", icon: "🖼️", title: "أرسل 10 صور أو فيديوهات هذا الأسبوع", target: 10, coins: 130, xp: 100 },
  { id: "emojis", icon: "😀", title: "استخدم 100 إيموجي هذا الأسبوع", target: 100, coins: 150, xp: 100 },
  { id: "voice", icon: "🎧", title: "اقضِ ساعة بالصوتية هذا الأسبوع", target: 60, coins: 200, xp: 150 },
];

export const WEEKLY_QUEST_MAP = Object.fromEntries(WEEKLY_QUESTS.map((q) => [q.id, q])) as Partial<
  Record<QuestId, WeeklyQuestDef>
>;
