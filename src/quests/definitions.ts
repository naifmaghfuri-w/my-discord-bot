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
  /** عنوان المهمة بالإنجليزي (يُستخدم في نص إعلان الإنجاز وبطاقة الصورة) */
  titleEn: string;
  description: string;
  /** وصف المهمة بالإنجليزي (يُستخدم في بطاقة الصورة) */
  descriptionEn: string;
  /** المطلوب لإكمال المهمة */
  target: number;
  /** المكافآت */
  coins: number;
  xp: number;
}

/** كل المهام اليومية: عدّل المبالغ والنصوص من هنا */
export const QUESTS: QuestDef[] = [
  { id: "mention", icon: "💬", title: "احصل على رد أو منشن", titleEn: "Mention or reply to a member", description: "خلّ عضو يرد عليك أو يمنشنك في الشات", descriptionEn: "Get a reply or mention from any member", target: 1, coins: 30, xp: 25 },
  { id: "reply", icon: "↩️", title: "رد على عضو آخر", titleEn: "Reply to another member", description: "استخدم خاصية الرد على رسالة أي عضو", descriptionEn: "Use the reply feature on any member's message", target: 1, coins: 30, xp: 25 },
  { id: "media", icon: "🖼️", title: "أرسل صورة أو فيديو", titleEn: "Send an image or video", description: "ارسل صورة أو مقطع فيديو في الشات", descriptionEn: "Send an image or a video clip in chat", target: 1, coins: 40, xp: 30 },
  { id: "reactions", icon: "⭐", title: "أضف 3 رياكشن", titleEn: "Add 3 reactions", description: "تفاعل مع 3 رسائل مختلفة بالرياكشن", descriptionEn: "React to 3 different messages", target: 3, coins: 30, xp: 25 },
  { id: "counting", icon: "🔢", title: "عدّ في قناة العد", titleEn: "Count in the counting channel", description: "شارك في قناة العد بإرسال رقم", descriptionEn: "Join the counting channel by sending a number", target: 1, coins: 30, xp: 25 },
  { id: "messages", icon: "✉️", title: "أرسل 5 رسائل", titleEn: "Send 5 messages", description: "ارسل 5 رسائل في الشات", descriptionEn: "Send 5 messages in chat", target: 5, coins: 40, xp: 30 },
  { id: "meow", icon: "🐱", title: 'قل "مياو"', titleEn: 'Say "meow"', description: "اكتب مياو في الشات", descriptionEn: 'Type "meow" in chat', target: 1, coins: 20, xp: 20 },
  { id: "emojis", icon: "😀", title: "استخدم 20 ايموجي", titleEn: "Use 20 emojis", description: "ارسل 20 إيموجي في الشات", descriptionEn: "Send 20 emojis in chat", target: 20, coins: 50, xp: 40 },
  { id: "stickers", icon: "🎭", title: "أرسل 3 ستيكرات", titleEn: "Send 3 stickers", description: "ارسل 3 ستيكرات في الشات", descriptionEn: "Send 3 stickers in chat", target: 3, coins: 40, xp: 30 },
  { id: "voice", icon: "🎧", title: "اقضِ 5 دقائق بالصوتية", titleEn: "Spend 5 minutes in a voice channel", description: "ابقَ 5 دقائق في روم صوتي", descriptionEn: "Stay in a voice channel for 5 minutes", target: 5, coins: 60, xp: 50 },
];

export const QUEST_MAP = Object.fromEntries(QUESTS.map((q) => [q.id, q])) as Record<QuestId, QuestDef>;

/** مكافأة إكمال كل المهام العشر في يوم واحد */
export const ALL_QUESTS_BONUS = {
  coins: 200,
  xp: 150,
  titleEn: "Complete all daily tasks",
  descriptionEn: "You finished all 10 daily tasks in one day!",
} as const;

export const QUEST_SETTINGS = {
  /** أقل فاصل بين رسالتين لتُحسب في مهمة "5 رسائل" (ضد السبام) */
  messageGapMs: 3000,
  /** مهمة الصوت تُحسب فقط إذا كان معك عضو آخر في الروم */
  voiceRequireCompany: true,
} as const;

/** عبارات التشجيع اللي تظهر مع الإنجاز (يختار البوت اثنتين عشوائياً) */
export const FLAVOR_LINES = [
  "لقد أثبت انك احد اركان الامبراطورية",
  "لا يُكلف مثلك الا بالمستحيل ~",
  "هكذا يكون الأبطال، خطوة بعد خطوة",
  "سجلك يزداد لمعاناً يوماً بعد يوم",
  "الامبراطورية فخورة بك ✦",
  "أداء يليق بأصحاب الهيبة",
];

export function pickFlavor(count = 2): string[] {
  return [...FLAVOR_LINES].sort(() => Math.random() - 0.5).slice(0, count);
}
