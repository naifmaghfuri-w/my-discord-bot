/** العملات والمقاييس الموحدة في البوت والسيرفر */
export const CURRENCY = {
  name: "Jenny",
  emoji: "<:J_:1548935096768274532>",
} as const;

export const XP = {
  name: "XP",
  emoji: "<:XP:1549867432200376451>",
} as const;

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
} as const;
