import { PermissionFlagsBits, type Message, type Snowflake } from "discord.js";
import { config } from "../config";
import { logModActionText } from "../logs/logger";
import { logger } from "../utils/logger";

/** !حذف 10 | !حذف @شخص 10 | !حذف 10 <ايدي> */
export const CLEAR_TRIGGER = /^!\s*حذف(?:\s+([\s\S]+))?$/;

const MAX_AMOUNT = 100;
const MAX_SCAN = 500; // أقصى عدد رسائل نفحصه لما نمسح لعضو معيّن
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

const USER_ARG = /^(?:<@!?(\d{17,20})>|(\d{17,20}))$/;

function notice(message: Message<true>, content: string, ttl = 5000): void {
  message.channel
    .send({ content, allowedMentions: { parse: [] } })
    .then((m) => setTimeout(() => m.delete().catch(() => undefined), ttl))
    .catch(() => undefined);
}

/** يرجع true لو الرسالة كانت أمر clear (تم التعامل معها) */
export async function handleClearMessage(message: Message<true>, args: string | undefined): Promise<boolean> {
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  const canClear =
    member?.permissions.has(PermissionFlagsBits.ManageMessages) || message.author.id === config.ownerId;

  // من ما عنده صلاحية: نتجاهل بصمت
  if (!canClear) return false;

  let amount: number | undefined;
  let targetId: Snowflake | undefined;

  for (const token of (args ?? "").trim().split(/\s+/).filter(Boolean)) {
    const normalized = token.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
    const user = USER_ARG.exec(normalized);
    if (user) {
      targetId = user[1] ?? user[2];
    } else if (/^\d{1,3}$/.test(normalized) && amount === undefined) {
      amount = Number(normalized);
    } else {
      notice(message, "❌ الصيغة: `!حذف 10` أو `!حذف @شخص 10`", 8000);
      return true;
    }
  }

  if (amount === undefined || amount < 1 || amount > MAX_AMOUNT) {
    notice(message, `❌ حدد عدد من 1 إلى ${MAX_AMOUNT}، مثال: \`!حذف 10\` أو \`!حذف @شخص 10\``, 8000);
    return true;
  }

  const channel = message.channel;
  const me = message.guild.members.me ?? (await message.guild.members.fetchMe());
  if (!channel.permissionsFor(me).has([PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory])) {
    notice(message, "❌ ما عندي صلاحية مسح الرسائل في هذي القناة (أحتاج Manage Messages و Read Message History).", 8000);
    return true;
  }

  // نحذف رسالة الأمر نفسها أول شيء حتى ما تنحسب ضمن العدد
  await message.delete().catch(() => undefined);

  try {
    let deletedCount = 0;

    if (!targetId) {
      const deleted = await channel.bulkDelete(amount, true); // true = يتجاهل الأقدم من 14 يوم
      deletedCount = deleted.size;
    } else {
      const toDelete: Snowflake[] = [];
      let before: Snowflake | undefined;
      let scanned = 0;
      const cutoff = Date.now() - FOURTEEN_DAYS;

      scan: while (toDelete.length < amount && scanned < MAX_SCAN) {
        const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
        if (batch.size === 0) break;
        for (const m of batch.values()) {
          if (m.createdTimestamp < cutoff) break scan; // ديسكورد ما يسمح بمسح الأقدم دفعة واحدة
          if (m.author.id === targetId) {
            toDelete.push(m.id);
            if (toDelete.length >= amount) break scan;
          }
        }
        scanned += batch.size;
        before = batch.last()?.id;
      }

      if (toDelete.length > 0) {
        const deleted = await channel.bulkDelete(toDelete, true);
        deletedCount = deleted.size;
      }
    }

    notice(
      message,
      targetId
        ? `🧹 تم مسح **${deletedCount}** رسالة من <@${targetId}>.`
        : `🧹 تم مسح **${deletedCount}** رسالة.`,
    );

    await logModActionText(
      message.guild,
      message.author,
      "مسح رسائل",
      targetId ? { id: targetId } : null,
      message.channelId,
      `**العدد:** ${deletedCount}`,
    );
  } catch (err) {
    logger.error("فشل مسح الرسائل", err);
    notice(message, "❌ صار خطأ أثناء المسح.", 6000);
  }
  return true;
}
