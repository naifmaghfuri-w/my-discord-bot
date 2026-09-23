export type QuestId =
  | "mention"
  | "reply"
  | "media"
  | "reactions"
  | "counting"
  | "messages"
  | "meow"
  | "emojis"
  | "stickers"
  | "voice";

export interface QuestDef {
  id: QuestId;
  icon: string;
  title: string;
  description: string;
  /** المطلوب لإكمال المهمة */
  target: number;
  /** المكافآت */
  coins: number;
  xp: number;
}

/** كل المهام اليومية: عدّل المبالغ والنصوص من هنا */
export const QUESTS: QuestDef[] = [
  { id: "mention", icon: "💬", title: "احصل على رد أو منشن", description: "خلّ عضو يرد عليك أو يمنشنك في الشات", target: 1, coins: 30, xp: 25 },
  { id: "reply", icon: "↩️", title: "رد على عضو آخر", description: "استخدم خاصية الرد على رسالة أي عضو", target: 1, coins: 30, xp: 25 },
  { id: "media", icon: "🖼️", title: "أرسل صورة أو فيديو", description: "ارسل صورة أو مقطع فيديو في الشات", target: 1, coins: 40, xp: 30 },
  { id: "reactions", icon: "⭐", title: "أضف 3 رياكشن", description: "تفاعل مع 3 رسائل مختلفة بالرياكشن", target: 3, coins: 30, xp: 25 },
  { id: "counting", icon: "🔢", title: "عدّ في قناة العد", description: "شارك في قناة العد بإرسال رقم", target: 1, coins: 30, xp: 25 },
  { id: "messages", icon: "✉️", title: "أرسل 5 رسائل", description: "ارسل 5 رسائل في الشات", target: 5, coins: 40, xp: 30 },
  { id: "meow", icon: "🐱", title: 'قل "مياو"', description: "اكتب مياو في الشات", target: 1, coins: 20, xp: 20 },
  { id: "emojis", icon: "😀", title: "استخدم 20 ايموجي", description: "ارسل 20 إيموجي في الشات", target: 20, coins: 50, xp: 40 },
  { id: "stickers", icon: "🎭", title: "أرسل 3 ستيكرات", description: "ارسل 3 ستيكرات في الشات", target: 3, coins: 40, xp: 30 },
  { id: "voice", icon: "🎧", title: "اقضِ 5 دقائق بالصوتية", description: "ابقَ 5 دقائق في روم صوتي", target: 5, coins: 60, xp: 50 },
];

export const QUEST_MAP = Object.fromEntries(QUESTS.map((q) => [q.id, q])) as Record<QuestId, QuestDef>;

/** مكافأة إكمال كل المهام العشر في يوم واحد */
export const ALL_QUESTS_BONUS = { coins: 200, xp: 150 } as const;

export const QUEST_SETTINGS = {
  /** أقل فاصل بين رسالتين لتُحسب في مهمة "5 رسائل" (ضد السبام) */
  messageGapMs: 3000,
  /** مهمة الصوت تُحسب فقط إذا كان معك عضو آخر في الروم */
  voiceRequireCompany: true,
} as const;

/** عبارات التشجيع اللي تظهر مع الإنجاز (يختار البوت اثنتين عشوائياً) */
export const FLAVOR_LINES = [
  "كفو",
  " مبروك ~",
  "هكذا خطوة بعد خطوة",
  "سجلك يزداد لمعاناً يوماً بعد يوم",
  "  اسطورتنا ✦",
  "أداء يليق بك",
];

export function pickFlavor(count = 2): string[] {
  return [...FLAVOR_LINES].sort(() => Math.random() - 0.5).slice(0, count);
}
