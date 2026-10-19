import { MessageFlags, type ButtonInteraction, type Message, type StringSelectMenuInteraction } from "discord.js";
import { jenny } from "../constants";
import { applyForJob, clearNotice, getJob, loadContext, requestPromotion, resign, work, type PromoResult, type WorkResult } from "./service";
import { JOB_APPLY, JOB_HOME, JOB_PROMO, JOB_QUIT, JOB_QUIT_YES, JOB_WORK, buildJobsList, buildJobsPanel, buildMyJob, buildQuitConfirm, fmtMs, parseJid } from "./views";

export type JobAction = "panel" | "work" | "resign" | "promo";

/** أوامر الوظائف بالكتابة (كلها تبدأ بـ !). "!الوظائف" = قائمة الوظائف، "!وظيفتي" = وظيفتك */
export const JOBS_TRIGGER = /^!\s*(?:(?:ال)?وظائف|وظيفتي)$/;
export const WORK_TRIGGER = /^!\s*دوام$/;
export const RESIGN_TRIGGER = /^!\s*استقال[ةه]$/;
export const PROMO_TRIGGER = /^!\s*ترقي[ةه]$/;
const MINE_TRIGGER = /^!\s*وظيفتي$/;

const BASES = new Set([JOB_WORK, JOB_PROMO, JOB_QUIT, JOB_QUIT_YES, JOB_HOME]);

async function loadViewData(userId: string, guildId: string) {
  const [jp, ctx] = await Promise.all([getJob(userId, guildId), loadContext(userId, guildId)]);
  return { jp, ctx };
}

/** لوحة للأزرار والقوائم: وظيفتك لو عندك، وإلا قائمة الوظائف */
async function panel(userId: string, guildId: string, note?: string) {
  const { jp, ctx } = await loadViewData(userId, guildId);
  const view = buildJobsPanel(userId, jp, ctx, note);
  if (jp.notice) await clearNotice(userId, guildId);
  return view;
}

function workText(r: WorkResult): string {
  if (!r.ok) {
    if (r.reason === "no_job") return "❌ ما عندك وظيفة. اكتب `!الوظائف` وقدّم على وحدة.";
    if (r.reason === "cooldown") return `⏳ الدوام القادم بعد ${fmtMs(r.msLeft)}.`;
    return `⏳ دوامك مستمر، يخلص بعد ${fmtMs(r.msLeft)}.`;
  }
  if (r.kind === "started") return "🛠️ بدأت دوامك الكامل! ارجع بعد 24 ساعة واكتب `!دوام` لتستلم راتبك.";
  if (r.kind === "claimed") return r.accident ? ` تعرضت لإصابة في الدوام! استلمت ${jenny(r.pay)} فقط.` : ` خلص دوامك واستلمت ${jenny(r.pay)}.`;
  return `✅ داومت كـ **${r.rankTitle}** واستلمت ${jenny(r.pay)} (مجموع دوامك: ${r.shifts})\n سلسلة الدوام: **${r.streak}** يوم متتالي${r.promoReady ? "\n📈 صرت مؤهلًا للترقية! اكتب `!ترقية`." : ""}`;
}

function promoText(r: PromoResult): string {
  if (r.ok) return `🎉 تمت ترقيتك إلى **${r.title}**! راتبك الجديد ${jenny(r.pay)} + مكافأة ${jenny(r.bonus)}.\nسلسلة الدوام بدأت من جديد للرتبة اللي بعدها.`;
  switch (r.reason) {
    case "no_job":
      return "❌ ما عندك وظيفة فيها ترقيات.";
    case "max":
      return " أنت في أعلى رتبة.";
    case "not_ready":
      return ` ما وصلت بعد: سلسلة دوامك **${r.streak}/${r.need}** يوم متتالي.\n_تفوّت يوم = تبدأ من الصفر._`;
    case "discoveries":
      return ` تحتاج ${r.discoveriesLeft} اكتشافًا إضافيًا في المختبر.`;
  }
}

/** !الوظائف / !وظيفتي / !دوام / !استقاله / !ترقية */
export async function handleJobMessage(message: Message, kind: JobAction): Promise<void> {
  if (!message.inGuild()) return;
  const uid = message.author.id;
  const gid = message.guildId;
  const reply = (content: string) => message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => undefined);

  if (kind === "work") {
    await reply(workText(await work(uid, gid)));
    return;
  }
  if (kind === "resign") {
    const jp = await getJob(uid, gid);
    if (!jp.jobId) {
      await reply("❌ ما عندك وظيفة عشان تستقيل منها.");
      return;
    }
    await resign(uid, gid);
    await reply("🚪 استقلت من وظيفتك. تقدر تقدّم على وظيفة جديدة بعد 24 ساعة.");
    return;
  }
  if (kind === "promo") {
    await reply(promoText(await requestPromotion(uid, gid)));
    return;
  }

  const { jp, ctx } = await loadViewData(uid, gid);
  const view = MINE_TRIGGER.test(message.content.trim()) ? buildMyJob(jp) : buildJobsList(uid, jp, ctx);
  if (jp.notice) await clearNotice(uid, gid);
  await message.channel.send(view).catch(() => undefined);
}

export async function handleJobButton(i: ButtonInteraction): Promise<boolean> {
  const { base, ownerId } = parseJid(i.customId);
  if (!BASES.has(base)) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: "هذي مو وظيفتك. اكتب `!وظيفتي` لتفتح لوحتك.", flags: MessageFlags.Ephemeral });
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
  await i.update(await panel(uid, gid, promoText(await requestPromotion(uid, gid))));
  return true;
}

export async function handleJobSelect(i: StringSelectMenuInteraction): Promise<boolean> {
  const { base, ownerId } = parseJid(i.customId);
  if (base !== JOB_APPLY) return false;
  if (!i.inGuild()) return true;
  if (i.user.id !== ownerId) {
    await i.reply({ content: "هذي مو قائمتك. اكتب `!الوظائف` لتفتح قائمتك.", flags: MessageFlags.Ephemeral });
    return true;
  }
  const r = await applyForJob(i.user.id, i.guildId, i.values[0]);
  let note: string;
  if (r.ok) note = `🎉 تم قبولك في وظيفة **${r.job.name}**! اكتب \`!دوام\` لتبدأ.`;
  else if (r.reason === "reqs") note = `❌ ما تحقق الشروط: ${(r.missing ?? []).join("، ")}.`;
  else if (r.reason === "coins") note = "❌ رسوم التقديم ما تكفي في محفظتك.";
  else if (r.reason === "blocked") note = `⏳ تقدر تقدّم بعد ${fmtMs(r.msLeft ?? 0)}.`;
  else if (r.reason === "has_job") note = "❌ عندك وظيفة بالفعل. استقل أولًا.";
  else note = "❌ تعذّر التقديم.";
  const { jp, ctx } = await loadViewData(i.user.id, i.guildId);
  await i.update(buildJobsPanel(i.user.id, jp, ctx, note));
  return true;
}
