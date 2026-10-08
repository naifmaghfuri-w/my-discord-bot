import type { Message } from "discord.js";
import { CountingState } from "../database/models/CountingState";
import { logger } from "../utils/logger";

const CHECK_MARK = "☑️";

export type CountResult = "ignored" | "correct" | "wrong";

function parseNumber(text: string): number | null {
  const t = text.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return /^\d{1,15}$/.test(t) ? Number(t) : null;
}

/** أول مرة بدون حالة محفوظة: نكمل من آخر رقم موجود في القناة (لو فيه) */
async function ensureState(message: Message<true>): Promise<void> {
  if (await CountingState.exists({ guildId: message.guildId })) return;

  let start = 0;
  const recent = await message.channel.messages.fetch({ limit: 50, before: message.id }).catch(() => null);
  if (recent) {
    for (const m of recent.values()) {
      const n = parseNumber(m.content);
      if (n !== null) {
        start = n;
        break; // الأحدث أولاً
      }
    }
  }
  await CountingState.updateOne(
    { guildId: message.guildId },
    { $setOnInsert: { guildId: message.guildId, current: start, highScore: start } },
    { upsert: true },
  );
}

/**
 * يعالج رسالة في قناة العد.
 * - رقم صحيح (السابق + 1): يضيف ☑️ ويرجع "correct"
 * - رقم غلط: تنمسح الرسالة والسلسلة ما تنقطع، ويرجع "wrong"
 * - أي شيء ثاني (مو رقم): "ignored"
 */
export async function handleCountingMessage(message: Message<true>): Promise<CountResult> {
  const n = parseNumber(message.content);
  if (n === null) return "ignored";

  try {
    await ensureState(message);

    // ذري: ينجح فقط لو الرقم الحالي = n - 1 (يمنع تعارض شخصين يكتبون نفس الرقم بنفس اللحظة)
    const updated = await CountingState.findOneAndUpdate(
      { guildId: message.guildId, current: n - 1 },
      { $set: { current: n }, $max: { highScore: n } },
      { new: true },
    );

    if (!updated) {
      await message.delete().catch(() => undefined);
      return "wrong";
    }

    await message.react(CHECK_MARK).catch(() => undefined);
    return "correct";
  } catch (err) {
    logger.error("خطأ في قناة العد", err);
    return "ignored";
  }
}
