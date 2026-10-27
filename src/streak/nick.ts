import type { GuildMember } from "discord.js";
import { logger } from "../utils/logger";

export const SEPARATORS = ["|", "•", "»", "✦", "★", "❖", "✧", "✯", "||", "┊"] as const;

const esc = (x: string): string => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SUFFIX_RE = new RegExp(`\\s*(?:${SEPARATORS.map(esc).join("|")})\\s*\\d+\\s*🔥\\s*$`, "u");

/** يشيل شعلة الستريك من آخر الاسم (لو موجودة) */
export const stripStreak = (name: string): string => name.replace(SUFFIX_RE, "").trimEnd();

/** يشيل بقايا "» 43 🔥" القديمة من لقب العضو (مرة وحدة لما يرسل رسالة). يتجاهل بصمت لو ما نقدر. */
export async function cleanStreakNick(member: GuildMember): Promise<void> {
  const nick = member.nickname;
  if (!nick || !SUFFIX_RE.test(nick) || !member.manageable) return;
  const next = stripStreak(nick);
  const value = !next || next === member.user.displayName || next === member.user.username ? null : next;
  await member.setNickname(value, "إزالة شعلة الستريك").catch((err) => logger.error(`فشل تنظيف لقب الستريك: ${String(err)}`));
}
