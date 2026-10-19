import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
  type BaseMessageOptions, type ButtonInteraction, type Interaction, type Message, type ModalSubmitInteraction, type StringSelectMenuInteraction,
} from "discord.js";
import { jenny } from "../constants";
import { Company, CompanyApplication, CompanyMember, CompanyPosting, type ICompany, type ICompanyMember } from "../database/models/Company";
import { UserProfile } from "../database/models/UserProfile";
import { JOBS } from "../jobs/data";
import { buildJobsPanel, fmtMs } from "../jobs/views";
import { clearNotice, getJob, loadContext } from "../jobs/service";
import { logTransaction } from "../services/transactions";

/* ───────────── الثوابت ───────────── */

export const COMPANY_RULES = {
  openCost: 10_000,
  shiftCooldownMs: 3 * 60 * 60 * 1000,
  payrollMs: 24 * 60 * 60 * 1000,
  shiftGainEmployee: 100, // يضاف لميزانية الشركة بكل دوام موظف
  shiftGainOfficial: 200, // دوام المسؤول/المالك
  maxSlots: 20,
  maxSalary: 10_000,
} as const;

/** !وظائف / !الوظائف */
export const COMPANY_HUB_TRIGGER = /^!\s*(?:ال)?وظائف$/;
/** !شركتي */
export const COMPANY_MINE_TRIGGER = /^!\s*شركتي$/;

const COLOR = 0x3498db;
const ROLE_NAME = { owner: "👑 المالك", official: "🛡️ مسؤول", employee: "👷 موظف" } as const;
type View = BaseMessageOptions;

const eph = { flags: MessageFlags.Ephemeral } as const;
const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function num(s: string): number {
  const t = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/[^\d]/g, "");
  return t ? Number(t) : NaN;
}
const idOf = (d: { _id: unknown }): string => String(d._id);
const mention = (id: string): string => `<@${id}>`;

/* ───────────── الخدمة ───────────── */

async function myMembership(guildId: string, userId: string) {
  return CompanyMember.findOne({ guildId, userId });
}
async function payrollTotal(companyId: string): Promise<number> {
  const rows = await CompanyMember.find({ companyId }, { salary: 1 });
  return rows.reduce((s, m) => s + (m.salary ?? 0), 0);
}
const isBoss = (m: { role: string } | null | undefined): boolean => m?.role === "owner" || m?.role === "official";

function canManage(actor: ICompanyMember, target: ICompanyMember): boolean {
  if (actor.userId === target.userId || target.role === "owner") return false;
  if (actor.role === "owner") return true;
  return actor.role === "official" && target.role === "employee";
}

async function hasRegularJob(guildId: string, userId: string): Promise<boolean> {
  const jp = await getJob(userId, guildId);
  return Boolean(jp.jobId);
}

async function openCompany(guildId: string, userId: string, name: string): Promise<{ ok: true; company: ICompany & { _id: unknown } } | { ok: false; msg: string }> {
  if (await myMembership(guildId, userId)) return { ok: false, msg: "❌ أنت عضو في شركة بالفعل. اخرج منها أو بعها أولًا." };
  if (await Company.findOne({ guildId, name })) return { ok: false, msg: "❌ يوجد شركة بنفس الاسم." };
  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: COMPANY_RULES.openCost } }, { $inc: { coins: -COMPANY_RULES.openCost } });
  if (!paid) return { ok: false, msg: `❌ فتح الشركة يكلّف ${jenny(COMPANY_RULES.openCost)} وما تكفي محفظتك.` };
  try {
    const company = await Company.create({ guildId, name, ownerId: userId });
    await CompanyMember.create({ guildId, companyId: idOf(company), userId, role: "owner", title: "المالك", salary: 0 });
    await logTransaction(guildId, userId, "job_fee", COMPANY_RULES.openCost);
    return { ok: true, company };
  } catch {
    await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: COMPANY_RULES.openCost } });
    return { ok: false, msg: "❌ تعذّر فتح الشركة (اسم مكرر أو عندك شركة)." };
  }
}

async function dissolveCompany(company: ICompany & { _id: unknown }, splitBudget: boolean): Promise<void> {
  const cid = idOf(company);
  const fresh = await Company.findOneAndDelete({ _id: company._id });
  const members = await CompanyMember.find({ companyId: cid });
  const staff = members.filter((m) => m.role !== "owner");
  const pot = fresh?.budget ?? 0;
  if (splitBudget && pot > 0 && staff.length > 0) {
    const share = Math.floor(pot / staff.length);
    if (share > 0) for (const m of staff) await UserProfile.updateOne({ userId: m.userId, guildId: m.guildId }, { $inc: { coins: share } }, { upsert: true });
  }
  await CompanyMember.deleteMany({ companyId: cid });
  await CompanyApplication.deleteMany({ companyId: cid });
  await CompanyPosting.updateMany({ companyId: cid }, { $set: { open: false } });
}

/** دوام الشركة: يضيف لميزانية الشركة */
async function companyShift(guildId: string, userId: string): Promise<string | null> {
  const m = await myMembership(guildId, userId);
  if (!m) return null;
  const cutoff = new Date(Date.now() - COMPANY_RULES.shiftCooldownMs);
  const upd = await CompanyMember.findOneAndUpdate({ _id: m._id, $or: [{ lastShiftAt: null }, { lastShiftAt: { $lte: cutoff } }] }, { $set: { lastShiftAt: new Date() } });
  if (!upd) {
    const last = m.lastShiftAt ? new Date(m.lastShiftAt).getTime() : 0;
    return `⏳ الدوام القادم بعد ${fmtMs(Math.max(60_000, COMPANY_RULES.shiftCooldownMs - (Date.now() - last)))}.`;
  }
  const gain = isBoss(m) ? COMPANY_RULES.shiftGainOfficial : COMPANY_RULES.shiftGainEmployee;
  const c = await Company.findOneAndUpdate({ _id: m.companyId }, { $inc: { budget: gain } }, { new: true });
  return `🏢 داومت في **${c?.name ?? "الشركة"}** كـ **${m.title}** وأضفت ${jenny(gain)} لميزانية الشركة.\nراتبك اليومي (${jenny(m.salary)}) يوصلك من الميزانية إذا داومت قبل موعد الرواتب.`;
}

/** رواتب يومية: تُوزّع من ميزانية كل شركة على من داوم منذ آخر توزيع (الأعلى راتبًا أولًا) */
export async function runPayroll(): Promise<void> {
  const due = await Company.find({ lastPayrollAt: { $lte: new Date(Date.now() - COMPANY_RULES.payrollMs) } });
  for (const c of due) {
    try {
      const since = new Date(c.lastPayrollAt);
      const claimed = await Company.findOneAndUpdate({ _id: c._id, lastPayrollAt: c.lastPayrollAt }, { $set: { lastPayrollAt: new Date() } });
      if (!claimed) continue;
      const members = await CompanyMember.find({ companyId: idOf(c), salary: { $gt: 0 } }).sort({ salary: -1 });
      for (const m of members) {
        const active = m.lastShiftAt && new Date(m.lastShiftAt) > since;
        if (!active) continue;
        const net = Math.max(0, m.salary - (m.penalty ?? 0));
        await CompanyMember.updateOne({ _id: m._id }, { $set: { penalty: 0 } });
        if (net <= 0) continue;
        const ok = await Company.findOneAndUpdate({ _id: c._id, budget: { $gte: net } }, { $inc: { budget: -net } });
        if (!ok) break; // الميزانية خلصت
        await UserProfile.updateOne({ userId: m.userId, guildId: m.guildId }, { $inc: { coins: net } }, { upsert: true });
        await logTransaction(m.guildId, m.userId, "salary", net);
      }
    } catch {
      /* نكمل بالشركات الباقية */
    }
  }
}

let payrollTimer: ReturnType<typeof setInterval> | null = null;
/** استدعها مرة وحدة من ready.ts */
export function startCompanyPayroll(): void {
  if (payrollTimer) return;
  setTimeout(() => void runPayroll(), 60_000);
  payrollTimer = setInterval(() => void runPayroll(), 30 * 60_000);
}

/* ───────────── الواجهات ───────────── */

const btn = (id: string, label: string, style = ButtonStyle.Secondary, emoji?: string) => {
  const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
  if (emoji) b.setEmoji(emoji);
  return b;
};
const row = (...b: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);

async function buildHub(guildId: string): Promise<View> {
  const postings = await CompanyPosting.find({ guildId, open: true }).limit(40);
  const companies = await Company.countDocuments({ guildId });
  const regular = JOBS.map((j) => `${j.icon} **${j.name}** — ${j.kind === "career" ? `${j.ranks[0].pay}–${j.ranks[j.ranks.length - 1].pay} لكل دوام` : `${j.ranks[0].pay} للدوام الكامل`}`);
  const corp = postings.length
    ? postings.slice(0, 8).map((p) => `🏢 **${p.title}** — ${jenny(p.salary)} يوميًا (${p.slots - p.filled}/${p.slots} متاح)`)
    : ["ما فيه وظائف شركات مفتوحة الحين."];
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("💼 الوظائف")
    .addFields(
      { name: "القائمة الأولى — وظائف عادية", value: regular.join("\n") },
      { name: `القائمة الثانية — وظائف شركات السيرفر (${companies} شركة)`, value: corp.join("\n") },
    )
    .setFooter({ text: `تقدر تفتح شركتك بـ ${COMPANY_RULES.openCost.toLocaleString("en-US")} من محفظتك` });
  return {
    embeds: [embed],
    components: [
      row(btn("co|reg", "الوظائف العادية", ButtonStyle.Primary, "💼"), btn("co|list", "وظائف الشركات", ButtonStyle.Primary, "🏢")),
      row(btn("co|open", "فتح شركة", ButtonStyle.Success, "🏗️"), btn("co|mine", "شركتي", ButtonStyle.Secondary, "📋")),
    ],
  };
}

async function buildPostingsList(guildId: string): Promise<View> {
  const postings = await CompanyPosting.find({ guildId, open: true }).limit(20);
  const lines: string[] = [];
  for (const p of postings) {
    const c = await Company.findById(p.companyId, { name: 1 });
    const link = p.channelId && p.messageId ? `https://discord.com/channels/${guildId}/${p.channelId}/${p.messageId}` : "";
    lines.push(`🏢 **${p.title}** في **${c?.name ?? "?"}** — ${jenny(p.salary)} يوميًا • متاح ${p.slots - p.filled}/${p.slots}${link ? ` • [اذهب للتقديم](${link})` : ""}`);
  }
  return { embeds: [new EmbedBuilder().setColor(COLOR).setTitle("🏢 وظائف الشركات").setDescription(lines.join("\n") || "ما فيه وظائف مفتوحة الحين.")], components: [] };
}

async function buildCompanyPanel(guildId: string, userId: string, note?: string): Promise<View> {
  const m = await myMembership(guildId, userId);
  if (!m) {
    return { content: "ما عندك شركة. اكتب `!وظائف` ثم اضغط «فتح شركة»، أو قدّم على طلب توظيف.", embeds: [], components: [] };
  }
  const c = await Company.findById(m.companyId);
  if (!c) return { content: "تعذّر إيجاد الشركة.", embeds: [], components: [] };
  const cid = idOf(c);
  const members = await CompanyMember.find({ companyId: cid }).sort({ salary: -1 });
  const payroll = members.reduce((s, x) => s + x.salary, 0);
  const lines = members.slice(0, 15).map((x) => `${ROLE_NAME[x.role]} ${mention(x.userId)} — ${x.title} • ${jenny(x.salary)}`);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`🏢 ${c.name}`)
    .setDescription(
      [
        note ?? "",
        `💰 الميزانية: ${jenny(c.budget)}`,
        `🧾 رواتب اليوم الكاملة: ${jenny(payroll)}`,
        `👥 الأعضاء: **${members.length}**`,
        "",
        `أنت: ${ROLE_NAME[m.role]} — **${m.title}** (${jenny(m.salary)} يوميًا)`,
        "",
        lines.join("\n"),
      ].filter((x, i) => x !== "" || i > 0).join("\n"),
    );
  const rows: ActionRowBuilder<ButtonBuilder>[] = [row(btn(`co|work|${cid}`, "دوام", ButtonStyle.Success, "🛠️"))];
  if (isBoss(m)) {
    rows.push(row(btn(`co|post|${cid}`, "طلب توظيف", ButtonStyle.Primary, "📢"), btn(`co|mng|${cid}`, "إدارة الموظفين", ButtonStyle.Secondary, "👥")));
  }
  if (m.role === "owner") rows.push(row(btn(`co|sell|${cid}`, "بيع الشركة", ButtonStyle.Secondary, "🤝"), btn(`co|close|${cid}`, "إغلاق الشركة", ButtonStyle.Danger, "🔒")));
  else rows.push(row(btn(`co|leave|${cid}`, "استقالة من الشركة", ButtonStyle.Danger, "🚪")));
  return { embeds: [embed], components: rows };
}

function memberCard(c: ICompany, t: ICompanyMember, actor: ICompanyMember, cid: string, note?: string): View {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`👤 ${t.title}`)
    .setDescription([note ?? "", `${ROLE_NAME[t.role]} ${mention(t.userId)}`, `الراتب اليومي: ${jenny(t.salary)}`, `خصم قادم: ${jenny(t.penalty ?? 0)}`, `ميزانية الشركة: ${jenny(c.budget)}`].filter(Boolean).join("\n"));
  const rows = [
    row(
      btn(`co|pen|${cid}|${t.userId}`, "خصم", ButtonStyle.Secondary, "➖"),
      btn(`co|raise|${cid}|${t.userId}`, "زيادة راتب", ButtonStyle.Secondary, "➕"),
      btn(`co|promo|${cid}|${t.userId}`, "ترقية", ButtonStyle.Primary, "📈"),
      btn(`co|fire|${cid}|${t.userId}`, "فصل", ButtonStyle.Danger, "🥾"),
    ),
  ];
  if (actor.role === "owner") rows.push(row(btn(`co|offc|${cid}|${t.userId}`, t.role === "official" ? "سحب المسؤولية" : "تعيين مسؤول", ButtonStyle.Secondary, "🛡️")));
  return { embeds: [embed], components: rows };
}

function postingEmbed(company: ICompany, p: { title: string; slots: number; filled: number; salary: number }, ranks: string, open: boolean): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(open ? 0x2ecc71 : 0x95a5a6)
    .setTitle(`📢 طلب توظيف — ${company.name}`)
    .setDescription(
      [`**الوظيفة:** ${p.title}`, `**الراتب اليومي:** ${jenny(p.salary)}`, `**المقاعد:** ${p.filled}/${p.slots}`, ranks ? `**الرتب:** ${ranks}` : "", open ? "اضغط «تقديم» وعبّي طلبك." : "🔒 اكتمل التوظيف."].filter(Boolean).join("\n"),
    );
}

const input = (id: string, label: string, ph?: string, style = TextInputStyle.Short, required = true, max = 100) => {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
  if (ph) t.setPlaceholder(ph);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(t);
};
const modal = (id: string, title: string, ...rows: ActionRowBuilder<TextInputBuilder>[]) => new ModalBuilder().setCustomId(id).setTitle(title).addComponents(...rows);

/* ───────────── الرسائل النصية ───────────── */

/** !وظائف / !شركتي */
export async function handleCompanyMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const text = message.content.trim();
  const view = COMPANY_MINE_TRIGGER.test(text) ? await buildCompanyPanel(message.guildId, message.author.id) : await buildHub(message.guildId);
  await message.channel.send(view).catch(() => undefined);
}

/** !دوام / !استقاله: لو أنت عضو شركة تُعالج هنا (ترجع true)، وإلا تكمل للوظائف العادية */
export async function handleCompanyWorkMessage(message: Message, kind: "work" | "resign"): Promise<boolean> {
  if (!message.inGuild()) return false;
  const m = await myMembership(message.guildId, message.author.id);
  if (!m) return false;
  const reply = (content: string) => message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => undefined);
  if (kind === "work") {
    await reply((await companyShift(message.guildId, message.author.id)) ?? "❌ تعذّر الدوام.");
    return true;
  }
  if (m.role === "owner") {
    await reply("👑 أنت مالك الشركة: بعها أو أغلقها من `!شركتي`.");
    return true;
  }
  await CompanyMember.deleteOne({ _id: m._id });
  await reply("🚪 استقلت من الشركة.");
  return true;
}

/* ───────────── التفاعلات ───────────── */

export async function handleCompanyInteraction(i: Interaction): Promise<boolean> {
  if (!(i.isButton() || i.isModalSubmit() || i.isStringSelectMenu())) return false;
  if (!i.customId.startsWith("co|")) return false;
  if (!i.inGuild()) return true;
  try {
    await route(i);
  } catch {
    if (!i.replied && !i.deferred) await i.reply({ content: "⚠️ صار خطأ، حاول مرة ثانية.", ...eph }).catch(() => undefined);
  }
  return true;
}

type AnyI = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

async function ctxOf(i: AnyI, cid: string) {
  const guildId = i.guildId as string;
  const company = await Company.findOne({ _id: cid, guildId });
  const me = company ? await CompanyMember.findOne({ companyId: cid, userId: i.user.id }) : null;
  return { guildId, company, me };
}

async function route(i: AnyI): Promise<void> {
  const [, act, a, b] = i.customId.split("|");
  const guildId = i.guildId as string;
  const uid = i.user.id;
  const say = (content: string) => i.reply({ content, ...eph });

  /* --- اللوحة الرئيسية --- */
  if (act === "reg" && i.isButton()) {
    const [jp, ctx] = await Promise.all([getJob(uid, guildId), loadContext(uid, guildId)]);
    const view = buildJobsPanel(uid, jp, ctx);
    if (jp.notice) await clearNotice(uid, guildId);
    await i.reply({ ...view, ...eph });
    return;
  }
  if (act === "list" && i.isButton()) return void (await i.reply({ ...(await buildPostingsList(guildId)), ...eph }));
  if (act === "mine" && i.isButton()) return void (await i.reply({ ...(await buildCompanyPanel(guildId, uid)), ...eph }));
  if (act === "open" && i.isButton()) {
    await i.showModal(modal("co|openm", "فتح شركة", input("name", `اسم الشركة (الكلفة ${COMPANY_RULES.openCost})`, "مثال: شركة النجوم", TextInputStyle.Short, true, 40)));
    return;
  }
  if (act === "openm" && i.isModalSubmit()) {
    const name = i.fields.getTextInputValue("name").trim();
    if (!name) return void (await say("❌ اكتب اسم الشركة."));
    const r = await openCompany(guildId, uid, name);
    if (r.ok === false) return void (await say(r.msg));
    await i.reply({ ...(await buildCompanyPanel(guildId, uid, `🎉 تم فتح **${name}** (خصمنا ${jenny(COMPANY_RULES.openCost)}). ابدأ بنشر طلب توظيف.`)), ...eph });
    return;
  }

  /* --- التقديم: زر في الطلب ← نموذج ← رسالة قبول/رفض في نفس الروم --- */
  if (act === "apply" && i.isButton()) {
    const p = await CompanyPosting.findById(a);
    if (!p || !p.open) return void (await say("🔒 هذا الطلب مغلق."));
    await i.showModal(modal(`co|applym|${a}`, "تقديم على وظيفة", input("about", "عرّف بنفسك", "خبرتك، ليش تستاهل الوظيفة؟", TextInputStyle.Paragraph, true, 400)));
    return;
  }
  if (act === "applym" && i.isModalSubmit()) {
    const p = await CompanyPosting.findById(a);
    if (!p || !p.open || p.filled >= p.slots) return void (await say("🔒 هذا الطلب مغلق."));
    if (await myMembership(guildId, uid)) return void (await say("❌ أنت عضو في شركة بالفعل."));
    if (await hasRegularJob(guildId, uid)) return void (await say("❌ عندك وظيفة عادية. استقل منها أولًا بـ `!استقاله`."));
    const c = await Company.findById(p.companyId);
    if (!c) return void (await say("❌ الشركة ما عادت موجودة."));
    const about = i.fields.getTextInputValue("about").trim();
    let app;
    try {
      app = await CompanyApplication.create({ guildId, postingId: a, companyId: p.companyId, userId: uid, about });
    } catch {
      return void (await say("⏳ طلبك السابق ما زال قيد المراجعة."));
    }
    const embed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle("📝 طلب تقديم جديد")
      .setDescription(`${mention(uid)} يقدّم على **${p.title}** في **${c.name}** (${jenny(p.salary)} يوميًا)\n\n> ${about}`);
    const target = (i.channel && "send" in i.channel ? i.channel : null) ?? null;
    if (!target) return void (await say("❌ تعذّر نشر طلبك هنا."));
    await i.deferUpdate().catch(() => undefined);
    const sent = await target
      .send({ content: `<@${c.ownerId}>`, embeds: [embed], components: [row(btn(`co|acc|${idOf(app)}`, "قبول", ButtonStyle.Success, "✅"), btn(`co|rej|${idOf(app)}`, "رفض", ButtonStyle.Danger, "❌"))], allowedMentions: { users: [c.ownerId] } })
      .catch(() => null);
    if (!sent) await CompanyApplication.deleteOne({ _id: app._id });
    return;
  }
  if ((act === "acc" || act === "rej") && i.isButton()) {
    const app = await CompanyApplication.findById(a);
    if (!app) return void (await i.update({ content: "تمت معالجة هذا الطلب.", embeds: [], components: [] }));
    const boss = await CompanyMember.findOne({ companyId: app.companyId, userId: uid });
    if (!isBoss(boss)) return void (await say("❌ فقط المالك أو مسؤولو الشركة يقررون."));
    const claimed = await CompanyApplication.findOneAndDelete({ _id: app._id });
    if (!claimed) return void (await i.update({ content: "تمت معالجة هذا الطلب.", embeds: [], components: [] }));
    if (act === "rej") {
      await i.update({ content: `❌ ${mention(uid)} رفض طلب ${mention(app.userId)}.`, embeds: [], components: [], allowedMentions: { users: [] } });
      return;
    }
    const p = await CompanyPosting.findOneAndUpdate({ _id: app.postingId, open: true, $expr: { $lt: ["$filled", "$slots"] } }, { $inc: { filled: 1 } }, { new: true });
    if (!p) return void (await i.update({ content: "🔒 المقاعد اكتملت قبل قبول هذا الطلب.", embeds: [], components: [] }));
    try {
      await CompanyMember.create({ guildId, companyId: app.companyId, userId: app.userId, role: "employee", title: p.title, salary: p.salary });
    } catch {
      await CompanyPosting.updateOne({ _id: p._id }, { $inc: { filled: -1 } });
      return void (await i.update({ content: `⚠️ ${mention(app.userId)} صار عضو في شركة ثانية.`, embeds: [], components: [], allowedMentions: { users: [] } }));
    }
    if (p.filled >= p.slots) await closePosting(i, p);
    await i.update({ content: `✅ ${mention(uid)} قبل ${mention(app.userId)} في وظيفة **${p.title}** (${jenny(p.salary)} يوميًا). مبروك!`, embeds: [], components: [], allowedMentions: { users: [app.userId] } });
    return;
  }

  /* --- دوام / استقالة --- */
  if (act === "work" && i.isButton()) {
    const r = await companyShift(guildId, uid);
    return void (await i.reply({ content: r ?? "❌ ما أنت عضو في شركة.", ...eph }));
  }
  if (act === "leave" && i.isButton()) {
    return void (await i.reply({ content: "متأكد تبي تستقيل من الشركة؟", components: [row(btn(`co|leavey|${a}`, "نعم، استقيل", ButtonStyle.Danger), btn("co|cancel", "إلغاء"))], ...eph }));
  }
  if (act === "cancel" && i.isButton()) return void (await i.update({ content: "تم الإلغاء.", components: [] }));
  if (act === "leavey" && i.isButton()) {
    const m = await myMembership(guildId, uid);
    if (!m || m.role === "owner") return void (await i.update({ content: "❌ ما تقدر.", components: [] }));
    await CompanyMember.deleteOne({ _id: m._id });
    return void (await i.update({ content: "🚪 استقلت من الشركة.", components: [] }));
  }

  /* --- نشر طلب توظيف --- */
  if (act === "post" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!isBoss(me)) return void (await say("❌ فقط المالك أو المسؤولون."));
    await i.showModal(
      modal(
        `co|postm|${a}`,
        "طلب توظيف",
        input("title", "المسمى الوظيفي", "مثال: محاسب", TextInputStyle.Short, true, 40),
        input("slots", `عدد الموظفين (1-${COMPANY_RULES.maxSlots})`, "3", TextInputStyle.Short, true, 3),
        input("salary", "الراتب اليومي", "300", TextInputStyle.Short, true, 6),
        input("ranks", "الرتب الأعلى للترقية (اختياري)", "مشرف:500، مدير:800", TextInputStyle.Paragraph, false, 200),
      ),
    );
    return;
  }
  if (act === "postm" && i.isModalSubmit()) {
    const { company, me } = await ctxOf(i, a);
    if (!company || !isBoss(me)) return void (await say("❌ فقط المالك أو المسؤولون."));
    const title = i.fields.getTextInputValue("title").trim();
    const slots = num(i.fields.getTextInputValue("slots"));
    const salary = num(i.fields.getTextInputValue("salary"));
    if (!title || !(slots >= 1 && slots <= COMPANY_RULES.maxSlots)) return void (await say(`❌ العدد لازم بين 1 و ${COMPANY_RULES.maxSlots}.`));
    if (!(salary >= 1 && salary <= COMPANY_RULES.maxSalary)) return void (await say(`❌ الراتب لازم بين 1 و ${COMPANY_RULES.maxSalary}.`));
    const positions = new Map(company.positions.map((p) => [p.title, p.salary] as const));
    positions.set(title, salary);
    const ranksRaw = i.fields.getTextInputValue("ranks") ?? "";
    const shown: string[] = [];
    for (const part of ranksRaw.split(/[،,\n]+/)) {
      const [t, s] = part.split(/[:：]/);
      const rs = num(s ?? "");
      if (t?.trim() && rs >= 1 && rs <= COMPANY_RULES.maxSalary) {
        positions.set(t.trim(), rs);
        shown.push(`${t.trim()} (${rs})`);
      }
    }
    await Company.updateOne({ _id: company._id }, { $set: { positions: [...positions].map(([t, s]) => ({ title: t, salary: s })) } });
    const posting = await CompanyPosting.create({ guildId, companyId: a, title, slots, salary });
    const ch = i.channel;
    if (!ch || !("send" in ch)) return void (await say("❌ تعذّر النشر في هذا الروم."));
    const sent = await ch
      .send({ embeds: [postingEmbed(company, { title, slots, filled: 0, salary }, shown.join("، "), true)], components: [row(btn(`co|apply|${idOf(posting)}`, "تقديم", ButtonStyle.Success, "📝"))] })
      .catch(() => null);
    if (!sent) {
      await CompanyPosting.deleteOne({ _id: posting._id });
      return void (await say("❌ ما قدرت أنشر الطلب (صلاحيات الروم؟)."));
    }
    await CompanyPosting.updateOne({ _id: posting._id }, { $set: { channelId: sent.channelId, messageId: sent.id } });
    await i.reply({ content: "✅ تم نشر طلب التوظيف في هذا الروم. الطلبات تظهر هنا بأزرار قبول/رفض.", ...eph });
    return;
  }

  /* --- إدارة الموظفين --- */
  if (act === "mng" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!isBoss(me)) return void (await say("❌ فقط المالك أو المسؤولون."));
    const list = (await CompanyMember.find({ companyId: a, userId: { $ne: uid } }).limit(25)).filter((t) => t.role !== "owner" && (me?.role === "owner" || t.role === "employee"));
    if (!list.length) return void (await say("ما فيه موظفين تقدر تديرهم الحين."));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`co|sel|${a}`)
      .setPlaceholder("اختر موظف")
      .addOptions(list.map((t) => ({ label: `${t.title}`.slice(0, 90), description: `${t.salary} يوميًا • ${t.userId}`, value: t.userId })));
    await i.reply({ content: "👥 اختر الموظف:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ...eph });
    return;
  }
  if (["sel", "pen", "raise", "promo", "promosel", "fire", "offc", "penm", "raisem"].includes(act)) {
    const targetId = act === "sel" && i.isStringSelectMenu() ? i.values[0] : b;
    const { company, me } = await ctxOf(i, a);
    const t = company ? await CompanyMember.findOne({ companyId: a, userId: targetId }) : null;
    if (!company || !me || !t || !isBoss(me) || !canManage(me, t)) {
      return void (await say("❌ ما تقدر تدير هذا الموظف."));
    }
    const cid = a;
    const show = async (note?: string) => {
      const fresh = (await CompanyMember.findById(t._id)) ?? t;
      const c2 = (await Company.findById(cid)) ?? company;
      const card = memberCard(c2, fresh, me, cid, note);
      if (i.isButton() || i.isStringSelectMenu()) return i.update({ content: "", ...card });
      return i.reply({ ...card, ...eph });
    };
    if (act === "sel") return void (await show());
    if (act === "pen" && i.isButton()) return void (await i.showModal(modal(`co|penm|${cid}|${t.userId}`, "خصم من الراتب القادم", input("amount", "مبلغ الخصم", "100", TextInputStyle.Short, true, 6))));
    if (act === "raise" && i.isButton()) return void (await i.showModal(modal(`co|raisem|${cid}|${t.userId}`, "زيادة راتب", input("amount", "الزيادة اليومية", "100", TextInputStyle.Short, true, 6))));
    if (act === "penm" && i.isModalSubmit()) {
      const amount = num(i.fields.getTextInputValue("amount"));
      if (!(amount >= 1 && amount <= t.salary)) return void (await say(`❌ الخصم لازم بين 1 و ${t.salary} (راتبه).`));
      await CompanyMember.updateOne({ _id: t._id }, { $inc: { penalty: amount } });
      return void (await show(`➖ تم خصم ${jenny(amount)} من راتبه القادم.`));
    }
    if (act === "raisem" && i.isModalSubmit()) {
      const amount = num(i.fields.getTextInputValue("amount"));
      if (!(amount >= 1) || t.salary + amount > COMPANY_RULES.maxSalary) return void (await say("❌ مبلغ غير صالح."));
      const total = await payrollTotal(cid);
      if (company.budget < total + amount) return void (await say(`❌ ميزانية الشركة (${jenny(company.budget)}) ما تغطي رواتب ${jenny(total + amount)} بعد الزيادة.`));
      await CompanyMember.updateOne({ _id: t._id }, { $inc: { salary: amount } });
      return void (await show(`➕ صار راتبه ${jenny(t.salary + amount)} يوميًا.`));
    }
    if (act === "promo" && i.isButton()) {
      const higher = company.positions.map((p, idx) => ({ ...p, idx })).filter((p) => p.salary > t.salary).slice(0, 25);
      if (!higher.length) return void (await say("ما فيه رتبة أعلى راتبًا. أضف رتب جديدة في «طلب توظيف»."));
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`co|promosel|${cid}|${t.userId}`)
        .setPlaceholder("اختر الرتبة الجديدة")
        .addOptions(higher.map((p) => ({ label: p.title.slice(0, 90), description: `${p.salary} يوميًا`, value: String(p.idx) })));
      return void (await i.update({ content: "📈 اختر المنصب الأعلى:", embeds: [], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] }));
    }
    if (act === "promosel" && i.isStringSelectMenu()) {
      const pos = company.positions[Number(i.values[0])];
      if (!pos || pos.salary <= t.salary) return void (await say("❌ رتبة غير صالحة."));
      const total = await payrollTotal(cid);
      if (company.budget < total - t.salary + pos.salary) return void (await say("❌ ميزانية الشركة ما تغطي الراتب الجديد."));
      await CompanyMember.updateOne({ _id: t._id }, { $set: { title: pos.title, salary: pos.salary } });
      return void (await show(`📈 تمت ترقيته إلى **${pos.title}** (${jenny(pos.salary)} يوميًا).`));
    }
    if (act === "fire" && i.isButton()) {
      await CompanyMember.deleteOne({ _id: t._id });
      return void (await i.update({ content: `🥾 تم فصل ${mention(t.userId)}.`, embeds: [], components: [], allowedMentions: { users: [] } }));
    }
    if (act === "offc" && i.isButton()) {
      if (me.role !== "owner") return void (await say("❌ فقط المالك."));
      await CompanyMember.updateOne({ _id: t._id }, { $set: { role: t.role === "official" ? "employee" : "official" } });
      return void (await show(t.role === "official" ? "تم سحب المسؤولية." : "🛡️ صار مسؤولًا: يقبل الطلبات ويدير الموظفين."));
    }
    return;
  }

  /* --- بيع الشركة --- */
  if (act === "sell" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (me?.role !== "owner") return void (await say("❌ فقط المالك."));
    await i.showModal(
      modal(`co|sellm|${a}`, "بيع الشركة", input("buyer", "المشتري (منشن أو ID)", "@user أو 1234567890", TextInputStyle.Short, true, 40), input("price", "السعر", "20000", TextInputStyle.Short, true, 10)),
    );
    return;
  }
  if (act === "sellm" && i.isModalSubmit()) {
    const { company, me } = await ctxOf(i, a);
    if (!company || me?.role !== "owner") return void (await say("❌ فقط المالك."));
    const buyer = i.fields.getTextInputValue("buyer").replace(/[^\d]/g, "");
    const price = num(i.fields.getTextInputValue("price"));
    if (!buyer || buyer === uid || !(price >= 0)) return void (await say("❌ بيانات غير صالحة."));
    const member = await i.guild?.members.fetch(buyer).catch(() => null);
    if (!member || member.user.bot) return void (await say("❌ المشتري لازم يكون عضو في السيرفر."));
    const other = await myMembership(guildId, buyer);
    if (other && other.companyId !== a) return void (await say("❌ المشتري عضو في شركة ثانية."));
    const ch = i.channel;
    if (!ch || !("send" in ch)) return void (await say("❌ تعذّر النشر."));
    await ch.send({
      content: `${mention(buyer)}`,
      embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle("🤝 عرض شراء شركة").setDescription(`${mention(uid)} يعرض بيع **${company.name}** عليك بسعر ${jenny(price)}.\nالميزانية الحالية: ${jenny(company.budget)} (تنتقل معها).`)],
      components: [row(btn(`co|buy|${a}|${buyer}|${price}|${uid}`, "أشتري", ButtonStyle.Success, "✅"), btn(`co|nobuy|${a}|${buyer}|${uid}`, "رفض", ButtonStyle.Danger, "❌"))],
      allowedMentions: { users: [buyer] },
    }).catch(() => undefined);
    await i.reply({ content: "📨 أرسلنا العرض للمشتري في هذا الروم.", ...eph });
    return;
  }
  if ((act === "nobuy" || act === "buy") && i.isButton()) {
    const parts = i.customId.split("|"); // co|buy|cid|buyer|price|seller  /  co|nobuy|cid|buyer|seller
    const buyer = parts[3];
    const seller = act === "buy" ? parts[5] : parts[4];
    if (uid !== buyer && uid !== seller) return void (await say("❌ هذا العرض مو لك."));
    if (act === "nobuy") return void (await i.update({ content: "❌ تم رفض/إلغاء عرض البيع.", embeds: [], components: [] }));
    if (uid !== buyer) return void (await say("❌ فقط المشتري يقدر يوافق."));
    const price = Number(parts[4]);
    const company = await Company.findOne({ _id: a, guildId, ownerId: seller });
    if (!company) return void (await i.update({ content: "⚠️ العرض ما عاد صالح.", embeds: [], components: [] }));
    const other = await myMembership(guildId, buyer);
    if (other && other.companyId !== a) return void (await i.update({ content: "⚠️ أنت عضو في شركة ثانية.", embeds: [], components: [] }));
    if (price > 0) {
      const paid = await UserProfile.findOneAndUpdate({ userId: buyer, guildId, coins: { $gte: price } }, { $inc: { coins: -price } });
      if (!paid) return void (await say(`❌ ما تكفي محفظتك (${jenny(price)}).`));
    }
    const moved = await Company.findOneAndUpdate({ _id: a, ownerId: seller }, { $set: { ownerId: buyer } });
    if (!moved) {
      if (price > 0) await UserProfile.updateOne({ userId: buyer, guildId }, { $inc: { coins: price } });
      return void (await i.update({ content: "⚠️ العرض ما عاد صالح.", embeds: [], components: [] }));
    }
    if (price > 0) await UserProfile.updateOne({ userId: seller, guildId }, { $inc: { coins: price } }, { upsert: true });
    await CompanyMember.deleteOne({ companyId: a, userId: seller });
    await CompanyMember.updateOne({ companyId: a, userId: buyer }, { $set: { role: "owner", title: "المالك", salary: 0, penalty: 0 } }, { upsert: false });
    if (!other) await CompanyMember.create({ guildId, companyId: a, userId: buyer, role: "owner", title: "المالك", salary: 0 });
    await i.update({ content: `🤝 تمت الصفقة! ${mention(buyer)} صار مالك **${company.name}** بسعر ${jenny(price)}.`, embeds: [], components: [], allowedMentions: { users: [] } });
    return;
  }

  /* --- إغلاق الشركة --- */
  if (act === "close" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (me?.role !== "owner") return void (await say("❌ فقط المالك."));
    return void (await i.reply({ content: "⚠️ إغلاق الشركة نهائي: يُفصل الجميع وتوزّع الميزانية المتبقية بالتساوي على الموظفين. متأكد؟", components: [row(btn(`co|closey|${a}`, "نعم، أغلق", ButtonStyle.Danger), btn("co|cancel", "إلغاء"))], ...eph }));
  }
  if (act === "closey" && i.isButton()) {
    const { company, me } = await ctxOf(i, a);
    if (!company || me?.role !== "owner") return void (await i.update({ content: "❌ ما تقدر.", components: [] }));
    await dissolveCompany(company, true);
    return void (await i.update({ content: `🔒 تم إغلاق **${company.name}**.`, components: [] }));
  }
}

async function closePosting(i: AnyI, p: { _id: unknown; channelId: string; messageId: string; companyId: string; title: string; slots: number; filled: number; salary: number }): Promise<void> {
  await CompanyPosting.updateOne({ _id: p._id }, { $set: { open: false } });
  const c = await Company.findById(p.companyId);
  if (!c || !p.channelId || !p.messageId) return;
  const ch = await i.client.channels.fetch(p.channelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  const msg = await ch.messages.fetch(p.messageId).catch(() => null);
  await msg?.edit({ embeds: [postingEmbed(c, p, "", false)], components: [] }).catch(() => undefined);
}
