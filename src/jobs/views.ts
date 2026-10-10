import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, type BaseMessageOptions } from "discord.js";
import { jenny } from "../constants";
import type { IJobProfile } from "../database/models/JobProfile";
import { JOBS, JOB_MAP, JOB_RULES } from "./data";
import { missingReqs, nextRankOf, type JobContext } from "./service";

export const JOB_APPLY = "job_apply";
export const JOB_WORK = "job_work";
export const JOB_PROMO = "job_promo";
export const JOB_QUIT = "job_quit";
export const JOB_QUIT_YES = "job_quityes";
export const JOB_HOME = "job_home";

export const jid = (base: string, owner: string): string => `${base}|${owner}`;
export const parseJid = (id: string): { base: string; ownerId: string } => {
  const [base, ownerId = ""] = id.split("|");
  return { base, ownerId };
};

export function fmtMs(ms: number): string {
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m} دقيقة`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ساعة و${rest} دقيقة` : `${h} ساعة`;
}

type View = BaseMessageOptions;

export function buildJobsPanel(owner: string, jp: IJobProfile, ctx: JobContext, note?: string): View {
  const job = JOB_MAP[jp.jobId];
  const lines: string[] = [];
  if (jp.notice) lines.push(jp.notice, "");
  if (note) lines.push(note, "");

  if (!job) {
    const blocked = jp.blockedUntil ? new Date(jp.blockedUntil).getTime() - Date.now() : 0;
    lines.push(`ما عندك وظيفة حاليًا. رسوم التقديم: ${jenny(JOB_RULES.applyFee)}`);
    if (blocked > 0) lines.push(`⏳ تقدر تقدّم على وظيفة جديدة بعد ${fmtMs(blocked)}.`);
    lines.push("");
    for (const j of JOBS) {
      const missing = missingReqs(j.req, ctx);
      const pay = j.kind === "career" ? `${j.ranks[0].pay}–${j.ranks[j.ranks.length - 1].pay} لكل دوام` : `${j.ranks[0].pay} للدوام الكامل (24 ساعة)`;
      lines.push(`${missing.length ? "🔒" : j.icon} **${j.name}** — ${pay}`, `> ${j.desc}${missing.length ? `\n> الشروط الناقصة: ${missing.join("، ")}` : ""}`);
    }
    const embed = new EmbedBuilder().setColor(0x3498db).setTitle("💼 الوظائف").setDescription(lines.join("\n"));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(jid(JOB_APPLY, owner))
      .setPlaceholder("قدّم على وظيفة")
      .addOptions(JOBS.map((j) => ({ label: j.name, value: j.id, emoji: missingReqs(j.req, ctx).length ? "🔒" : j.icon, description: j.kind === "career" ? "وظيفة مهنية بترقيات" : "دوام كامل 24 ساعة" })));
    return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
  }

  const rank = job.ranks[jp.rank] ?? job.ranks[0];
  lines.push(`${job.icon} **${job.name}** — ${rank.title}`, `الراتب: ${jenny(rank.pay)}${job.kind === "career" ? " لكل دوام" : " لكل 24 ساعة"}`, `الدوامات: **${jp.shifts}**`);

  const now = Date.now();
  if (job.kind === "career") {
    const last = jp.lastShiftAt ? new Date(jp.lastShiftAt).getTime() : 0;
    const wait = JOB_RULES.shiftCooldownMs - (now - last);
    if (wait > 0) {
      lines.push(`⏳ الدوام القادم بعد ${fmtMs(wait)}`);
    }
    const next = nextRankOf(jp);
    if (next) {
      const left = Math.max(0, next.shiftsNeeded - jp.shifts);
      lines.push(left > 0 ? `الترقية إلى **${next.title}** بعد ${left} دوام` : `✅ مؤهّل للترقية إلى **${next.title}**${next.labDiscoveries ? ` (يحتاج ${next.labDiscoveries} اكتشافًا في المختبر)` : ""}`);
    } else lines.push("🏆 وصلت لأعلى رتبة.");
  } else if (!jp.shiftStartedAt) {
    lines.push("اكتب `دوام` لتبدأ دوامك الكامل (24 ساعة).");
  } else {
    const endsAt = new Date(jp.shiftStartedAt).getTime() + JOB_RULES.fullDayMs;
    if (now < endsAt) {
      lines.push(`⏳ دوامك ينتهي بعد ${fmtMs(endsAt - now)}`);
    } else lines.push("✅ خلص دوامك! اكتب `دوام` لتستلم راتبك.");
  }
  lines.push("", "الأوامر: `دوام` • `ترقية` • `استقالة`", "_ما تداوم أسبوعًا = تنفصل من الوظيفة._");

  const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle("💼 وظيفتك").setDescription(lines.join("\n"));
  return { embeds: [embed], components: [] };
}

export function buildQuitConfirm(owner: string, jp: IJobProfile): View {
  const job = JOB_MAP[jp.jobId];
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🚪 تأكيد الاستقالة")
    .setDescription(`متأكد تبي تستقيل من **${job?.name ?? "وظيفتك"}**؟\nتخسر رتبتك ودوامك الحالي، وتنتظر 24 ساعة قبل ما تقدّم على وظيفة جديدة.`);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(jid(JOB_QUIT_YES, owner)).setLabel("نعم، استقيل").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(jid(JOB_HOME, owner)).setLabel("إلغاء").setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}
