import type { Message } from "discord.js";
import { jenny } from "../constants";
import { getProfile } from "../services/economy";

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

  const profile = await getProfile(targetId, message.guildId).catch(() => null);
  if (!profile) {
    await message.reply({ content: "❌ تعذّر جلب الرصيد، حاول لاحقاً.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }

  await message
    .reply({ content: `رصيد: ${jenny(profile.coins)}`, allowedMentions: { parse: [], repliedUser: false } })
    .catch(() => undefined);
}
