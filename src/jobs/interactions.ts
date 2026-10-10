import { MessageFlags, type ButtonInteraction, type Message, type StringSelectMenuInteraction } from "discord.js";
import { jenny } from "../constants";
import { applyForJob, clearNotice, getJob, loadContext, requestPromotion, resign, work, type WorkResult } from "./service";
import { JOB_APPLY, JOB_HOME, JOB_PROMO, JOB_QUIT, JOB_QUIT_YES, JOB_WORK, buildJobsPanel, buildQuitConfirm, fmtMs, parseJid } from "./views";

export const JOBS_TRIGGER = /^(وظائف|وظيفة|jobs?)$/i;
export const WORK_TRIGGER = /^(دوام|work)$/i;
export const RESIGN_TRIGGER = /^استقالة$/i;
export const PROMO_TRIGGER = /^(ترقية|اطلب ترقية|promotion)$/i;

const BASES = new Set([JOB_WORK, JOB_PROMO, JOB_QUIT, JOB_QUIT_YES, JOB_HOME]);

async function panel(userId: string, guildId: string, note?: string) {
  const [jp, ctx] = await Promise.all([getJob(userId, guildId), loadContext(userId, guildId)]);
  const view = buildJobsPanel(userId, jp, ctx, note);
  if (jp.notice) await clearNotice(userId, guildId);
  return view;
}

function workText(r: WorkResult): string {
  if (!r.ok) {
    if (r.reason === "no_job") return "❌ ما عندك وظيفة. اكتب `وظائف` وقدّم على وحدة.";
    if (r.reason === "cooldown") return `⏳ تعبت! الدوام القادم بعد ${fmtMs(r.msLeft)}.`;
    return `⏳ دوامك مستمر، يخلص بعد ${fmtMs(r.msLeft)}.`;
  }
  if (r.kind === "started") return "🛠️ بدأت دوامك الكامل! ارجع بعد 24 ساعة واكتب `دوام` لتستلم راتبك.";
  if (r.kind === "claimed")
    return r.accident ? `🤕 تعرضت لإصابة في الدوام! استلمت ${jenny(r.pay)} فقط.` : `✅ خلص دوامك واستلمت ${jenny(r.pay)}.`;
  return `✅ داومت كـ **${r.rankTitle}** واستلمت ${jenny(r.pay)} (مجموع دوامك: ${r.shifts})${r.promoReady ? "\n📈 صرت مؤهلًا للترقية! اكتب `ترقية`." : ""}`;
}

/** "وظائف" / "دوام" / "استقالة" بالكتابة */
export async function handleJobMessage(message: Message, kind: "panel" | "work" | "resign" | "promo"): Promise<void> {
  if (!message.inGuild()) return;
  const uid = message.author.id;
  const gid = message.guildId;
  if (kind === "work") {
    const r = await work(uid, gid);
    await message.reply({ content: workText(r), allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  if (kind === "resign") {
    const jp = await getJob(uid, gid);
    if (!jp.jobId) {
      await message.reply("❌ ما عندك وظيفة عشان تستقيل منها.").catch(() => undefined);
      return;
    }
    await resign(uid, gid);
    await message.reply({ content: "🚪 استقلت من وظيفتك. تقدر تقدّم على وظيفة جديدة بعد 24 ساعة.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  if (kind === "promo") {
    const r = await requestPromotion(uid, gid);
    const text = r.ok
      ? `🎉 تمت ترقيتك إلى **${r.title}**! راتبك الجديد ${jenny(r.pay)} + مكافأة ${jenny(r.bonus)}.`
      : r.reason === "no_job" ? "❌ ما عندك وظيفة فيها ترقيات."
      : r.reason === "max" ? "🏆 أنت في أعلى رتبة."
      : r.reason === "not_ready" ? `ما وصلت بعد، باقي ${r.shiftsLeft ?? 0} دوام.`
      : `تحتاج ${r.need} اكتشافًا إضافيًا في المختبر.`;
    await message.reply({ content: text, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message.channel.send(await panel(uid, gid)).catch(() => undefined);
}

export async function handleJobButton(i: ButtonInteraction): Promise<boolean> {
  const { base, ownerId } = parseJid(i.customId);
  if (!BASES.has(base)) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: "هذي مو وظيفتك. اكتب `وظائف` لتفتح لوحتك.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const uid = i.user.id;
  const gid = i.guildId;

  if (base === JOB_HOME) return (await i.update(await panel(uid, gid)), true);
  if (base === JOB_QUIT) {
    const jp = await getJob(uid, gid);
    if (!jp.jobId) return (await i.update(await panel(uid, gid)), true);
    return (await i.update(buildQuitConfirm(uid, jp)), true);
  }
  if (base === JOB_QUIT_YES) {
    const ok = await resign(uid, gid);
    return (await i.update(await panel(uid, gid, ok ? "🚪 استقلت من وظيفتك." : undefined)), true);
  }
  if (base === JOB_WORK) {
    const r = await work(uid, gid);
    return (await i.update(await panel(uid, gid, workText(r))), true);
  }
  // JOB_PROMO
  const r = await requestPromotion(uid, gid);
  const note = r.ok
    ? `🎉 تمت ترقيتك إلى **${r.title}**! راتبك الجديد ${jenny(r.pay)} + مكافأة ${jenny(r.bonus)}.`
    : r.reason === "max" ? "🏆 أنت في أعلى رتبة."
    : r.reason === "not_ready" ? `ما وصلت بعد، باقي ${r.shiftsLeft ?? 0} دوام.`
    : r.reason === "discoveries" ? `تحتاج ${r.need} اكتشافًا إضافيًا في المختبر.`
    : "ما تقدر تطلب ترقية.";
  await i.update(await panel(uid, gid, note));
  return true;
}

export async function handleJobSelect(i: StringSelectMenuInteraction): Promise<boolean> {
  const { base, ownerId } = parseJid(i.customId);
  if (base !== JOB_APPLY) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: "هذي مو قائمتك. اكتب `وظائف` لتفتح قائمتك.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const r = await applyForJob(i.user.id, i.guildId, i.values[0]);
  let note: string;
  if (r.ok) note = `🎉 تم قبولك في وظيفة **${r.job.name}**! اكتب \`دوام\` لتبدأ.`;
  else if (r.reason === "reqs") note = `❌ ما تحقق الشروط: ${(r.missing ?? []).join("، ")}.`;
  else if (r.reason === "coins") note = "❌ رسوم التقديم ما تكفي في محفظتك.";
  else if (r.reason === "blocked") note = `⏳ تقدر تقدّم بعد ${fmtMs(r.msLeft ?? 0)}.`;
  else if (r.reason === "has_job") note = "❌ عندك وظيفة بالفعل. استقل أولًا.";
  else note = "❌ تعذّر التقديم.";
  const [jp, ctx] = await Promise.all([getJob(i.user.id, i.guildId), loadContext(i.user.id, i.guildId)]);
  await i.update(buildJobsPanel(i.user.id, jp, ctx, note));
  return true;
}
