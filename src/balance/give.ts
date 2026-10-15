import type { Message } from "discord.js";
import { config } from "../config";
import { jenny } from "../constants";
import { UserProfile } from "../database/models/UserProfile";

/** "!اعطى 500" لنفسك، أو "!اعطى @شخص 500" — للمالك فقط، والفلوس تنزل من العدم (مو من أحد) */
const GIVE_TRIGGER = /^!\s*[اأ]عط[يى]\s+(?:<@!?(\d+)>\s+)?([\d٠-٩,،]+)$/;
const MAX_GIVE = 1_000_000_000;

const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/** يرجع true لو الرسالة أمر !اعطى (حتى لو غير مسموح، عشان ما تمشي لباقي الأوامر) */
export async function handleGiveMessage(message: Message<true>): Promise<boolean> {
  const match = GIVE_TRIGGER.exec(message.content.trim());
  if (!match) return false;

  // غير المالك: ما يصير شيء إطلاقاً
  if (!config.ownerId || message.author.id !== config.ownerId) return true;

  const amount = Number(toLatinDigits(match[2]).replace(/[,،]/g, ""));
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GIVE) {
    await message.reply({ content: `❌ المبلغ لازم بين 1 و ${MAX_GIVE.toLocaleString("en-US")}.`, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return true;
  }

  const targetId = match[1] ?? message.author.id;
  if (match[1]) {
    const user = await message.client.users.fetch(targetId).catch(() => null);
    if (!user || user.bot) {
      await message.reply({ content: "❌ ما لقيت هذا العضو.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
      return true;
    }
  }

  const updated = await UserProfile.findOneAndUpdate(
    { userId: targetId, guildId: message.guildId },
    { $inc: { coins: amount } },
    { upsert: true, new: true },
  ).catch(() => null);
  if (!updated) {
    await message.reply({ content: "❌ تعذّر الإضافة، حاول لاحقاً.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return true;
  }

  await message
    .reply({ content: `✅ أُضيف ${jenny(amount)}${match[1] ? ` إلى <@${targetId}>` : ""}\nرصيد: ${jenny(updated.coins)}`, allowedMentions: { parse: [], repliedUser: false } })
    .catch(() => undefined);
  return true;
}
