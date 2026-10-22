import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type BaseMessageOptions, type Message } from "discord.js";
import { jenny } from "../constants";
import { GUARD_TITLE } from "../companies/titles";
import { Company, CompanyLog, CompanyMember } from "../database/models/Company";
import { JobProfile } from "../database/models/JobProfile";
import { ThiefState } from "../database/models/ThiefState";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";
import { getJob } from "./service";
import { fmtMs } from "./views";

const MIN = 60_000;

export const THIEF = {
  jobId: "thief",
  /** عضو عشوائي: ياخذ اللي في محفظته (الحد الأعلى 100) */
  member: { max: 100, cooldownMs: 90 * MIN },
  /** شركة عشوائية: بدون حارس يسرق من ميزانيتها، وبحارس يُمسك ويدفع تعويض */
  company: { steal: 150, fine: 50, cooldownMs: 150 * MIN },
  /** محل صغير */
  shop: { gain: 50, cooldownMs: 30 * MIN },
} as const;

export type ThiefAction = "member" | "company" | "shop";
const ACTIONS: ThiefAction[] = ["member", "company", "shop"];
const COOLDOWN: Record<ThiefAction, number> = { member: THIEF.member.cooldownMs, company: THIEF.company.cooldownMs, shop: THIEF.shop.cooldownMs };

const SHOP_LINES = ["دخلت بقالة صغيرة وسحبت الدرج", "سرقت محل عصائر بدون ما أحد ينتبه", "لفّيت على كشك وطلعت بالفلوس", "نشلت صندوق محل قرطاسية"];

async function cooldowns(userId: string, guildId: string): Promise<Record<ThiefAction, number>> {
  const st = await ThiefState.findOne({ userId, guildId });
  const now = Date.now();
  const left = (a: ThiefAction) => {
    const at = st?.[a] ? new Date(st[a] as Date).getTime() : 0;
    return Math.max(0, COOLDOWN[a] - (now - at));
  };
  return { member: left("member"), company: left("company"), shop: left("shop") };
}

/** قائمة السرقة (!سرقة) */
export async function buildThiefMenu(userId: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const cd = await cooldowns(userId, guildId);
  const state = (a: ThiefAction) => (cd[a] > 0 ? `⏳ بعد ${fmtMs(Math.max(MIN, cd[a]))}` : "✅ جاهزة");
  const lines = [
    note ?? "",
    `🎲 **عضو عشوائي** — تاخذ اللي في محفظته (لين ${jenny(THIEF.member.max)}) • ينتظر ${THIEF.member.cooldownMs / MIN} دقيقة\n${state("member")}`,
    `🏢 **شركة عشوائية** — بدون حارس بوابة تسرق ${jenny(THIEF.company.steal)} من ميزانيتها، وبحارس تنمسك وتدفع تعويض ${jenny(THIEF.company.fine)} • ينتظر ${THIEF.company.cooldownMs / MIN} دقيقة\n${state("company")}`,
    `🏪 **محل صغير** — تاخذ ${jenny(THIEF.shop.gain)} • ينتظر ${THIEF.shop.cooldownMs / MIN} دقيقة\n${state("shop")}`,
  ].filter(Boolean);
  const btn = (a: ThiefAction, label: string, emoji: string) =>
    new ButtonBuilder().setCustomId(`co|thf|${userId}|${a}`).setLabel(label).setEmoji(emoji).setStyle(ButtonStyle.Danger).setDisabled(cd[a] > 0);
  return {
    content: "",
    embeds: [new EmbedBuilder().setColor(0x2c2f33).setTitle("🦹 اختر سرقتك").setDescription(lines.join("\n\n"))],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(btn("member", "عضو عشوائي", "🎲"), btn("company", "شركة عشوائية", "🏢"), btn("shop", "محل صغير", "🏪"))],
  };
}

/** !سرقة: يفتح القائمة للحرامي */
export async function handleThiefMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const jp = await getJob(message.author.id, message.guildId);
  if (jp.jobId !== THIEF.jobId) {
    await message.reply({ content: "❌ أمر `!سرقة` للحرامية فقط. اكتب `!الوظائف` وقدّم على وظيفة حرامي.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  const view = await buildThiefMenu(message.author.id, message.guildId);
  await message.channel.send(view).catch(() => undefined);
}

async function payThief(userId: string, guildId: string, amount: number): Promise<void> {
  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: amount } }, { upsert: true });
  await logTransaction(guildId, userId, "salary", amount);
}

/** ينفّذ السرقة ويرجع نص النتيجة */
export async function runThief(userId: string, guildId: string, action: ThiefAction): Promise<string> {
  if (!ACTIONS.includes(action)) return "❌ سرقة غير معروفة.";
  const jp = await getJob(userId, guildId);
  if (jp.jobId !== THIEF.jobId) return "❌ هذي القائمة للحرامية فقط.";

  // نضمن وجود سجل المهل ثم نحجز المهلة ذريًا
  await ThiefState.updateOne({ userId, guildId }, { $setOnInsert: { member: null, company: null, shop: null } }, { upsert: true }).catch(() => undefined);
  const now = Date.now();
  const before = await ThiefState.findOneAndUpdate(
    { userId, guildId, $or: [{ [action]: null }, { [action]: { $lte: new Date(now - COOLDOWN[action]) } }] },
    { $set: { [action]: new Date(now) } },
  );
  if (!before) {
    const cd = await cooldowns(userId, guildId);
    return `⏳ لازم تختفي شوي. هذي السرقة بعد ${fmtMs(Math.max(MIN, cd[action]))}.`;
  }
  const revert = () => ThiefState.updateOne({ userId, guildId }, { $set: { [action]: before[action] ?? null } });
  await JobProfile.updateOne({ userId, guildId }, { $set: { lastActiveAt: new Date(now) }, $inc: { shifts: 1 } }).catch(() => undefined);

  /* ----- عضو عشوائي ----- */
  if (action === "member") {
    const cands = await UserProfile.aggregate<{ userId: string; coins: number }>([
      { $match: { guildId, userId: { $ne: userId }, coins: { $gte: 1 } } },
      { $sample: { size: 8 } },
    ]);
    for (const c of cands) {
      const take = Math.min(THIEF.member.max, c.coins);
      const ok = await UserProfile.findOneAndUpdate({ userId: c.userId, guildId, coins: { $gte: take } }, { $inc: { coins: -take } });
      if (ok) {
        await payThief(userId, guildId, take);
        return ` **نجحت!** سرقت ${jenny(take)} من <@${c.userId}>.`;
      }
    }
    await revert();
    return " دورت وما لقيت عضو معه فلوس. جرّب بعدين (ما انحسبت عليك مهلة).";
  }

  /* ----- شركة عشوائية ----- */
  if (action === "company") {
    const [c] = await Company.aggregate<{ _id: unknown; name: string; budget: number }>([{ $match: { guildId } }, { $sample: { size: 1 } }, { $project: { name: 1, budget: 1 } }]);
    if (!c) {
      await revert();
      return "🏢 ما فيه شركات في السيرفر الحين (ما انحسبت عليك مهلة).";
    }
    const cid = String(c._id);
    const guarded = await CompanyMember.exists({ companyId: cid, title: GUARD_TITLE });
    if (guarded) {
      // انمسك: يدفع تعويض لميزانية الشركة (أو كل اللي معه لو أقل)
      const prof = await UserProfile.findOne({ userId, guildId }, { coins: 1 });
      const pay = Math.min(THIEF.company.fine, prof?.coins ?? 0);
      let paid = 0;
      if (pay > 0) {
        const ok = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: pay } }, { $inc: { coins: -pay } });
        if (ok) {
          paid = pay;
          await Company.updateOne({ _id: c._id }, { $inc: { budget: pay } });
        }
      }
      await CompanyLog.create({ guildId, companyId: cid, text: `🛡️ حارس البوابة أمسك حرامي <@${userId}> وأخذنا تعويض ${jenny(paid)}.` }).catch(() => undefined);
      return `🚨 **انمسكت!** حارس بوابة **${c.name}** شافك وأخذ منك تعويض ${jenny(paid)}.`;
    }
    const take = Math.min(THIEF.company.steal, c.budget);
    const ok = take > 0 ? await Company.findOneAndUpdate({ _id: c._id, budget: { $gte: take } }, { $inc: { budget: -take } }) : null;
    if (!ok) {
      await revert();
      return `🏢 شركة **${c.name}** ما فيها فلوس تنسرق. جرّب بعدين (ما انحسبت عليك مهلة).`;
    }
    await payThief(userId, guildId, take);
    await CompanyLog.create({ guildId, companyId: cid, text: ` حرامي سرق ${jenny(take)} من ميزانية الشركة (ما فيها حارس بوابة).` }).catch(() => undefined);
    return ` **نجحت!** سرقت ${jenny(take)} من ميزانية شركة **${c.name}** (ما عندها حارس بوابة).`;
  }

  /* ----- محل صغير ----- */
  await payThief(userId, guildId, THIEF.shop.gain);
  return `🏪 ${SHOP_LINES[Math.floor(Math.random() * SHOP_LINES.length)]} وطلعت بـ ${jenny(THIEF.shop.gain)}.`;
}
