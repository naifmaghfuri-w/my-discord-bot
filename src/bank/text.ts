import type { Message } from "discord.js";
import { jenny } from "../constants";
import { getProfile } from "../services/economy";
import { deposit, withdraw } from "./service";

const DEPOSIT_TRIGGER = /^!\s*[اإ]يداع(?:\s+(\S+))?$/;
const WITHDRAW_TRIGGER = /^!\s*سحب(?:\s+(\S+))?$/;
const BANK_BALANCE_TRIGGER = /^!\s*رصيدي\s+بنكي$/;

/** رقم، أو "الكل" = كل المتاح */
function parseAmount(raw: string | undefined, max: number): number | null {
  if (!raw) return null;
  const t = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬]/g, "");
  if (/^(الكل|كل|all)$/i.test(t)) return max > 0 ? max : null;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n > 0 ? n : null;
}

const noPing = { parse: [] as never[], repliedUser: false };

/** يعالج أوامر البنك النصية. يرجع true لو الرسالة كانت أمر بنك */
export async function handleBankText(message: Message<true>): Promise<boolean> {
  const text = message.content.trim();
  const reply = (content: string) => message.reply({ content, allowedMentions: noPing }).catch(() => undefined);

  if (BANK_BALANCE_TRIGGER.test(text)) {
    const profile = await getProfile(message.author.id, message.guildId).catch(() => null);
    await reply(profile ? `رصيد البنك: ${jenny(profile.bank ?? 0)}` : "❌ تعذّر جلب الرصيد، حاول لاحقاً.");
    return true;
  }

  const dep = DEPOSIT_TRIGGER.exec(text);
  const wd = dep ? null : WITHDRAW_TRIGGER.exec(text);
  if (!dep && !wd) return false;

  const isDeposit = !!dep;
  const arg = (dep ?? wd)?.[1];
  const profile = await getProfile(message.author.id, message.guildId).catch(() => null);
  if (!profile) {
    await reply("❌ تعذّر الوصول لحسابك، حاول لاحقاً.");
    return true;
  }

  const amount = parseAmount(arg, isDeposit ? profile.coins : (profile.bank ?? 0));
  if (!amount) {
    await reply(
      isDeposit
        ? "❌ اكتب مبلغاً صحيحاً: `!ايداع 500` أو `!ايداع الكل`"
        : "❌ اكتب مبلغاً صحيحاً: `!سحب 500` أو `!سحب الكل`",
    );
    return true;
  }

  const result = isDeposit
    ? await deposit(message.author.id, message.guildId, amount).catch(() => null)
    : await withdraw(message.author.id, message.guildId, amount).catch(() => null);

  if (!result) {
    await reply("❌ صار خطأ، حاول لاحقاً.");
    return true;
  }
  if (!result.ok) {
    await reply(isDeposit ? "❌ رصيد محفظتك ما يكفي لهذا المبلغ." : "❌ رصيد بنكك ما يكفي لهذا المبلغ.");
    return true;
  }

  await reply(
    `✅ ${isDeposit ? "أودعت" : "سحبت"} ${jenny(amount)} ${isDeposit ? "بالبنك" : "من البنك"}.\nالمحفظة: ${jenny(result.coins)} | البنك: ${jenny(result.bank)}`,
  );
  return true;
}
