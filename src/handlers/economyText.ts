import type { Message } from "discord.js";
import { attemptRob, transferWallet } from "../bank/service";
import { jenny } from "../constants";
import { UserProfile } from "../database/models/UserProfile";
import { logger } from "../utils/logger";

/** !سرقة @منشن */
const ROB_TRIGGER = /^!\s*سرق[ةه]\s+<@!?(\d+)>$/;
/** !تحويل @منشن مبلغ  أو  !تحويل رقم_حساب(8 أرقام) مبلغ */
const PAY_TRIGGER = /^!\s*تحويل\s+(?:<@!?(\d+)>|(\d{8}))\s+(\d+)$/;
/** نفس الأوامر لكن بصيغة غلط، نعرض لها طريقة الاستخدام */
const ROB_LOOSE = /^!\s*سرق[ةه](?:\s|$)/;
const PAY_LOOSE = /^!\s*تحويل(?:\s|$)/;

function formatMinutes(ms: number): string {
  return `${Math.ceil(ms / 60_000)} دقيقة`;
}

/** يرجع true إذا الرسالة كانت أمر اقتصاد (وتمت معالجتها) */
export async function handleEconomyTextCommand(message: Message<true>): Promise<boolean> {
  // نحوّل الأرقام العربية (٠-٩) لإنجليزية
  const text = message.content
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

  const guildId = message.guildId;
  const authorId = message.author.id;

  const say = (content: string) =>
    message
      .reply({ content, allowedMentions: { parse: [], repliedUser: false } })
      .catch((err) => logger.error("فشل إرسال رد الاقتصاد", err));

  // ---------- !سرقة @منشن ----------
  const rob = ROB_TRIGGER.exec(text);
  if (rob) {
    const targetId = rob[1];
    const target = await message.client.users.fetch(targetId).catch(() => null);
    if (!target) {
      await say("❌ ما لقيت هذا العضو.");
      return true;
    }
    if (target.bot) {
      await say("😅 ما تقدر تسرق بوت.");
      return true;
    }

    const result = await attemptRob(authorId, targetId, guildId);

    if (!result.ok) {
      const msLeft = "msLeft" in result ? result.msLeft : 0;
      const messages: Record<string, string> = {
        self: "😅 ما تقدر تسرق نفسك.",
        cooldown: `⏳ لازم تنتظر ${formatMinutes(msLeft)} قبل ما تسرق مرة ثانية.`,
        victim_too_poor: `💸 محفظة <@${targetId}> فاضية تقريباً، ما تستاهل السرقة.`,
        victim_immune: `🛡️ <@${targetId}> محمي من السرقة حالياً (${formatMinutes(msLeft)} متبقية).`,
        robber_too_poor: "💸 محفظتك فاضية، لازم يكون عندك شوي فلوس قبل ما تسرق.",
      };
      await say(messages[result.reason] ?? "❌ ما قدرت أنفذ السرقة.");
      return true;
    }

    if (result.success) {
      await say(`🦹 نجحت! سرقت ${jenny(result.amount)} من محفظة <@${targetId}>.`);
    } else {
      await say(`🚨 انضبطت! دفعت غرامة ${jenny(result.fine)}.`);
    }
    return true;
  }

  if (ROB_LOOSE.test(text)) {
    await say("❌ الصيغة: `!سرقة @الشخص`");
    return true;
  }

  // ---------- !تحويل @منشن/رقم_حساب مبلغ ----------
  const pay = PAY_TRIGGER.exec(text);
  if (pay) {
    const amount = Number(pay[3]);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      await say("❌ المبلغ لازم يكون رقم صحيح أكبر من 0.");
      return true;
    }

    let targetId = pay[1];
    if (!targetId) {
      const account = await UserProfile.findOne({ guildId, accountNumber: pay[2] }, { userId: 1 }).catch(() => null);
      if (!account) {
        await say("❌ ما لقيت حساب بنكي بهذا الرقم.");
        return true;
      }
      targetId = account.userId;
    }

    const target = await message.client.users.fetch(targetId).catch(() => null);
    if (!target) {
      await say("❌ ما لقيت هذا العضو.");
      return true;
    }
    if (target.bot) {
      await say("🤖 ما تقدر تحوّل لبوت.");
      return true;
    }

    const result = await transferWallet(authorId, targetId, guildId, amount);
    if (!result.ok) {
      await say(result.reason === "self" ? "😅 ما تقدر تحوّل لنفسك." : "❌ رصيد محفظتك ما يكفي لهذا المبلغ.");
      return true;
    }

    await say(`✅ حوّلت ${jenny(amount)} إلى <@${targetId}>.`);
    return true;
  }

  if (PAY_LOOSE.test(text)) {
    await say("❌ الصيغة: `!تحويل @الشخص 100` أو `!تحويل 12345678 100` (رقم الحساب البنكي).");
    return true;
  }

  return false;
}
