import type { Message } from "discord.js";
import { CURRENCY, jenny, XP } from "../constants";
import { getProfile, xpNeeded } from "../services/economy";

/** "!رصيدي" أو "!رصيد @شخص" */
export const BALANCE_TRIGGER = /^!\s*(?:رصيدي|رصيد\s+<@!?\d+>)$/;
const MENTION = /<@!?(\d+)>/;

/** رصيد المحفظة فقط (رصيد البنك سري ومحمي بالرمز) */
export async function handleBalanceMessage(message: Message<true>): Promise<void> {
  const mention = MENTION.exec(message.content);
  const targetId = mention ? mention[1] : message.author.id;

  const user = mention ? await message.client.users.fetch(targetId).catch(() => null) : message.author;
  if (!user || user.bot) {
    await message.reply({ content: "❌ ما لقيت هذا العضو.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }

  const member = await message.guild.members.fetch(targetId).catch(() => null);
  const name = member?.displayName ?? user.username;

  const profile = await getProfile(targetId, message.guildId).catch(() => null);
  if (!profile) {
    await message.reply({ content: "❌ تعذّر جلب الرصيد، حاول لاحقاً.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }

  const content = [
    `${CURRENCY.emoji} رصيد **${name}**: ${jenny(profile.coins)}`,
    `⭐ المستوى: **${profile.level}** — \`${profile.xp}/${xpNeeded(profile.level)}\` ${XP.emoji}`,
    `🏆 مرات الفوز: **${profile.wins}**`,
  ].join("\n");

  await message.reply({ content, allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
}
