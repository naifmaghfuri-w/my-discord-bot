import { CURRENCY, jenny, XP, xp as xpText } from "../constants";
import { getProfile, xpNeeded } from "../services/economy";

/** بطاقة "الرصيد" — نفس محتوى أمر /balance القديم */
export async function buildBalanceContent(userId: string, guildId: string, username: string): Promise<string> {
  const profile = await getProfile(userId, guildId);
  return [
    `${CURRENCY.emoji} رصيد **${username}**: ${jenny(profile.coins)}`,
    `⭐ المستوى: **${profile.level}** — \`${profile.xp}/${xpNeeded(profile.level)}\` ${XP.emoji}`,
    `🏆 مرات الفوز: **${profile.wins}**`,
  ].join("\n");
}
