/** العملة الموحدة للبوت والسيرفر: كل المكافآت والألعاب والمهام تستخدمها */
export const CURRENCY = {
  name: "Jenny",
  emoji: "<:J_:1548935096768274532>",
} as const;

/** يعرض مبلغاً بالشكل: **150** <:J_:...> */
export function jenny(amount: number): string {
  return `**${amount.toLocaleString("en-US")}** ${CURRENCY.emoji}`;
}

/** كل مبالغ المكافآت في مكان واحد لسهولة التعديل */
export const REWARDS = {
  dailyMin: 100,
  dailyMax: 200,
  coinflipWin: 20,
  rpsWin: 50,
  xoWin: 100,
} as const;
