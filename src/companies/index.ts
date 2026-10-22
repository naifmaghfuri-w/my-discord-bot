import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
  type BaseMessageOptions, type ButtonInteraction, type Client, type Interaction, type Message, type ModalSubmitInteraction, type StringSelectMenuInteraction,
} from "discord.js";
import { jenny } from "../constants";
import { Company, CompanyApplication, CompanyComplaint, CompanyLog, CompanyMember, CompanyPosting, CompanyReport, type ICompany, type ICompanyMember } from "../database/models/Company";
import { UserProfile } from "../database/models/UserProfile";
import { JOBS } from "../jobs/data";
import { fmtMs } from "../jobs/views";
import { applyForJob, getJob } from "../jobs/service";
import { logTransaction } from "../services/transactions";
import { renderHub, type HubCorpRow, type HubRegRow } from "./hub";
import { makeLogo, renderCompanyCard } from "./card";
import { logger } from "../utils/logger";
import { BOARD_TITLE, CEO_TITLE, HR_TITLE, PROMOTIONS, TITLES, assignable, badgeOf, canControl, levelOf, titleByKey, titleLevel } from "./titles";
import { buildThiefMenu, handleThiefMessage, runThief, type ThiefAction } from "../jobs/thief";

/* ───────────── الثوابت ───────────── */

export const COMPANY_RULES = {
  openCost: 10_000,
  shiftCooldownMs: 3 * 60 * 60 * 1000,
  payrollMs: 24 * 60 * 60 * 1000,
  shiftGainEmployee: 100, // يضاف لميزانية الشركة بكل دوام موظف
  shiftGainOfficial: 200, // دوام المسؤول/المالك
  maxSlots: 20,
  maxSalary: 10_000,
  /** تكلفة تغيير الاسم أو الصورة (تُخصم من ميزانية الشركة) */
  changeCost: 200,
} as const;

/** !وظائف / !الوظائف */
/** !وظائف + !دعم اسم مبلغ + !سرقة (كلها تمر من handleCompanyMessage) */
export const COMPANY_HUB_TRIGGER = /^!\s*(?:(?:ال)?وظائف|سرقة|دعم(?:\s+.+)?)$/;
/** !شركتي (الإدارة العليا) / !شركة (باقي الموظفين) */
export const COMPANY_MINE_TRIGGER = /^!\s*(?:شركتي|شركة)$/;

const COLOR = 0x3498db;
const roleLabel = (m: { role: string; title: string }): string => (m.role === "owner" ? "👑 المالك" : m.role === "official" ? "🏛️ مجلس الإدارة" : `👷 ${m.title}`);
const addLog = (guildId: string, companyId: string, text: string) => CompanyLog.create({ guildId, companyId, text }).catch(() => undefined);
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
/** من يقدر يوظف ويدير: مجلس الإدارة والمالك، المدير التنفيذي، ومدير الفرع */
const isBoss = (m: { role: string; title?: string } | null | undefined): boolean => Boolean(m) && levelOf(m as { role: string; title?: string }) <= 2;

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

async function buildHub(guildId: string, kind: "reg" | "corp" = "reg"): Promise<View> {
  const postings = await CompanyPosting.find({ guildId, open: true }).limit(12);
  const names = new Map<string, string>();
  for (const p of postings) {
    const k = String(p.companyId);
    if (!names.has(k)) names.set(k, (await Company.findById(p.companyId, { name: 1 }))?.name ?? "?");
  }
  const regRows: HubRegRow[] = JOBS.map((j) => ({
    name: j.name,
    pay: j.kind === "thief" ? { value: "من السرقة", unit: "!سرقة" } : j.kind === "career" ? { value: `${j.ranks[0].pay}–${j.ranks[j.ranks.length - 1].pay}`, unit: "لكل دوام" } : { value: String(j.ranks[0].pay), unit: "للدوام الكامل" },
    promo: j.kind === "career" && j.ranks.length > 1,
  }));
  const corpRows: HubCorpRow[] = postings.map((p) => ({
    name: p.title,
    company: names.get(String(p.companyId)) ?? "?",
    pay: { value: p.salary.toLocaleString("en-US"), unit: "يوميًا" },
    count: `${p.slots - p.filled}/${p.slots}`,
    promo: !!PROMOTIONS[p.title],
  }));
  const png = await renderHub(kind, regRows, corpRows);
  const components: ActionRowBuilder<any>[] = [
    row(
      btn("co|hub|reg", "وظائف عادية", kind === "reg" ? ButtonStyle.Primary : ButtonStyle.Secondary),
      btn("co|hub|corp", "وظائف شركات", kind === "corp" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    ),
  ];
  if (kind === "reg") {
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("co|regsel")
          .setPlaceholder("قدّم على وظيفة عادية")
          .addOptions(JOBS.map((j) => ({ label: j.name, value: j.id }))),
      ),
    );
  } else {
    components.push(row(btn("co|open", "فتح شركة", ButtonStyle.Success)));
  }
  if (!png) {
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(kind === "reg" ? "الوظائف العادية" : "وظائف الشركات").setDescription(
      kind === "reg"
        ? regRows.map((r) => `**${r.name}** — ${r.pay.value} ${r.pay.unit} • ترقية: ${r.promo ? "نعم" : "لا"}`).join("\n")
        : corpRows.map((r) => `**${r.name}** (${r.company}) — ${r.pay.value} ${r.pay.unit} • ${r.count} • ترقية: ${r.promo ? "نعم" : "لا"}`).join("\n") || "لا توجد وظائف حالياً",
    );
    return { embeds: [embed], components };
  }
  const name = kind === "reg" ? "jobs.png" : "corp-jobs.png";
  const embed = new EmbedBuilder().setColor(COLOR).setImage(`attachment://${name}`);
  return { embeds: [embed], files: [new AttachmentBuilder(png, { name })], components };
}

async function memberInfo(client: Client, guildId: string, id: string): Promise<{ name: string; avatar?: string }> {
  const gm = await client.guilds.cache.get(guildId)?.members.fetch(id).catch(() => null);
  if (gm) return { name: gm.displayName, avatar: gm.displayAvatarURL({ extension: "png", size: 128 }) };
  const u = await client.users.fetch(id).catch(() => null);
  return { name: u?.username ?? id, avatar: u?.displayAvatarURL({ extension: "png", size: 128 }) };
}

async function buildCompanyPanel(guildId: string, userId: string, client: Client, note?: string): Promise<View> {
  const m = await myMembership(guildId, userId);
  if (!m) {
    return { content: "ما عندك شركة. اكتب `!وظائف` ثم اضغط «فتح شركة»، أو قدّم على طلب توظيف.", embeds: [], components: [] };
  }
  const c = await Company.findById(m.companyId);
  if (!c) return { content: "تعذّر إيجاد الشركة.", embeds: [], components: [] };
  const cid = idOf(c);
  // تنظيف الوظائف القديمة المكتوبة يدويًا (ما عادت مستخدمة)
  if (c.positions.some((p) => !TITLES.some((x) => x.name === p.title))) {
    c.positions = c.positions.filter((p) => TITLES.some((x) => x.name === p.title));
    await Company.updateOne({ _id: c._id }, { $set: { positions: c.positions.map((p) => ({ title: p.title, salary: p.salary })) } }).catch(() => undefined);
  }
  const members = await CompanyMember.find({ companyId: cid }).sort({ salary: -1 });
  const payroll = members.reduce((s, x) => s + x.salary, 0);
  const lines = members.slice(0, 15).map((x) => `${roleLabel(x)} ${mention(x.userId)} — ${x.title} • ${jenny(x.salary)}`);
  const since = new Date(c.lastPayrollAt).getTime();
  const shown = members.slice(0, 6);
  const infos = await Promise.all(shown.map((x) => memberInfo(client, guildId, x.userId)));
  const ownerIdx = shown.findIndex((x) => x.role === "owner");
  const ownerName = ownerIdx >= 0 ? infos[ownerIdx].name : (await memberInfo(client, guildId, c.ownerId)).name;
  const shiftLeft = m.lastShiftAt ? COMPANY_RULES.shiftCooldownMs - (Date.now() - new Date(m.lastShiftAt).getTime()) : 0;
  const png = await renderCompanyCard({
    name: c.name,
    ownerName,
    createdAt: new Date(c.createdAt).toLocaleDateString("en-GB"),
    budget: c.budget,
    payroll,
    memberCount: members.length,
    logo: c.logo ?? null,
    payrollIn: fmtMs(Math.max(60_000, since + COMPANY_RULES.payrollMs - Date.now())),
    members: shown.map((x, idx) => ({
      name: infos[idx].name,
      avatar: infos[idx].avatar,
      badge: badgeOf(x),
      title: x.title,
      salary: x.salary,
      active: Boolean(x.lastShiftAt && new Date(x.lastShiftAt).getTime() > since),
    })),
    me: { badge: badgeOf(m), title: m.title, salary: m.salary, penalty: m.penalty ?? 0, shiftReady: shiftLeft <= 0, shiftIn: fmtMs(Math.max(60_000, shiftLeft)) },
  });
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
        `أنت: ${roleLabel(m)} — **${m.title}** (${jenny(m.salary)} يوميًا)`,
        "",
        lines.join("\n"),
      ].filter((x, i) => x !== "" || i > 0).join("\n"),
    );
  let files: { attachment: Buffer; name: string }[] = [];
  if (png) {
    embed.setTitle(null).setDescription(note ?? null).setImage("attachment://company.png");
    files = [{ attachment: png, name: "company.png" }];
  }
  const first = [
    btn(`co|work|${cid}`, "دوام", ButtonStyle.Success),
    btn(`co|refresh|${cid}`, "تحديث", ButtonStyle.Secondary, "🔄"),
    btn(`co|menu|${cid}`, c.name.slice(0, 60), ButtonStyle.Primary, "🏢"),
  ];
  if (m.title === HR_TITLE) first.push(btn(`co|hrbox|${cid}`, "شكاوى الموظفين", ButtonStyle.Secondary, "📨"), btn(`co|rpt|${cid}`, "رفع تقرير", ButtonStyle.Secondary, "📄"));
  if (m.title === CEO_TITLE) first.push(btn(`co|rptbox|${cid}`, "تقارير HR", ButtonStyle.Secondary, "📄"));
  const rows: ActionRowBuilder<ButtonBuilder>[] = [row(...first)];
  if (isBoss(m)) rows.push(row(btn(`co|post|${cid}`, "طلب توظيف", ButtonStyle.Primary, "📢")));
  if (m.role !== "owner") rows.push(row(btn(`co|leave|${cid}`, "استقالة من الشركة", ButtonStyle.Danger, "🚪")));
  return { embeds: [embed], components: rows, files };
}

function memberCard(c: ICompany, t: ICompanyMember, actor: ICompanyMember, cid: string, note?: string): View {
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`👤 ${t.title}`)
    .setDescription([note ?? "", `${roleLabel(t)} ${mention(t.userId)}`, `الراتب اليومي: ${jenny(t.salary)}`, `خصم قادم: ${jenny(t.penalty ?? 0)}`, `ميزانية الشركة: ${jenny(c.budget)}`].filter(Boolean).join("\n"));
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (actor.role === "owner" && t.userId === actor.userId) {
    // المالك يعدّل وظيفته وراتبه بنفسه
    rows.push(row(btn(`co|setsal|${cid}|${t.userId}`, "تعديل الراتب", ButtonStyle.Secondary, "💰"), btn(`co|promo|${cid}|${t.userId}`, "تغيير وظيفتي", ButtonStyle.Primary, "🔁")));
  } else if (canControl(actor, t)) {
    const first = [
      btn(`co|setsal|${cid}|${t.userId}`, "تعديل الراتب", ButtonStyle.Secondary, "💰"),
      btn(`co|pen|${cid}|${t.userId}`, "خصم", ButtonStyle.Secondary, "➖"),
      btn(`co|promo|${cid}|${t.userId}`, "تغيير الوظيفة", ButtonStyle.Primary, "🔁"),
    ];
    const next = PROMOTIONS[t.title];
    if (next && titleLevel(next) > levelOf(actor)) first.push(btn(`co|upg|${cid}|${t.userId}`, `ترقية: ${next}`.slice(0, 70), ButtonStyle.Success, "📈"));
    rows.push(row(...first), row(btn(`co|fire|${cid}|${t.userId}`, "فصل", ButtonStyle.Danger, "🥾")));
  }
  if (actor.role === "owner" && t.role !== "owner") rows.push(row(btn(`co|offc|${cid}|${t.userId}`, t.role === "official" ? "سحب عضوية المجلس" : "تعيين في مجلس الإدارة", ButtonStyle.Secondary, "🏛️")));
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

/** !وظائف / !شركتي / !شركة / !دعم / !سرقة */
export async function handleCompanyMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  const text = message.content.trim();
  const reply = (content: string) => message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => undefined);

  if (/^!\s*سرقة$/.test(text)) return void (await handleThiefMessage(message));

  if (/^!\s*دعم(?:\s|$)/.test(text)) {
    const sup = /^!\s*دعم\s+(.+?)\s+([\d٠-٩,،]+)$/.exec(text);
    if (!sup) return void (await reply("الصيغة: `!دعم اسم_الشركة المبلغ` مثل `!دعم شركة النجوم 500`"));
    const amount = num(sup[2]);
    if (!(amount >= 1 && amount <= 1_000_000)) return void (await reply("❌ المبلغ لازم بين 1 و 1,000,000."));
    const company = await Company.findOne({ guildId: message.guildId, name: sup[1].trim() });
    if (!company) return void (await reply("❌ ما لقيت شركة بهذا الاسم."));
    const paid = await UserProfile.findOneAndUpdate({ userId: message.author.id, guildId: message.guildId, coins: { $gte: amount } }, { $inc: { coins: -amount } });
    if (!paid) return void (await reply(`❌ ما تكفي محفظتك لدعم بمبلغ ${jenny(amount)}.`));
    await Company.updateOne({ _id: company._id }, { $inc: { budget: amount } });
    await logTransaction(message.guildId, message.author.id, "job_fee", amount);
    await addLog(message.guildId, idOf(company), `💝 ${mention(message.author.id)} دعم الشركة بمبلغ ${jenny(amount)}`);
    return void (await reply(`💝 دعمت **${company.name}** بمبلغ ${jenny(amount)}. شكرًا! الإدارة العليا شافت ذلك في السجلات.`));
  }

  const mine = COMPANY_MINE_TRIGGER.test(text);
  if (mine) {
    const m = await myMembership(message.guildId, message.author.id);
    if (m) {
      const top = levelOf(m) === 0;
      const wantsTop = text.includes("شركتي");
      if (top && !wantsTop) return void (await reply("🏛️ أنت من الإدارة العليا، اكتب `!شركتي`."));
      if (!top && wantsTop) return void (await reply("اكتب `!شركة` (أمر `!شركتي` للمالك ومجلس الإدارة فقط)."));
    }
    await message.channel.sendTyping().catch(() => undefined);
  }
  const view = mine ? await buildCompanyPanel(message.guildId, message.author.id, message.client) : await buildHub(message.guildId);
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
  } catch (err) {
    logger.error("خطأ في تفاعل الشركات", err);
    if (!i.replied && !i.deferred) await i.reply({ content: "⚠️ صار خطأ، حاول مرة ثانية.", ...eph }).catch(() => undefined);
  }
  return true;
}

type AnyI = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

async function ctxOf(i: AnyI, cid: string) {
  const guildId = i.guildId as string;
  const company = await Company.findOne({ _id: cid, guildId }).select("-logo");
  const me = company ? await CompanyMember.findOne({ companyId: cid, userId: i.user.id }) : null;
  return { guildId, company, me };
}

async function route(i: AnyI): Promise<void> {
  const [, act, a, b] = i.customId.split("|");
  const guildId = i.guildId as string;
  const uid = i.user.id;
  const say = (content: string) => i.reply({ content, ...eph });

  /* --- اللوحة الرئيسية --- */
  if (act === "hub" && i.isButton()) {
    await i.deferUpdate();
    const view = await buildHub(guildId, a === "corp" ? "corp" : "reg");
    return void (await i.editReply({ ...view, attachments: [] }));
  }
  if (act === "regsel" && i.isStringSelectMenu()) {
    await i.deferReply(eph);
    const r = await applyForJob(uid, guildId, i.values[0]);
    let note: string;
    if (r.ok) note = `🎉 تم قبولك في وظيفة **${r.job.name}**! اكتب \`!دوام\` لتبدأ.`;
    else if (r.reason === "reqs") note = `❌ ما تحقق الشروط: ${(r.missing ?? []).join("، ")}.`;
    else if (r.reason === "coins") note = "❌ رسوم التقديم ما تكفي في محفظتك.";
    else if (r.reason === "blocked") note = `⏳ تقدر تقدّم بعد ${fmtMs(r.msLeft ?? 0)}.`;
    else if (r.reason === "has_job") note = "❌ عندك وظيفة بالفعل. استقل أولًا.";
    else note = "❌ تعذّر التقديم.";
    return void (await i.editReply({ content: note }));
  }
  if (act === "mine" && i.isButton()) {
    await i.deferReply(eph);
    return void (await i.editReply(await buildCompanyPanel(guildId, uid, i.client)));
  }
  if (act === "refresh" && i.isButton()) {
    const mine = await myMembership(guildId, uid);
    if (!mine || String(mine.companyId) !== a) return void (await say("❌ هذي مو شركتك."));
    await i.deferUpdate();
    const view = await buildCompanyPanel(guildId, uid, i.client);
    return void (await i.editReply({ ...view, attachments: [] }));
  }
  if (act === "open" && i.isButton()) {
    await i.showModal(modal("co|openm", "فتح شركة", input("name", `اسم الشركة (الكلفة ${COMPANY_RULES.openCost})`, "مثال: شركة النجوم", TextInputStyle.Short, true, 40)));
    return;
  }
  if (act === "openm" && i.isModalSubmit()) {
    const name = i.fields.getTextInputValue("name").trim();
    if (!name) return void (await say("❌ اكتب اسم الشركة."));
    const r = await openCompany(guildId, uid, name);
    if (r.ok === false) return void (await say(r.msg));
    await i.deferReply(eph);
    await i.editReply(await buildCompanyPanel(guildId, uid, i.client, `🎉 تم فتح **${name}** (خصمنا ${jenny(COMPANY_RULES.openCost)}). ابدأ بنشر طلب توظيف.`));
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
    const appPosting = await CompanyPosting.findById(app.postingId);
    if (!boss || !isBoss(boss) || (appPosting && titleLevel(appPosting.title) <= levelOf(boss))) return void (await say("❌ ما عندك صلاحية تقرر في هذي الوظيفة."));
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
    await addLog(guildId, app.companyId, `✅ ${mention(app.userId)} انقبل كـ **${p.title}** بواسطة ${mention(uid)}`);
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

  /* --- قائمة الشركة (زر اسم الشركة) --- */
  if (act === "menu" && i.isButton()) {
    const { company, me } = await ctxOf(i, a);
    if (!company || !me) return void (await say("❌ هذي مو شركتك."));
    const lvl = levelOf(me);
    const rows: ActionRowBuilder<ButtonBuilder>[] = [row(btn(`co|donate|${a}`, "دعم الميزانية", ButtonStyle.Success))];
    const cost = COMPANY_RULES.changeCost;
    const imgRow: ButtonBuilder[] = [];
    if (lvl <= 1) imgRow.push(btn(`co|logo|${a}`, `تغيير الصورة (${cost})`, ButtonStyle.Secondary, "🖼️"));
    if (lvl === 0) imgRow.push(btn(`co|rename|${a}`, `تغيير الاسم (${cost})`, ButtonStyle.Secondary, "✏️"));
    if (imgRow.length) rows.push(row(...imgRow));
    const second: ButtonBuilder[] = [];
    if (isBoss(me)) second.push(btn(`co|mng|${a}`, "إدارة الموظفين", ButtonStyle.Secondary, "👥"), btn(`co|reqs|${a}`, "قائمة الطلبات", ButtonStyle.Secondary, "📋"));
    if (lvl <= 1) second.push(btn(`co|logs|${a}`, "السجلات", ButtonStyle.Secondary, "📜"));
    if (second.length) rows.push(row(...second));
    if (me.role === "owner") rows.push(row(btn(`co|sell|${a}`, "بيع الشركة", ButtonStyle.Secondary, "🤝"), btn(`co|close|${a}`, "إغلاق الشركة", ButtonStyle.Danger, "🔒")));
    if (lvl >= 2) rows.push(row(btn(`co|compl|${a}`, "شكوى", ButtonStyle.Secondary, "📮")));
    const embed = new EmbedBuilder().setColor(COLOR).setTitle(`🏢 ${company.name}`).setDescription(`💰 الميزانية: ${jenny(company.budget)}\nتغيير الاسم أو الصورة يخصم ${jenny(cost)} من الميزانية.`);
    return void (await i.reply({ embeds: [embed], components: rows, ...eph }));
  }

  /* --- دعم ميزانية الشركة (زر في القائمة) --- */
  if (act === "donate" && i.isButton()) {
    const { company, me } = await ctxOf(i, a);
    if (!company || !me) return void (await say("❌ هذي مو شركتك."));
    return void (await i.showModal(modal(`co|donatem|${a}`, "دعم ميزانية الشركة", input("amount", "المبلغ", "500", TextInputStyle.Short, true, 9))));
  }
  if (act === "donatem" && i.isModalSubmit()) {
    const { company, me } = await ctxOf(i, a);
    if (!company || !me) return void (await say("❌ هذي مو شركتك."));
    const amount = num(i.fields.getTextInputValue("amount"));
    if (!(amount >= 1 && amount <= 1_000_000)) return void (await say("❌ المبلغ لازم بين 1 و 1,000,000."));
    const paid = await UserProfile.findOneAndUpdate({ userId: uid, guildId, coins: { $gte: amount } }, { $inc: { coins: -amount } });
    if (!paid) return void (await say(`❌ ما تكفي محفظتك لدعم بمبلغ ${jenny(amount)}.`));
    await Company.updateOne({ _id: a }, { $inc: { budget: amount } });
    await logTransaction(guildId, uid, "job_fee", amount);
    await addLog(guildId, a, `💝 ${mention(uid)} دعم الشركة بمبلغ ${jenny(amount)}`);
    return void (await i.reply({ content: `💝 دعمت **${company.name}** بمبلغ ${jenny(amount)}. شكرًا! اضغط 🔄 تحديث.`, ...eph }));
  }

  if (act === "logo" && i.isButton()) {
    const { company, me } = await ctxOf(i, a);
    const cost = COMPANY_RULES.changeCost;
    if (!company || !me || levelOf(me) > 1) return void (await say("❌ للإدارة العليا والمدير التنفيذي فقط."));
    if (company.budget < cost) return void (await say(`❌ ميزانية الشركة ما تكفي (${jenny(cost)}).`));
    const ch = i.channel;
    if (!ch || !("awaitMessages" in ch)) return void (await say("❌ تعذّر استقبال الصورة هنا."));
    await i.reply({ content: `🖼️ ارسل الصورة في هذا الروم خلال دقيقة (التغيير يخصم ${jenny(cost)} من ميزانية الشركة).`, ...eph });
    const got = await ch
      .awaitMessages({ filter: (m) => m.author.id === uid && m.attachments.some((x) => Boolean(x.contentType?.startsWith("image/"))), max: 1, time: 60_000 })
      .catch(() => null);
    const msg = got?.first();
    if (!msg) return void (await i.editReply({ content: "⏰ انتهى الوقت بدون صورة." }));
    const att = msg.attachments.find((x) => Boolean(x.contentType?.startsWith("image/")));
    if (!att || att.size > 8 * 1024 * 1024) return void (await i.editReply({ content: "❌ الصورة كبيرة (الحد 8 ميغا)." }));
    const res = await fetch(att.url).catch(() => null);
    const logo = res && res.ok ? await makeLogo(Buffer.from(await res.arrayBuffer())) : null;
    if (!logo) return void (await i.editReply({ content: "❌ ما قدرت أقرأ الصورة." }));
    const paid = await Company.findOneAndUpdate({ _id: a, budget: { $gte: cost } }, { $inc: { budget: -cost }, $set: { logo } });
    if (!paid) return void (await i.editReply({ content: "❌ ميزانية الشركة ما تكفي." }));
    await addLog(guildId, a, `🖼️ ${mention(uid)} غيّر صورة الشركة (خصم ${jenny(cost)})`);
    msg.delete().catch(() => undefined);
    await i.editReply({ content: `✅ تم تغيير صورة الشركة (خصمنا ${jenny(cost)} من الميزانية). اضغط 🔄 تحديث.` });
    return;
  }

  if (act === "rename" && i.isButton()) {
    const { company, me } = await ctxOf(i, a);
    if (!company || !me || levelOf(me) !== 0) return void (await say("❌ للإدارة العليا فقط."));
    const r = input("name", `الاسم الجديد (يخصم ${COMPANY_RULES.changeCost})`, "اسم الشركة", TextInputStyle.Short, true, 40);
    r.components[0].setValue(company.name);
    return void (await i.showModal(modal(`co|renamem|${a}`, "تغيير اسم الشركة", r)));
  }
  if (act === "renamem" && i.isModalSubmit()) {
    const { company, me } = await ctxOf(i, a);
    const cost = COMPANY_RULES.changeCost;
    if (!company || !me || levelOf(me) !== 0) return void (await say("❌ للإدارة العليا فقط."));
    const name = i.fields.getTextInputValue("name").trim();
    if (name.length < 2) return void (await say("❌ الاسم قصير."));
    if (name === company.name) return void (await say("❌ هذا هو الاسم الحالي."));
    if (await Company.findOne({ guildId, name })) return void (await say("❌ يوجد شركة بنفس الاسم."));
    let paid = null;
    try {
      paid = await Company.findOneAndUpdate({ _id: a, budget: { $gte: cost } }, { $inc: { budget: -cost }, $set: { name } });
    } catch {
      return void (await say("❌ يوجد شركة بنفس الاسم."));
    }
    if (!paid) return void (await say(`❌ ميزانية الشركة ما تكفي (${jenny(cost)}).`));
    await addLog(guildId, a, `✏️ ${mention(uid)} غيّر اسم الشركة من **${company.name}** إلى **${name}** (خصم ${jenny(cost)})`);
    return void (await i.reply({ content: `✅ صار اسم الشركة **${name}** (خصمنا ${jenny(cost)}). اضغط 🔄 تحديث.`, ...eph }));
  }

  /* --- الشكاوى: مدير الفرع وتحت يكتبون، وتروح لقسم HR فقط --- */
  if (act === "compl" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!me || levelOf(me) < 2) return void (await say("❌ الشكوى لمدير الفرع ومن تحته."));
    if (!(await CompanyMember.exists({ companyId: a, title: HR_TITLE }))) return void (await say("❌ ما فيه موظف HR في الشركة يستقبل الشكاوى."));
    return void (await i.showModal(modal(`co|complm|${a}`, "شكوى إلى HR", input("text", "اكتب شكواك", "التفاصيل...", TextInputStyle.Paragraph, true, 800))));
  }
  if (act === "complm" && i.isModalSubmit()) {
    const { me } = await ctxOf(i, a);
    if (!me || levelOf(me) < 2) return void (await say("❌ الشكوى لمدير الفرع ومن تحته."));
    if (!(await CompanyMember.exists({ companyId: a, title: HR_TITLE }))) return void (await say("❌ ما فيه موظف HR في الشركة يستقبل الشكاوى."));
    await CompanyComplaint.create({ guildId, companyId: a, fromId: uid, text: i.fields.getTextInputValue("text").trim() });
    return void (await say("📮 وصلت شكواك لقسم HR."));
  }
  if (act === "hrbox" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!me || me.title !== HR_TITLE) return void (await say("❌ هذا لقسم HR فقط."));
    const rows = await CompanyComplaint.find({ companyId: a }).sort({ createdAt: -1 }).limit(10);
    const lines = rows.map((r) => `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:R> من ${mention(r.fromId)}\n> ${r.text.slice(0, 350)}`);
    return void (await i.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle("📨 شكاوى الموظفين").setDescription(lines.join("\n\n") || "ما فيه شكاوى.")], ...eph }));
  }

  /* --- قائمة سرقة الحرامي (!سرقة) --- */
  if (act === "thf" && i.isButton()) {
    if (uid !== a) return void (await say("❌ هذي مو قائمتك. اكتب `!سرقة`."));
    const result = await runThief(uid, guildId, b as ThiefAction);
    return void (await i.update(await buildThiefMenu(uid, guildId, result)));
  }

  /* --- قائمة الطلبات: طلبات التوظيف المعلقة ومتقدميها --- */
  if (act === "reqs" && (i.isButton() || i.isStringSelectMenu())) {
    const { me } = await ctxOf(i, a);
    if (!me || !isBoss(me)) return void (await say("❌ هذا للإدارة فقط."));
    const view = await postingList(a, me);
    // زر "رجوع" يحدّث نفس الرسالة، وزر القائمة يفتح رسالة جديدة
    if (i.isButton() && i.message.flags.has(MessageFlags.Ephemeral) && b === undefined && i.message.embeds[0]?.title?.startsWith("📢")) return void (await i.update(view));
    return void (await i.reply({ ...view, ...eph }));
  }
  if (act === "rqsel" && i.isStringSelectMenu()) {
    const { me } = await ctxOf(i, a);
    const p = await CompanyPosting.findOne({ _id: i.values[0], companyId: a, open: true });
    if (!me || !isBoss(me) || !p || titleLevel(p.title) <= levelOf(me)) return void (await say("❌ ما تقدر تدير هذا الطلب."));
    return void (await i.update(await postingDetail(i, a, p)));
  }
  if (act === "rqapp" && i.isStringSelectMenu()) {
    const { me } = await ctxOf(i, a);
    const p = await CompanyPosting.findOne({ _id: b, companyId: a, open: true });
    const ap = await CompanyApplication.findOne({ _id: i.values[0], postingId: b });
    if (!me || !isBoss(me) || !p || !ap || titleLevel(p.title) <= levelOf(me)) return void (await say("❌ ما تقدر تدير هذا الطلب."));
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle("📝 طلب تقديم").setDescription(`${mention(ap.userId)} يقدّم على **${p.title}** (${jenny(p.salary)} يوميًا)\n\n> ${ap.about}`);
    return void (
      await i.update({
        content: "",
        embeds: [embed],
        components: [row(btn(`co|acc|${idOf(ap)}`, "قبول", ButtonStyle.Success, "✅"), btn(`co|rej|${idOf(ap)}`, "رفض", ButtonStyle.Danger, "❌"), btn(`co|rqback|${a}|${b}`, "رجوع", ButtonStyle.Secondary))],
        allowedMentions: { users: [] },
      })
    );
  }
  if (act === "rqback" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    const p = await CompanyPosting.findOne({ _id: b, companyId: a, open: true });
    if (!me || !isBoss(me)) return void (await say("❌ هذا للإدارة فقط."));
    if (!p) return void (await i.update(await postingList(a, me)));
    return void (await i.update(await postingDetail(i, a, p)));
  }
  if (act === "rqdel" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    const p = await CompanyPosting.findOne({ _id: b, companyId: a });
    if (!me || !isBoss(me) || !p || titleLevel(p.title) <= levelOf(me)) return void (await say("❌ ما تقدر تحذف هذا الطلب."));
    await CompanyApplication.deleteMany({ postingId: b });
    await CompanyPosting.deleteOne({ _id: p._id });
    if (p.channelId && p.messageId) {
      const ch = await i.client.channels.fetch(p.channelId).catch(() => null);
      if (ch && ch.isTextBased()) (await ch.messages.fetch(p.messageId).catch(() => null))?.delete().catch(() => undefined);
    }
    await addLog(guildId, a, `🗑️ ${mention(uid)} حذف طلب التوظيف **${p.title}**`);
    return void (await i.update({ content: `🗑️ تم حذف طلب التوظيف **${p.title}** مع متقدميه.`, embeds: [], components: [] }));
  }

  /* --- تقارير HR عن الموظفين (من مدير فرع لتحت) تروح للمدير التنفيذي --- */
  if (act === "rpt" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!me || me.title !== HR_TITLE) return void (await say("❌ رفع التقارير لقسم HR فقط."));
    if (!(await CompanyMember.exists({ companyId: a, title: CEO_TITLE }))) return void (await say("❌ ما فيه مدير تنفيذي في الشركة يستقبل التقارير."));
    const all = await CompanyMember.find({ companyId: a, userId: { $ne: uid } }).limit(100);
    const list = all.filter((t) => levelOf(t) >= 2).slice(0, 25);
    if (!list.length) return void (await say("ما فيه موظفين تقدر ترفع عنهم تقرير."));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`co|rptsel|${a}`)
      .setPlaceholder("اختر الموظف")
      .addOptions(list.map((t) => ({ label: t.title.slice(0, 90), description: t.userId, value: t.userId })));
    return void (await i.reply({ content: "📄 اختر الموظف اللي تبي ترفع عنه تقرير:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ...eph }));
  }
  if (act === "rptsel" && i.isStringSelectMenu()) {
    const { me } = await ctxOf(i, a);
    const t = await CompanyMember.findOne({ companyId: a, userId: i.values[0] });
    if (!me || me.title !== HR_TITLE || !t || levelOf(t) < 2 || t.userId === uid) return void (await say("❌ ما تقدر ترفع تقرير عن هذا الشخص."));
    return void (await i.showModal(modal(`co|rptm|${a}|${t.userId}`, "تقرير عن موظف", input("reason", "سبب التقرير", "اكتب السبب بالتفصيل...", TextInputStyle.Paragraph, true, 800))));
  }
  if (act === "rptm" && i.isModalSubmit()) {
    const { me } = await ctxOf(i, a);
    const t = await CompanyMember.findOne({ companyId: a, userId: b });
    if (!me || me.title !== HR_TITLE || !t || levelOf(t) < 2 || t.userId === uid) return void (await say("❌ ما تقدر ترفع تقرير عن هذا الشخص."));
    if (!(await CompanyMember.exists({ companyId: a, title: CEO_TITLE }))) return void (await say("❌ ما فيه مدير تنفيذي في الشركة يستقبل التقارير."));
    await CompanyReport.create({ guildId, companyId: a, fromId: uid, targetId: t.userId, reason: i.fields.getTextInputValue("reason").trim() });
    await addLog(guildId, a, `📄 ${mention(uid)} (HR) رفع تقريرًا عن ${mention(t.userId)} (${t.title}) للمدير التنفيذي`);
    return void (await say("📄 وصل تقريرك للمدير التنفيذي."));
  }
  if (act === "rptbox" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!me || me.title !== CEO_TITLE) return void (await say("❌ التقارير للمدير التنفيذي فقط."));
    const rows = await CompanyReport.find({ companyId: a }).sort({ createdAt: -1 }).limit(10);
    const lines = rows.map((r) => `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:f> عن ${mention(r.targetId)} • من HR ${mention(r.fromId)}\n> ${r.reason.slice(0, 350)}`);
    return void (await i.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle("📄 تقارير HR").setDescription(lines.join("\n\n") || "ما فيه تقارير.")], ...eph }));
  }

  /* --- سجلات الشركة (الإدارة العليا فقط) --- */
  if (act === "logs" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!me || levelOf(me) > 1) return void (await say("❌ السجلات للإدارة العليا والمدير التنفيذي فقط."));
    const rows = await CompanyLog.find({ companyId: a }).sort({ createdAt: -1 }).limit(15);
    const lines = rows.map((r) => `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:f> ${r.text}`);
    return void (await i.reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle("📜 سجلات الشركة").setDescription(lines.join("\n") || "لا توجد سجلات بعد.")], ...eph }));
  }

  /* --- نشر طلب توظيف: اختيار الوظيفة من قائمة ثم العدد والراتب فقط --- */
  if (act === "post" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!me || !isBoss(me)) return void (await say("❌ هذا للإدارة فقط."));
    const opts = assignable(levelOf(me));
    if (!opts.length) return void (await say("ما فيه وظائف تقدر تعلن عنها."));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`co|postsel|${a}`)
      .setPlaceholder("اختر الوظيفة")
      .addOptions(opts.map((t) => ({ label: t.name, description: t.group, value: t.key })));
    await i.reply({ content: "📢 اختر الوظيفة اللي تبي تعلن عنها:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ...eph });
    return;
  }
  if (act === "postsel" && i.isStringSelectMenu()) {
    const { me } = await ctxOf(i, a);
    const t = titleByKey(i.values[0]);
    if (!me || !isBoss(me) || !t || t.level <= levelOf(me)) return void (await say("❌ ما تقدر تعلن عن هذي الوظيفة."));
    await i.showModal(
      modal(
        `co|postm|${a}|${t.key}`,
        `توظيف: ${t.name}`.slice(0, 45),
        input("slots", `عدد المطلوبين (1-${COMPANY_RULES.maxSlots})`, "3", TextInputStyle.Short, true, 3),
        input("salary", "الراتب اليومي", "300", TextInputStyle.Short, true, 6),
      ),
    );
    return;
  }
  if (act === "postm" && i.isModalSubmit()) {
    const { company, me } = await ctxOf(i, a);
    const def = titleByKey(b ?? "");
    if (!company || !me || !isBoss(me) || !def || def.level <= levelOf(me)) return void (await say("❌ ما تقدر تعلن عن هذي الوظيفة."));
    const title = def.name;
    const slots = num(i.fields.getTextInputValue("slots"));
    const salary = num(i.fields.getTextInputValue("salary"));
    if (!(slots >= 1 && slots <= COMPANY_RULES.maxSlots)) return void (await say(`❌ العدد لازم بين 1 و ${COMPANY_RULES.maxSlots}.`));
    if (!(salary >= 1 && salary <= COMPANY_RULES.maxSalary)) return void (await say(`❌ الراتب لازم بين 1 و ${COMPANY_RULES.maxSalary}.`));
    const positions = new Map(company.positions.map((p) => [p.title, p.salary] as const));
    positions.set(title, salary);
    await Company.updateOne({ _id: company._id }, { $set: { positions: [...positions].map(([t, s]) => ({ title: t, salary: s })) } });
    const posting = await CompanyPosting.create({ guildId, companyId: a, title, slots, salary });
    const ch = i.channel;
    if (!ch || !("send" in ch)) return void (await say("❌ تعذّر النشر في هذا الروم."));
    const sent = await ch
      .send({ embeds: [postingEmbed(company, { title, slots, filled: 0, salary }, "", true)], components: [row(btn(`co|apply|${idOf(posting)}`, "تقديم", ButtonStyle.Success, "📝"))] })
      .catch(() => null);
    if (!sent) {
      await CompanyPosting.deleteOne({ _id: posting._id });
      return void (await say("❌ ما قدرت أنشر الطلب (صلاحيات الروم؟)."));
    }
    await CompanyPosting.updateOne({ _id: posting._id }, { $set: { channelId: sent.channelId, messageId: sent.id } });
    await addLog(guildId, a, `📢 ${mention(uid)} أعلن عن وظيفة **${title}** (${slots} مقعد، ${jenny(salary)} يوميًا)`);
    await i.reply({ content: "✅ تم نشر طلب التوظيف في هذا الروم. الطلبات تظهر هنا بأزرار قبول/رفض.", ...eph });
    return;
  }

  /* --- إدارة الموظفين --- */
  if (act === "mng" && i.isButton()) {
    const { me } = await ctxOf(i, a);
    if (!me || !isBoss(me)) return void (await say("❌ هذا للإدارة فقط."));
    const all = await CompanyMember.find({ companyId: a, userId: { $ne: uid } }).limit(100);
    const others = all.filter((t) => canControl(me, t) || (me.role === "owner" && t.role !== "owner"));
    const list = (me.role === "owner" ? [me, ...others] : others).slice(0, 25);
    if (!list.length) return void (await say("ما فيه موظفين تقدر تديرهم الحين."));
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`co|sel|${a}`)
      .setPlaceholder("اختر موظف")
      .addOptions(list.map((t) => ({ label: (t.userId === uid ? `أنت — ${t.title}` : t.title).slice(0, 90), description: `${t.salary} يوميًا • ${t.userId}`, value: t.userId })));
    await i.reply({ content: "👥 اختر الموظف:", components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ...eph });
    return;
  }
  if (["sel", "pen", "penm", "setsal", "setsalm", "promo", "promosel", "upg", "fire", "offc"].includes(act)) {
    const targetId = act === "sel" && i.isStringSelectMenu() ? i.values[0] : b;
    const { company, me } = await ctxOf(i, a);
    const t = company ? await CompanyMember.findOne({ companyId: a, userId: targetId }) : null;
    const selfOwner = Boolean(me && t && me.role === "owner" && t.userId === me.userId);
    const ownerOverride = Boolean(me && t && me.role === "owner" && t.role !== "owner");
    const selfActs = ["sel", "setsal", "setsalm", "promo", "promosel"];
    const allowed = Boolean(me && t && (selfOwner ? selfActs.includes(act) : act === "offc" ? ownerOverride : act === "sel" ? canControl(me, t) || ownerOverride : canControl(me, t)));
    if (!company || !me || !t || !allowed) {
      return void (await say("❌ ما تقدر تدير هذا الشخص."));
    }
    const cid = a;
    const show = async (note?: string) => {
      const fresh = (await CompanyMember.findById(t._id)) ?? t;
      const c2 = (await Company.findById(cid).select("-logo")) ?? company;
      const card = memberCard(c2, fresh, me, cid, note);
      if (i.isButton() || i.isStringSelectMenu()) return i.update({ content: "", ...card });
      return i.reply({ ...card, ...eph });
    };
    if (act === "sel") return void (await show());

    if (act === "pen" && i.isButton()) return void (await i.showModal(modal(`co|penm|${cid}|${t.userId}`, "خصم من الراتب القادم", input("amount", "مبلغ الخصم", "100", TextInputStyle.Short, true, 6))));
    if (act === "penm" && i.isModalSubmit()) {
      const amount = num(i.fields.getTextInputValue("amount"));
      if (!(amount >= 1 && amount <= t.salary)) return void (await say(`❌ الخصم لازم بين 1 و ${t.salary} (راتبه).`));
      await CompanyMember.updateOne({ _id: t._id }, { $inc: { penalty: amount } });
      await addLog(guildId, cid, `➖ ${mention(uid)} خصم ${jenny(amount)} من راتب ${mention(t.userId)}`);
      return void (await show(`➖ تم خصم ${jenny(amount)} من راتبه القادم.`));
    }

    if (act === "setsal" && i.isButton()) {
      const r = input("salary", `الراتب اليومي (0-${COMPANY_RULES.maxSalary})`, "300", TextInputStyle.Short, true, 6);
      r.components[0].setValue(String(t.salary));
      return void (await i.showModal(modal(`co|setsalm|${cid}|${t.userId}`, "تعديل الراتب", r)));
    }
    if (act === "setsalm" && i.isModalSubmit()) {
      const salary = num(i.fields.getTextInputValue("salary"));
      if (!(salary >= 0 && salary <= COMPANY_RULES.maxSalary)) return void (await say(`❌ الراتب لازم بين 0 و ${COMPANY_RULES.maxSalary}.`));
      if (salary > t.salary) {
        const total = await payrollTotal(cid);
        if (company.budget < total - t.salary + salary) return void (await say(`❌ ميزانية الشركة (${jenny(company.budget)}) ما تغطي الرواتب بعد التعديل.`));
      }
      await CompanyMember.updateOne({ _id: t._id }, { $set: { salary } });
      await addLog(guildId, cid, `💰 ${mention(uid)} عدّل راتب ${mention(t.userId)} من ${jenny(t.salary)} إلى ${jenny(salary)}`);
      return void (await show(`💰 صار راتبه ${jenny(salary)} يوميًا.`));
    }

    if (act === "promo" && i.isButton()) {
      let options: { label: string; description: string; value: string }[];
      if (selfOwner) {
        options = [{ label: "المالك", description: "المسمى الافتراضي", value: "owner" }, ...TITLES.map((x) => ({ label: x.name, description: x.group, value: x.key }))].slice(0, 25);
      } else {
        const posted = new Map(company.positions.map((p) => [p.title, p.salary] as const));
        options = assignable(levelOf(me))
          .filter((x) => x.name !== t.title)
          .map((x) => ({ label: x.name, description: posted.has(x.name) ? `${posted.get(x.name)} يوميًا` : `${x.group} • يبقى راتبه`, value: x.key }));
        if (!options.length) return void (await say("ما فيه وظائف تقدر تنقله لها."));
      }
      const menu = new StringSelectMenuBuilder().setCustomId(`co|promosel|${cid}|${t.userId}`).setPlaceholder("اختر الوظيفة الجديدة").addOptions(options);
      return void (await i.update({ content: selfOwner ? "🔁 اختر وظيفتك:" : "🔁 اختر الوظيفة الجديدة من وظائف الشركة:", embeds: [], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] }));
    }
    if (act === "promosel" && i.isStringSelectMenu()) {
      if (selfOwner) {
        const v = i.values[0];
        const title = v === "owner" ? "المالك" : titleByKey(v)?.name;
        if (!title) return void (await say("❌ وظيفة غير صالحة."));
        await CompanyMember.updateOne({ _id: t._id }, { $set: { title } });
        await addLog(guildId, cid, `🔁 ${mention(uid)} غيّر وظيفته إلى **${title}**`);
        return void (await show(`🔁 صارت وظيفتك **${title}**.`));
      }
      const def = titleByKey(i.values[0]);
      if (!def || def.level <= levelOf(me)) return void (await say("❌ وظيفة غير صالحة."));
      // الراتب: راتب الوظيفة لو سبق الإعلان عنها، وإلا يبقى راتبه الحالي
      const salary = company.positions.find((p) => p.title === def.name)?.salary ?? t.salary;
      if (salary > t.salary) {
        const total = await payrollTotal(cid);
        if (company.budget < total - t.salary + salary) return void (await say("❌ ميزانية الشركة ما تغطي الراتب الجديد."));
      }
      await CompanyMember.updateOne({ _id: t._id }, { $set: { title: def.name, salary } });
      await addLog(guildId, cid, `🔁 ${mention(uid)} نقل ${mention(t.userId)} من **${t.title}** إلى **${def.name}**`);
      return void (await show(`🔁 صار **${def.name}** (${jenny(salary)} يوميًا).`));
    }

    if (act === "upg" && i.isButton()) {
      const next = PROMOTIONS[t.title];
      if (!next || titleLevel(next) <= levelOf(me)) return void (await say("❌ ما فيه ترقية متاحة لك لهذي الوظيفة."));
      const salary = company.positions.find((p) => p.title === next)?.salary ?? t.salary;
      if (salary > t.salary) {
        const total = await payrollTotal(cid);
        if (company.budget < total - t.salary + salary) return void (await say("❌ ميزانية الشركة ما تغطي الراتب الجديد."));
      }
      await CompanyMember.updateOne({ _id: t._id }, { $set: { title: next, salary } });
      await addLog(guildId, cid, `📈 ${mention(uid)} رقّى ${mention(t.userId)} من **${t.title}** إلى **${next}**`);
      return void (await show(`📈 تمت ترقيته إلى **${next}** (${jenny(salary)} يوميًا).`));
    }

    if (act === "fire" && i.isButton()) {
      await CompanyMember.deleteOne({ _id: t._id });
      await addLog(guildId, cid, `🥾 ${mention(uid)} فصل ${mention(t.userId)} (${t.title})`);
      return void (await i.update({ content: `🥾 تم فصل ${mention(t.userId)}.`, embeds: [], components: [], allowedMentions: { users: [] } }));
    }
    if (act === "offc" && i.isButton()) {
      const toBoard = t.role !== "official";
      await CompanyMember.updateOne({ _id: t._id }, { $set: toBoard ? { role: "official", title: BOARD_TITLE } : { role: "employee", title: "عامل نظافة" } });
      await addLog(guildId, cid, toBoard ? `🏛️ ${mention(uid)} عيّن ${mention(t.userId)} في مجلس الإدارة` : `🏛️ ${mention(uid)} سحب عضوية المجلس من ${mention(t.userId)}`);
      return void (await show(toBoard ? "🏛️ صار من مجلس الإدارة والمالكين." : "تم سحب عضوية المجلس (صار عامل نظافة)."));
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

type ReqRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>;

/** طلبات التوظيف المفتوحة اللي يقدر هذا الشخص يديرها (وظائف أقل من مستواه) */
async function visiblePostings(cid: string, me: ICompanyMember) {
  const ps = await CompanyPosting.find({ companyId: cid, open: true });
  return ps.filter((p) => titleLevel(p.title) > levelOf(me)).slice(0, 25);
}

async function postingList(cid: string, me: ICompanyMember, note?: string): Promise<View> {
  const ps = await visiblePostings(cid, me);
  if (!ps.length) return { content: note ?? "ما فيه طلبات توظيف معلقة.", embeds: [], components: [] };
  const counts = await Promise.all(ps.map((p) => CompanyApplication.countDocuments({ postingId: idOf(p) })));
  const lines = ps.map((p, k) => `**${p.title}** — ${jenny(p.salary)} • ${p.filled}/${p.slots} • ${counts[k]} متقدم`);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`co|rqsel|${cid}`)
    .setPlaceholder("اختر طلب توظيف")
    .addOptions(ps.map((p, k) => ({ label: p.title.slice(0, 90), description: `${counts[k]} متقدم • ${p.filled}/${p.slots}`, value: idOf(p) })));
  return {
    content: note ?? "",
    embeds: [new EmbedBuilder().setColor(COLOR).setTitle("📋 قائمة الطلبات").setDescription(lines.join("\n"))],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
  };
}

async function postingDetail(i: AnyI, cid: string, p: { _id: unknown; title: string; slots: number; filled: number; salary: number }): Promise<View> {
  const apps = await CompanyApplication.find({ postingId: idOf(p) }).limit(25);
  const names = await Promise.all(apps.map(async (ap) => (await i.guild?.members.fetch(ap.userId).catch(() => null))?.displayName ?? ap.userId));
  const lines = apps.map((ap, k) => `${k + 1}. ${mention(ap.userId)} — ${ap.about.slice(0, 120)}`);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`📢 ${p.title}`)
    .setDescription([`الراتب: ${jenny(p.salary)} يوميًا`, `المقاعد: ${p.filled}/${p.slots}`, "", lines.join("\n") || "ما فيه متقدمين للحين."].join("\n"));
  const rows: ReqRow[] = [];
  if (apps.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`co|rqapp|${cid}|${idOf(p)}`)
          .setPlaceholder("اختر متقدم لقبوله أو رفضه")
          .addOptions(apps.map((ap, k) => ({ label: names[k].slice(0, 90), description: ap.about.slice(0, 90) || "بدون وصف", value: idOf(ap) }))),
      ),
    );
  }
  rows.push(row(btn(`co|reqs|${cid}`, "رجوع", ButtonStyle.Secondary), btn(`co|rqdel|${cid}|${idOf(p)}`, "حذف الطلب", ButtonStyle.Danger, "🗑️")));
  return { content: "", embeds: [embed], components: rows };
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
