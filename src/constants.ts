/** العملات والمقاييس الموحدة في البوت والسيرفر */
export const CURRENCY = {
  name: "Jenny",
  emoji: "<:J_:1548935096768274532>",
} as const;

export const XP = {
  name: "XP",
  emoji: "<:emoji_44:1552778123441999882>",
} as const;

export const BIRTHDAY_EMOJI = "<:emoji_48:1553179328840474695>";

/** يعرض مبلغاً بالشكل: **150** <:J_:...> */
export function jenny(amount: number): string {
  return `**${amount.toLocaleString("en-US")}** ${CURRENCY.emoji}`;
}

/** يعرض نقاط خبرة بالشكل: **40** <:XP:...> */
export function xp(amount: number): string {
  return `**${amount.toLocaleString("en-US")}** ${XP.emoji}`;
}

/** كل مبالغ المكافآت في مكان واحد لسهولة التعديل */
export const REWARDS = {
  dailyMin: 100,
  dailyMax: 200,
  coinflipWin: 20,
  rpsWin: 50,
  xoWin: 100,
  /** هدية يوم الميلاد */
  birthdayJenny: 500,
  birthdayXp: 200,
} as const;

/** نسبة الفائدة اليومية على رصيد البنك (2% تُضاف تلقائياً مع كل /daily) */
export const BANK_INTEREST_RATE = 0.02;
