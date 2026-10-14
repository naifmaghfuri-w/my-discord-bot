import type { Message } from "discord.js";
import { CountingState } from "../database/models/CountingState";
import { logger } from "../utils/logger";

const COUNT_EMOJI = "<a:a6nice1527585495125590076:1552794707023757515>";
const FALLBACK_EMOJI = "☑️";

export type CountResult = "ignored" | "correct" | "wrong";

const MAX_EXPR_LEN = 60;
const MAX_VALUE = 1e15;

/** يقرأ الرسالة كعملية حسابية آمنة (بدون eval): + - × ÷ ^ ( ) وجذر. يرجع رقم صحيح أو null */
export function evalCountExpression(text: string): number | null {
  const src = text
    .trim()
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[×✖xX*]/g, "*")
    .replace(/[÷:\/]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/[٫,]/g, ".")
    .replace(/(جذر|√|sqrt|root)/gi, "√")
    .replace(/\s+/g, "");
  if (!src || src.length > MAX_EXPR_LEN || !/\d/.test(src) || !/^[\d.+\-*/^()√]+$/.test(src)) return null;

  let i = 0;
  const peek = (): string => src[i] ?? "";
  const fail = (): never => {
    throw new Error("bad expr");
  };

  const primary = (): number => {
    if (peek() === "(") {
      i++;
      const v = expr();
      if (peek() !== ")") fail();
      i++;
      return v;
    }
    const m = /^\d+(?:\.\d+)?/.exec(src.slice(i));
    if (!m) return fail();
    i += m[0].length;
    return Number(m[0]);
  };
  const unary = (): number => {
    const c = peek();
    if (c === "-") return (i++, -unary());
    if (c === "+") return (i++, unary());
    if (c === "√") {
      i++;
      const v = unary();
      if (v < 0) fail();
      return Math.sqrt(v);
    }
    return primary();
  };
  const power = (): number => {
    const base = unary();
    if (peek() === "^") {
      i++;
      const e = power();
      if (Math.abs(e) > 64) fail();
      return base ** e;
    }
    return base;
  };
  const term = (): number => {
    let v = power();
    while (peek() === "*" || peek() === "/") {
      const op = src[i++];
      const r = power();
      if (op === "/" && r === 0) fail();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = src[i++];
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };

  try {
    const v = expr();
    if (i !== src.length || !Number.isFinite(v) || Math.abs(v) > MAX_VALUE) return null;
    const r = Math.round(v);
    return Math.abs(v - r) < 1e-9 && r >= 0 ? r : null;
  } catch {
    return null;
  }
}

const parseNumber = evalCountExpression;

/** أول مرة بدون حالة محفوظة: نكمل من آخر رقم موجود في القناة (لو فيه) */
async function ensureState(message: Message<true>): Promise<void> {
  if (await CountingState.exists({ guildId: message.guildId })) return;

  let start = 0;
  let lastUserId: string | undefined;
  const recent = await message.channel.messages.fetch({ limit: 50, before: message.id }).catch(() => null);
  if (recent) {
    for (const m of recent.values()) {
      const n = parseNumber(m.content);
      if (n !== null) {
        start = n;
        lastUserId = m.author.bot ? undefined : m.author.id;
        break; // الأحدث أولاً
      }
    }
  }
  await CountingState.updateOne(
    { guildId: message.guildId },
    { $setOnInsert: { guildId: message.guildId, current: start, highScore: start, ...(lastUserId ? { lastUserId } : {}) } },
    { upsert: true },
  );
}

/**
 * يعالج رسالة في قناة العد.
 * - رقم صحيح (السابق + 1) أو عملية حسابية ناتجها الرقم الصحيح: يضيف الإيموجي ويرجع "correct"
 * - رقم غلط أو من نفس الشخص اللي عدّ قبله: تنمسح الرسالة والسلسلة ما تنقطع، ويرجع "wrong"
 * - أي شيء ثاني (كلام/ايموجي/ستكر/صورة): يُمسح
 */
export async function handleCountingMessage(message: Message<true>): Promise<CountResult> {
  const n = parseNumber(message.content);
  if (n === null) {
    // أي كلام/ايموجي/ستكر/صورة أو غير رقم صحيح: يُمسح
    await message.delete().catch(() => undefined);
    return "wrong";
  }

  try {
    await ensureState(message);

    // ذري: ينجح فقط لو الرقم الحالي = n - 1 وآخر من عدّ شخص غيره
    // (يمنع تعارض شخصين يكتبون نفس الرقم بنفس اللحظة، ويمنع نفس الشخص يعدّ مرتين ورا بعض)
    const updated = await CountingState.findOneAndUpdate(
      { guildId: message.guildId, current: n - 1, lastUserId: { $ne: message.author.id } },
      { $set: { current: n, lastUserId: message.author.id }, $max: { highScore: n } },
      { new: true },
    );

    if (!updated) {
      await message.delete().catch(() => undefined);
      return "wrong";
    }

    await message.react(COUNT_EMOJI).catch(() => message.react(FALLBACK_EMOJI).catch(() => undefined));
    return "correct";
  } catch (err) {
    logger.error("خطأ في قناة العد", err);
    return "ignored";
  }
}
