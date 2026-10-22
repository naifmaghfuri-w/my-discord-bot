import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, type BaseMessageOptions } from "discord.js";
import { jenny } from "../constants";
import type { IJobProfile } from "../database/models/JobProfile";
import { JOBS, JOB_MAP, JOB_RULES } from "./data";
import { currentStreak, nextRankOf, type JobContext } from "./service";

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

/** !الوظائف: قائمة الوظائف المتاحة مع شروطها + قائمة التقديم */
export function buildJobsList(owner: string, jp: IJobProfile, _ctx: JobContext, note?: string): View {
  const lines: string[] = [];
  if (jp.notice) lines.push(jp.notice, "");
  if (note) lines.push(note, "");

  const current = JOB_MAP[jp.jobId];
  if (current) {
    lines.push(`عندك وظيفة حاليًا: **${current.name}**. اكتب \`!استقاله\` إذا تبي تغيّرها.`, "");
  } else {
    lines.push(`رسوم التقديم: ${jenny(JOB_RULES.applyFee)}`);
    const blocked = jp.blockedUntil ? new Date(jp.blockedUntil).getTime() - Date.now() : 0;
    if (blocked > 0) lines.push(`⏳ تقدر تقدّم على وظيفة جديدة بعد ${fmtMs(blocked)}.`);
    lines.push("");
  }

  for (const j of JOBS) {
    const pay = j.kind === "thief" ? "من السرقة بأمر `!سرقة`" : j.kind === "career" ? `${j.ranks[0].pay}–${j.ranks[j.ranks.length - 1].pay} لكل دوام` : `${j.ranks[0].pay} للدوام الكامل (24 ساعة)`;
    lines.push(`${j.icon} **${j.name}** — ${pay}`, `> ${j.desc}`);
  }

  const embed = new EmbedBuilder().setColor(0x3498db).setTitle("💼 الوظائف").setDescription(lines.join("\n"));
  if (current) return { embeds: [embed], components: [] };

  const menu = new StringSelectMenuBuilder()
    .setCustomId(jid(JOB_APPLY, owner))
    .setPlaceholder("قدّم على وظيفة")
    .addOptions(
      JOBS.map((j) => ({
        label: j.name,
        value: j.id,
        emoji: j.icon,
        description: j.kind === "thief" ? "تسرق كل ساعة بأمر !سرقة" : j.kind === "career" ? "وظيفة مهنية بترقيات" : "دوام كامل 24 ساعة",
      })),
    );
  return { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
}

/** !وظيفتي: تفاصيل وظيفتك الحالية */
export function buildMyJob(jp: IJobProfile, note?: string): View {
  const job = JOB_MAP[jp.jobId];
  const lines: string[] = [];
  if (jp.notice) lines.push(jp.notice, "");
  if (note) lines.push(note, "");

  if (!job) {
    lines.push("ما عندك وظيفة حاليًا. اكتب `!الوظائف` وقدّم على وحدة.");
    const blocked = jp.blockedUntil ? new Date(jp.blockedUntil).getTime() - Date.now() : 0;
    if (blocked > 0) lines.push(`⏳ تقدر تقدّم على وظيفة جديدة بعد ${fmtMs(blocked)}.`);
    return { embeds: [new EmbedBuilder().setColor(0x95a5a6).setTitle("💼 وظيفتك").setDescription(lines.join("\n"))], components: [] };
  }

  const rank = job.ranks[jp.rank] ?? job.ranks[0];
  lines.push(
    job.kind === "thief" ? `${job.icon} **${job.name}**` : `${job.icon} **${job.name}** — ${rank.title}`,
    `الراتب: ${job.kind === "thief" ? "من السرقة" : `${jenny(rank.pay)}${job.kind === "career" ? " لكل دوام" : " لكل 24 ساعة"}`}`,
  );
  if (job.kind !== "thief") lines.push(`الدوامات: **${jp.shifts}**`);

  const now = Date.now();
  if (job.kind === "career") {
    const last = jp.lastShiftAt ? new Date(jp.lastShiftAt).getTime() : 0;
    const wait = JOB_RULES.shiftCooldownMs - (now - last);
    if (wait > 0) lines.push(`⏳ الدوام القادم بعد ${fmtMs(wait)}`);

    const next = nextRankOf(jp);
    if (next) {
      const need = JOB_RULES.promotionStreakDays;
      if ((jp.streakDays ?? 0) >= need) {
        lines.push(`✅ مؤهّل للترقية إلى **${next.title}** — اكتب \`!ترقية\``);
      } else {
        lines.push(`🔥 سلسلة الدوام: **${currentStreak(jp)}/${need}** يوم متتالي للترقية إلى **${next.title}**`, "_تفوّت يوم = تبدأ السلسلة من الصفر._");
      }
    } else {
      lines.push("🏆 وصلت لأعلى رتبة.");
    }
  } else if (job.kind === "thief") {
    lines.push("اكتب `!سرقة` لتختار سرقتك.");
  } else if (!jp.shiftStartedAt) {
    lines.push("اكتب `!دوام` لتبدأ دوامك الكامل (24 ساعة).");
  } else {
    const endsAt = new Date(jp.shiftStartedAt).getTime() + JOB_RULES.fullDayMs;
    if (now < endsAt) lines.push(`⏳ دوامك ينتهي بعد ${fmtMs(endsAt - now)}`);
    else lines.push("✅ خلص دوامك! اكتب `!دوام` لتستلم راتبك.");
  }
  if (job.kind !== "thief") lines.push("", "الأوامر: `!دوام` • `!ترقية` • `!استقاله`", "_ما تداوم أسبوعًا = تنفصل من الوظيفة._");

  const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle("💼 وظيفتك").setDescription(lines.join("\n"));
  return { embeds: [embed], components: [] };
}

/** لوحة الأزرار/القوائم: وظيفتك لو عندك، وإلا قائمة الوظائف */
export function buildJobsPanel(owner: string, jp: IJobProfile, ctx: JobContext, note?: string): View {
  return JOB_MAP[jp.jobId] ? buildMyJob(jp, note) : buildJobsList(owner, jp, ctx, note);
}

export function buildQuitConfirm(owner: string, jp: IJobProfile): View {
  const job = JOB_MAP[jp.jobId];
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🚪 تأكيد الاستقالة")
    .setDescription(`متأكد تبي تستقيل من **${job?.name ?? "وظيفتك"}**؟\nتخسر رتبتك وسلسلة دوامك، وتنتظر 24 ساعة قبل ما تقدّم على وظيفة جديدة.`);
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
