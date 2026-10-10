import type { GuildMember } from "discord.js";
import { logger } from "../utils/logger";

export const SEPARATORS = ["|", "•", "»", "✦", "★", "❖", "✧", "✯", "||", "┊"] as const;
export const DEFAULT_SEP = "»";
const MAX_NICK = 32;
const AFK_PREFIX = "[AFK] ";

const esc = (x: string): string => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const SUFFIX_RE = new RegExp(`\\s*(?:${SEPARATORS.map(esc).join("|")})\\s*\\d+\\s*🔥\\s*$`, "u");

/** يشيل شعلة الستريك من آخر الاسم (لو موجودة) */
export const stripStreak = (name: string): string => name.replace(SUFFIX_RE, "").trimEnd();

/** يحط/يشيل "الاسم » 43 🔥" في لقب العضو. يتجاهل بصمت لو ما نقدر نعدّل لقبه. */
export async function applyStreakNick(member: GuildMember, streak: number, sep: string, hidden: boolean): Promise<void> {
  if (!member.manageable) return;
  const current = member.nickname ?? member.displayName;
  let prefix = "";
  let core = current;
  if (core.startsWith(AFK_PREFIX)) {
    prefix = AFK_PREFIX;
    core = core.slice(AFK_PREFIX.length);
  }
  core = stripStreak(core);

  let next: string;
  if (hidden || streak <= 0) next = prefix + core;
  else {
    const suffix = ` ${sep} ${streak} 🔥`;
    const room = MAX_NICK - suffix.length - prefix.length;
    next = prefix + core.slice(0, Math.max(1, room)).trimEnd() + suffix;
  }
  if (next === member.nickname || (!member.nickname && next === member.displayName)) return;
  // لو ما عنده لقب ورجّعنا اسمه الأصلي، نخلي اللقب فاضي
  const value = next === member.user.displayName || next === member.user.username ? null : next;
  await member.setNickname(value, "شعلة الستريك").catch((err) => logger.error(`فشل تحديث لقب الستريك: ${String(err)}`));
}
