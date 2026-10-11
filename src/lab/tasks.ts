import type { Message } from "discord.js";
import { getLabProfile } from "./service";
import { buildQuestsView } from "./views";

/** $LT أو $lt = Lab Tasks (مهام المختبر) — تشتغل فقط في الروم المخصص */
export const TASKS_TRIGGER = /^\$lt$/i;
export const TASKS_CHANNEL = "1551169206400188538";

/** يرجع true لو الرسالة كانت الأمر (حتى لو بروم غلط، عشان ما تمشي لباقي الأوامر) */
export async function handleLabTasksMessage(message: Message<true>): Promise<boolean> {
  if (!TASKS_TRIGGER.test(message.content.trim())) return false;
  if (message.channelId !== TASKS_CHANNEL) return true; // روم ثاني: ما يصير شيء

  const profile = await getLabProfile(message.author.id, message.guildId);
  const view = buildQuestsView(profile);
  await message
    .reply({ embeds: view.embeds, allowedMentions: { repliedUser: false } })
    .catch(() => undefined);
  return true;
}
