import type { Message } from "discord.js";
import { config } from "../config";
import { JobProfile } from "../database/models/JobProfile";
import { JOBS } from "./data";

/**
 * أمر مالك البوت فقط (فصل صامت: لا يُرسل أي رسالة للمفصول):
 *   !فصل <اسم الوظيفة> [ايدي السيرفر]   ← يفصل كل من يشتغل بهذي الوظيفة في السيرفر
 *   !فصل @شخص [ايدي السيرفر]            ← يفصل شخص واحد من وظيفته
 * بدون ايدي السيرفر = السيرفر الحالي.
 */
export const FIRE_TRIGGER = /^!\s*فصل(?:\s+(.+))?$/;

const ALIASES: Record<string, string[]> = {
  police: ["شرطي", "شرطة", "police"],
  thief: ["حرامي", "حرامية", "سارق", "thief"],
};

const norm = (s: string): string => s.trim().replace(/^ال/, "").toLowerCase();

function findJob(query: string) {
  const q = norm(query);
  if (!q) return null;
  return JOBS.find((j) => norm(j.name) === q || j.id === q || (ALIASES[j.id] ?? []).some((a) => norm(a) === q)) ?? null;
}

const noPing = { parse: [] as never[], repliedUser: false };

/** فصل صامت: يصفّر الوظيفة بدون إشعار ولا مهلة */
const SILENT_RESET = {
  $set: { jobId: "", rank: 0, shifts: 0, lastShiftAt: null, shiftStartedAt: null, streakDays: 0, lastShiftDay: "", notice: "" },
};

export async function handleFireMessage(message: Message<true>): Promise<boolean> {
  const m = FIRE_TRIGGER.exec(message.content.trim());
  if (!m) return false;
  const reply = (content: string) => message.reply({ content, allowedMentions: noPing }).catch(() => undefined);

  if (!config.ownerId || message.author.id !== config.ownerId) {
    await reply("❌ هذا الأمر لمالك البوت فقط.");
    return true;
  }
  const args = (m[1] ?? "").trim();
  if (!args) {
    await reply("اكتب: `!فصل اسم_الوظيفة [ايدي_السيرفر]` أو `!فصل @شخص [ايدي_السيرفر]`");
    return true;
  }

  // ايدي السيرفر = رقم طويل مستقل (مو منشن)
  let guildId = message.guildId;
  let rest = args;
  const idMatch = /(?:^|\s)(\d{17,20})$/.exec(args);
  if (idMatch) {
    guildId = idMatch[1];
    rest = args.slice(0, idMatch.index).trim();
  }
  const guild = message.client.guilds.cache.get(guildId);
  if (!guild) {
    await reply("❌ ما لقيت هذا السيرفر (البوت لازم يكون فيه).");
    return true;
  }

  // فصل شخص
  const userMatch = /^<@!?(\d{17,20})>$/.exec(rest);
  if (userMatch) {
    const userId = userMatch[1];
    const r = await JobProfile.updateOne({ guildId, userId, jobId: { $ne: "" } }, SILENT_RESET);
    await reply(r.modifiedCount > 0 ? `✅ فصلت <@${userId}> من وظيفته في **${guild.name}**.` : `ℹ️ <@${userId}> ما عنده وظيفة في **${guild.name}**.`);
    return true;
  }

  // فصل كل أصحاب وظيفة
  const job = findJob(rest);
  if (!job) {
    await reply(`❌ ما عرفت الوظيفة. المتاحة: ${JOBS.map((j) => j.name).join("، ")}`);
    return true;
  }
  const r = await JobProfile.updateMany({ guildId, jobId: job.id }, SILENT_RESET);
  await reply(`✅ فصلت **${r.modifiedCount}** من وظيفة **${job.name}** في **${guild.name}**.`);
  return true;
}
