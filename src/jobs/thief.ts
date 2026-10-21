import type { Message } from "discord.js";
import { jenny } from "../constants";
import { GUARD_TITLE } from "../companies/titles";
import { Company, CompanyLog, CompanyMember } from "../database/models/Company";
import { JobProfile } from "../database/models/JobProfile";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";
import { getJob } from "./service";
import { fmtMs } from "./views";

export const THIEF = {
  jobId: "thief",
  cooldownMs: 60 * 60 * 1000,
  /** يسرق من لاعب عشوائي كل ساعة */
  fromPlayer: 150,
  /** ويسرق من شركة عشوائية ما عندها حارس بوابة */
  fromCompany: 100,
} as const;

/** !سرقة */
export async function handleThiefMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const uid = message.author.id;
  const gid = message.guildId;
  const reply = (content: string) => message.reply({ content, allowedMentions: { repliedUser: false, parse: [] } }).catch(() => undefined);

  const jp = await getJob(uid, gid);
  if (jp.jobId !== THIEF.jobId) {
    await reply("❌ أمر `!سرقة` للحرامية فقط. اكتب `!الوظائف` وقدّم على وظيفة حرامي.");
    return;
  }

  const now = Date.now();
  const before = await JobProfile.findOneAndUpdate(
    { userId: uid, guildId: gid, jobId: THIEF.jobId, $or: [{ lastShiftAt: null }, { lastShiftAt: { $lte: new Date(now - THIEF.cooldownMs) } }] },
    { $set: { lastShiftAt: new Date(now), lastActiveAt: new Date(now) }, $inc: { shifts: 1 } },
  );
  if (!before) {
    const last = jp.lastShiftAt ? new Date(jp.lastShiftAt).getTime() : 0;
    await reply(`⏳ لازم تختفي شوي. تسرق مرة ثانية بعد ${fmtMs(Math.max(60_000, THIEF.cooldownMs - (now - last)))}.`);
    return;
  }

  // 1) لاعب عشوائي
  let victimId: string | null = null;
  const cands = await UserProfile.aggregate<{ userId: string }>([
    { $match: { guildId: gid, userId: { $ne: uid }, coins: { $gte: THIEF.fromPlayer } } },
    { $sample: { size: 6 } },
  ]);
  for (const c of cands) {
    const ok = await UserProfile.findOneAndUpdate({ userId: c.userId, guildId: gid, coins: { $gte: THIEF.fromPlayer } }, { $inc: { coins: -THIEF.fromPlayer } });
    if (ok) {
      victimId = c.userId;
      break;
    }
  }

  // 2) شركة عشوائية بدون حارس بوابة
  const guarded = await CompanyMember.distinct("companyId", { guildId: gid, title: GUARD_TITLE });
  const open = await Company.find({ guildId: gid, _id: { $nin: guarded as unknown[] }, budget: { $gte: THIEF.fromCompany } }).limit(30);
  let robbed: string | null = null;
  for (const c of [...open].sort(() => Math.random() - 0.5)) {
    const ok = await Company.findOneAndUpdate({ _id: c._id, budget: { $gte: THIEF.fromCompany } }, { $inc: { budget: -THIEF.fromCompany } });
    if (ok) {
      robbed = c.name;
      await CompanyLog.create({ guildId: gid, companyId: String(c._id), text: `🦹 حرامي سرق ${THIEF.fromCompany} من ميزانية الشركة (ما فيها حارس بوابة).` }).catch(() => undefined);
      break;
    }
  }

  const total = (victimId ? THIEF.fromPlayer : 0) + (robbed ? THIEF.fromCompany : 0);
  if (total <= 0) {
    // ما لقينا شي: نرجّع المهلة
    await JobProfile.updateOne({ userId: uid, guildId: gid }, { $set: { lastShiftAt: before.lastShiftAt ?? null } });
    await reply("  دورت وما لقيت أحد يستاهل اسرقه ");
    return;
  }
  await UserProfile.updateOne({ userId: uid, guildId: gid }, { $inc: { coins: total } }, { upsert: true });
  await logTransaction(gid, uid, "salary", total);

  const lines = [" **عملية سرقة ناجحة!**"];
  if (victimId) lines.push(`• سرقت ${jenny(THIEF.fromPlayer)} من <@${victimId}>`);
  if (robbed) lines.push(`• سرقت ${jenny(THIEF.fromCompany)} من شركة **${robbed}** (ما عندها حارس بوابة)`);
  lines.push(`المجموع: ${jenny(total)}`);
  await reply(lines.join("\n"));
}
