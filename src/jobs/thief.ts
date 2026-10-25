import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type BaseMessageOptions, type Client, type Message } from "discord.js";
import { jenny } from "../constants";
import { renderThiefJail, renderThiefMenu, renderThiefResult } from "./thiefCard";
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
  /** الحارس يحسب فقط لو داوم خلال هذي المدة */
  guardActiveMs: 5 * 60 * MIN,
  /** محل صغير */
  shop: { gain: 50, cooldownMs: 30 * MIN },
  /** السجن بعد الإمساك مرتين ورا بعض: ساعة ونص أو كفالة */
  jail: { catches: 2, ms: 90 * MIN, bail: 100 },
} as const;

export type ThiefAction = "member" | "company" | "shop" | "bail";
const ACTIONS: ThiefAction[] = ["member", "company", "shop"];
const COOLDOWN: Record<"member" | "company" | "shop", number> = { member: THIEF.member.cooldownMs, company: THIEF.company.cooldownMs, shop: THIEF.shop.cooldownMs };

async function jailLeft(userId: string, guildId: string): Promise<number> {
  const st = await ThiefState.findOne({ userId, guildId }, { jailUntil: 1 });
  return st?.jailUntil ? Math.max(0, new Date(st.jailUntil).getTime() - Date.now()) : 0;
}

async function cooldowns(userId: string, guildId: string): Promise<Record<"member" | "company" | "shop", number>> {
  const st = await ThiefState.findOne({ userId, guildId });
  const now = Date.now();
  const left = (a: "member" | "company" | "shop") => {
    const at = st?.[a] ? new Date(st[a] as Date).getTime() : 0;
    return Math.max(0, COOLDOWN[a] - (now - at));
  };
  return { member: left("member"), company: left("company"), shop: left("shop") };
}

export interface ThiefResult {
  /** success/caught = صورة، info = نص قصير */
  kind: "success" | "caught" | "info";
  place?: string;
  amount?: number;
  text?: string;
}

/** قائمة السرقة (!سرقة) كصورة، ولو فيه نتيجة تطلع صورة النتيجة بدالها */
export async function buildThiefMenu(userId: string, guildId: string, result?: ThiefResult): Promise<BaseMessageOptions> {
  const cd = await cooldowns(userId, guildId);
  const jail = await jailLeft(userId, guildId);
  const btn = (a: "member" | "company" | "shop", label: string) =>
    new ButtonBuilder().setCustomId(`co|thf|${userId}|${a}`).setLabel(label).setStyle(ButtonStyle.Danger).setDisabled(cd[a] > 0 || jail > 0);
  const components = [new ActionRowBuilder<ButtonBuilder>().addComponents(btn("member", "عضو عشوائي"), btn("company", "شركة عشوائية"), btn("shop", "محل صغير"))];
  if (jail > 0) components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`co|thf|${userId}|bail`).setLabel(`ادفع ${THIEF.jail.bail} واطلع`).setStyle(ButtonStyle.Success)));

  let png: Buffer | null = null;
  let name = "thief.png";
  if (jail > 0 && result?.kind !== "info") {
    png = await renderThiefJail(fmtMs(Math.max(MIN, jail)), THIEF.jail.bail);
    name = "thief-jail.png";
  } else if (result && result.kind !== "info") {
    png = await renderThiefResult(result.kind, result.place ?? "", result.amount ?? 0);
    name = "thief-result.png";
  }
  if (!png && !(result && result.kind === "info" && result.text)) {
    const rows = [
      { place: "عضو عشوائي", max: THIEF.member.max, wait: cd.member > 0 ? fmtMs(Math.max(MIN, cd.member)) : null },
      { place: "شركة عشوائية", max: THIEF.company.steal, wait: cd.company > 0 ? fmtMs(Math.max(MIN, cd.company)) : null },
      { place: "محل صغير", max: THIEF.shop.gain, wait: cd.shop > 0 ? fmtMs(Math.max(MIN, cd.shop)) : null },
    ];
    png = await renderThiefMenu(rows);
    name = "thief.png";
  }
  const embed = new EmbedBuilder().setColor(0x2c2f33);
  if (result?.kind === "info" && result.text) embed.setDescription(result.text);
  else if (png) embed.setImage(`attachment://${name}`);
  else embed.setTitle("اختر سرقتك").setDescription(`عضو عشوائي — حد أقصى ${jenny(THIEF.member.max)}\nشركة عشوائية — حد أقصى ${jenny(THIEF.company.steal)}\nمحل صغير — حد أقصى ${jenny(THIEF.shop.gain)}`);
  return { content: "", embeds: [embed], files: png ? [new AttachmentBuilder(png, { name })] : [], components };
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
  await ThiefState.updateOne({ userId, guildId }, { $inc: { total: amount }, $set: { caught: 0 } }, { upsert: true }).catch(() => undefined);
  await logTransaction(guildId, userId, "salary", amount);
}

/** ينفّذ السرقة ويرجع نص النتيجة */
export async function runThief(userId: string, guildId: string, action: ThiefAction, client?: Client): Promise<ThiefResult> {
  const info = (text: string): ThiefResult => ({ kind: "info", text });
  const jp = await getJob(userId, guildId);
  if (jp.jobId !== THIEF.jobId) return info("❌ هذي القائمة للحرامية فقط.");

  // كفالة: تدفع وتطلع من السجن
  if (action === "bail") {
    const left = await jailLeft(userId, guildId);
    if (left <= 0) return info("ما أنت مسجون.");
    const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: THIEF.jail.bail } }, { $inc: { coins: -THIEF.jail.bail } });
    if (!paid) return info(`❌ ما تكفي محفظتك للكفالة (${jenny(THIEF.jail.bail)}).`);
    await ThiefState.updateOne({ userId, guildId }, { $set: { jailUntil: null, caught: 0 } });
    return info(`دفعت كفالة ${jenny(THIEF.jail.bail)} وطلعت من السجن.`);
  }
  if (!ACTIONS.includes(action)) return info("❌ سرقة غير معروفة.");
  const jailed = await jailLeft(userId, guildId);
  if (jailed > 0) return info(`أنت مسجون! باقي ${fmtMs(Math.max(MIN, jailed))}، أو ادفع كفالة ${jenny(THIEF.jail.bail)}.`);

  // نضمن وجود سجل المهل ثم نحجز المهلة ذريًا
  await ThiefState.updateOne({ userId, guildId }, { $setOnInsert: { member: null, company: null, shop: null } }, { upsert: true }).catch(() => undefined);
  const now = Date.now();
  const before = await ThiefState.findOneAndUpdate(
    { userId, guildId, $or: [{ [action]: null }, { [action]: { $lte: new Date(now - COOLDOWN[action]) } }] },
    { $set: { [action]: new Date(now) } },
  );
  if (!before) {
    const cd = await cooldowns(userId, guildId);
    return info(`⏳ لازم تختفي شوي. هذي السرقة بعد ${fmtMs(Math.max(MIN, cd[action]))}.`);
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
        const gm = await client?.guilds.cache.get(guildId)?.members.fetch(c.userId).catch(() => null);
        return { kind: "success", place: gm?.displayName ?? "عضو", amount: take };
      }
    }
    await revert();
    return info("دورت وما لقيت عضو معه فلوس. جرّب بعدين (ما انحسبت عليك مهلة).");
  }

  /* ----- شركة عشوائية ----- */
  if (action === "company") {
    const [c] = await Company.aggregate<{ _id: unknown; name: string; budget: number }>([{ $match: { guildId } }, { $sample: { size: 1 } }, { $project: { name: 1, budget: 1 } }]);
    if (!c) {
      await revert();
      return info("ما فيه شركات في السيرفر الحين (ما انحسبت عليك مهلة).");
    }
    const cid = String(c._id);
    const guarded = await CompanyMember.exists({ companyId: cid, title: GUARD_TITLE, lastShiftAt: { $gte: new Date(Date.now() - THIEF.guardActiveMs) } });
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
      const st = await ThiefState.findOneAndUpdate({ userId, guildId }, { $inc: { caught: 1 } }, { new: true });
      if ((st?.caught ?? 0) >= THIEF.jail.catches) await ThiefState.updateOne({ userId, guildId }, { $set: { jailUntil: new Date(Date.now() + THIEF.jail.ms), caught: 0 } });
      await CompanyLog.create({ guildId, companyId: cid, text: `🛡️ حارس البوابة أمسك حرامي <@${userId}> وأخذنا تعويض ${jenny(paid)}.` }).catch(() => undefined);
      return { kind: "caught", place: c.name, amount: paid };
    }
    const take = Math.min(THIEF.company.steal, c.budget);
    const ok = take > 0 ? await Company.findOneAndUpdate({ _id: c._id, budget: { $gte: take } }, { $inc: { budget: -take } }) : null;
    if (!ok) {
      await revert();
      return info(`شركة **${c.name}** ما فيها فلوس تنسرق. جرّب بعدين (ما انحسبت عليك مهلة).`);
    }
    await payThief(userId, guildId, take);
    await CompanyLog.create({ guildId, companyId: cid, text: `حرامي سرق ${jenny(take)} من ميزانية الشركة (ما فيها حارس بوابة).` }).catch(() => undefined);
    return { kind: "success", place: c.name, amount: take };
  }

  /* ----- محل صغير ----- */
  await payThief(userId, guildId, THIEF.shop.gain);
  return { kind: "success", place: "محل صغير", amount: THIEF.shop.gain };
}
