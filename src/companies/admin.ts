import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
  type Guild,
  type Interaction,
  type Message,
  type StringSelectMenuInteraction,
  type UserSelectMenuInteraction,
} from "discord.js";
import { config } from "../config";
import { jenny } from "../constants";
import { Company, CompanyLog, CompanyMember, type ICompanyMember } from "../database/models/Company";
import { logger } from "../utils/logger";
import { BOARD_TITLE, TITLES, levelOf, titleByKey } from "./titles";

/** !تعديل شركة [اسم الشركة] — لمالك البوت/السيرفر فقط */
export const COMPANY_ADMIN_TRIGGER = /^!\s*تعديل\s+شرك(?:ة|ه)(?:\s+([\s\S]+))?$/;

const P = "ca";
const COLOR = 0xe67e22;
const eph = { flags: MessageFlags.Ephemeral } as const;
const id = (...a: string[]): string => [P, ...a].join("|");
const mention = (u: string): string => `<@${u}>`;
const NO_PING = { parse: [] as never[] };

const isAdmin = (userId: string, guild: Guild): boolean => userId === guild.ownerId || (!!config.ownerId && userId === config.ownerId);
const addLog = (guildId: string, companyId: string, text: string) => CompanyLog.create({ guildId, companyId, text }).catch(() => undefined);

const roleLabel = (m: { role: string; title: string }): string => (m.role === "owner" ? "👑 المالك" : m.role === "official" ? "🏛️ مجلس" : `👷 ${m.title}`);

function rankKey(x: ICompanyMember): [number, number] {
  const idx = TITLES.findIndex((t) => t.name === x.title);
  return [x.role === "owner" ? -1 : levelOf(x), idx < 0 ? 0 : idx];
}

/* ───────────── العروض ───────────── */

async function listView(guildId: string, uid: string, companies: { _id: unknown; name: string; budget: number }[], note?: string): Promise<BaseMessageOptions> {
  void guildId;
  const embed = new EmbedBuilder().setColor(COLOR).setTitle("🛠️ تعديل الشركات").setDescription(note ?? "اختر الشركة اللي تبي تعدّل مناصبها:");
  if (companies.length === 0) return { content: "", embeds: [embed.setDescription("ما فيه شركات.")], components: [] };
  const menu = new StringSelectMenuBuilder()
    .setCustomId(id("pick", uid))
    .setPlaceholder("اختر شركة")
    .addOptions(companies.slice(0, 25).map((c) => ({ label: c.name.slice(0, 100), description: `الميزانية ${Math.round(c.budget)}`, value: String(c._id) })));
  return { content: "", embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], allowedMentions: NO_PING };
}

async function panelView(cid: string, uid: string, note?: string): Promise<BaseMessageOptions> {
  const c = await Company.findById(cid).select("-logo");
  if (!c) return { content: "❌ الشركة ما عادت موجودة.", embeds: [], components: [] };
  const members = (await CompanyMember.find({ companyId: cid })).sort((p, q) => {
    const a = rankKey(p), b = rankKey(q);
    return a[0] - b[0] || a[1] - b[1];
  });
  const lines = members.slice(0, 25).map((m) => `${roleLabel(m)} ${mention(m.userId)} — ${m.title}`);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle(`🛠️ ${c.name}`)
    .setDescription([note ?? "", `💰 الميزانية: ${jenny(c.budget)}`, `👥 الأعضاء: **${members.length}**`, "", lines.join("\n") || "ما فيه أعضاء."].filter((x, i) => x !== "" || i > 0).join("\n"));
  const btn = (act: string, label: string, style: ButtonStyle, emoji: string) => new ButtonBuilder().setCustomId(id(act, uid, cid)).setLabel(label).setStyle(style).setEmoji(emoji);
  return {
    content: "",
    embeds: [embed],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(btn("own", "نقل الملكية", ButtonStyle.Primary, "👑"), btn("pos", "تعيين منصب", ButtonStyle.Success, "🏷️"), btn("fire", "فصل عضو", ButtonStyle.Danger, "🥾")),
      new ActionRowBuilder<ButtonBuilder>().addComponents(btn("back", "الشركات", ButtonStyle.Secondary, "🔙"), btn("close", "إغلاق", ButtonStyle.Secondary, "✖️")),
    ],
    allowedMentions: NO_PING,
  };
}

function userPicker(act: string, uid: string, cid: string, placeholder: string): UserSelectMenuBuilder {
  return new UserSelectMenuBuilder().setCustomId(id(act, uid, cid)).setPlaceholder(placeholder).setMinValues(1).setMaxValues(1);
}

/* ───────────── الأمر ───────────── */

export async function handleCompanyAdminMessage(message: Message<true>): Promise<void> {
  const reply = (content: string) => message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => undefined);
  if (!isAdmin(message.author.id, message.guild)) return void (await reply("❌ هذا الأمر لمالك البوت فقط."));
  const query = (COMPANY_ADMIN_TRIGGER.exec(message.content.trim())?.[1] ?? "").trim();
  const guildId = message.guildId;
  const uid = message.author.id;

  let companies = await Company.find({ guildId }, { name: 1, budget: 1 }).sort({ budget: -1 }).limit(100);
  if (query) {
    const q = query.toLowerCase();
    const exact = companies.filter((c) => c.name.toLowerCase() === q);
    const part = companies.filter((c) => c.name.toLowerCase().includes(q));
    companies = exact.length ? exact : part;
    if (!companies.length) return void (await reply("❌ ما لقيت شركة بهذا الاسم."));
  }
  const view = companies.length === 1 && query ? await panelView(String(companies[0]._id), uid) : await listView(guildId, uid, companies);
  await message.channel.send(view).catch((err) => logger.error("فشل فتح لوحة تعديل الشركة", err));
}

/* ───────────── التفاعلات ───────────── */

type AnyI = ButtonInteraction | StringSelectMenuInteraction | UserSelectMenuInteraction;

export async function handleCompanyAdminInteraction(i: Interaction): Promise<boolean> {
  if (!(i.isButton() || i.isStringSelectMenu() || i.isUserSelectMenu())) return false;
  if (!i.customId.startsWith(`${P}|`)) return false;
  if (!i.inGuild() || !i.guild) return true;
  try {
    await route(i);
  } catch (err) {
    logger.error("خطأ في تعديل الشركة", err);
    if (!i.replied && !i.deferred) await i.reply({ content: "⚠️ صار خطأ.", ...eph }).catch(() => undefined);
  }
  return true;
}

async function route(i: AnyI): Promise<void> {
  const [, act, uid, cid, extra, mode] = i.customId.split("|");
  const guild = i.guild as Guild;
  const guildId = guild.id;
  if (i.user.id !== uid || !isAdmin(i.user.id, guild)) return void (await i.reply({ content: "❌ هذي اللوحة مو لك.", ...eph }));

  if (act === "close" && i.isButton()) return void (await i.update({ content: "تم الإغلاق.", embeds: [], components: [] }));
  if (act === "back" && i.isButton()) {
    const companies = await Company.find({ guildId }, { name: 1, budget: 1 }).sort({ budget: -1 }).limit(25);
    return void (await i.update(await listView(guildId, uid, companies)));
  }
  if (act === "pick" && i.isStringSelectMenu()) return void (await i.update(await panelView(i.values[0], uid)));

  const company = await Company.findOne({ _id: cid, guildId }).select("-logo");
  if (!company) return void (await i.update({ content: "❌ الشركة ما عادت موجودة.", embeds: [], components: [] }));
  const back = async (note: string) => i.update(await panelView(cid, uid, note));
  const userRow = (m: UserSelectMenuBuilder) => new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(m);
  const strRow = (m: StringSelectMenuBuilder) => new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(m);
  const btnRow = (...b: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);

  /* --- فتح قوائم اختيار العضو --- */
  if (i.isButton() && (act === "own" || act === "pos" || act === "fire")) {
    const text = act === "own" ? "👑 اختر المالك الجديد:" : act === "pos" ? "🏷️ اختر العضو اللي تعيّن له منصب (من الشركة أو من برا):" : "🥾 اختر العضو اللي تفصله:";
    const menu = userPicker(`${act}u`, uid, cid, "اختر عضو");
    const cancel = new ButtonBuilder().setCustomId(id("cancel", uid, cid)).setLabel("رجوع").setStyle(ButtonStyle.Secondary);
    return void (await i.update({ content: text, embeds: [], components: [userRow(menu), btnRow(cancel)] }));
  }
  if (i.isButton() && act === "cancel") return void (await i.update(await panelView(cid, uid)));

  /* --- بعد اختيار العضو --- */
  if (i.isUserSelectMenu() && (act === "ownu" || act === "posu" || act === "fireu")) {
    const target = i.values[0];
    const gm = await guild.members.fetch(target).catch(() => null);
    if (!gm || gm.user.bot) return void (await back("❌ اختر عضو صالح في السيرفر."));
    const mine = await CompanyMember.findOne({ guildId, userId: target });
    if (act === "fireu") {
      if (!mine || mine.companyId !== cid) return void (await back("❌ هذا العضو مو في الشركة."));
      if (mine.role === "owner") return void (await back("❌ هذا المالك، انقل الملكية أول."));
      await CompanyMember.deleteOne({ _id: mine._id });
      await addLog(guildId, cid, `🛠️ ${mention(uid)} (إدارة البوت) فصل ${mention(target)}`);
      return void (await back(`🥾 انفصل ${mention(target)}.`));
    }
    if (mine && mine.companyId !== cid) return void (await back("❌ هذا العضو في شركة ثانية، لازم يطلع منها أول."));
    if (act === "posu") {
      if (mine?.role === "owner") return void (await back("❌ هذا المالك، انقل الملكية لغيره أول."));
      const options = [{ label: BOARD_TITLE, description: "مجلس الإدارة", value: "board" }, ...TITLES.map((t) => ({ label: t.name, description: t.group, value: t.key }))].slice(0, 25);
      const menu = new StringSelectMenuBuilder().setCustomId(id("posel", uid, cid, target)).setPlaceholder("اختر المنصب").addOptions(options);
      const cancel = new ButtonBuilder().setCustomId(id("cancel", uid, cid)).setLabel("رجوع").setStyle(ButtonStyle.Secondary);
      return void (await i.update({ content: `🏷️ اختر منصب ${mention(target)}:`, embeds: [], components: [strRow(menu), btnRow(cancel)], allowedMentions: NO_PING }));
    }
    // نقل الملكية: نسأل عن مصير المالك السابق
    if (company.ownerId === target) return void (await back("ℹ️ هذا هو المالك الحالي."));
    const b = (m: string, label: string, style: ButtonStyle) => new ButtonBuilder().setCustomId(id("ownf", uid, cid, target, m)).setLabel(label).setStyle(style);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      b("board", "يبقى مجلس إدارة", ButtonStyle.Primary),
      b("emp", "يصير موظف", ButtonStyle.Secondary),
      b("out", "يطلع من الشركة", ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(id("cancel", uid, cid)).setLabel("إلغاء").setStyle(ButtonStyle.Secondary),
    );
    return void (await i.update({ content: `👑 ${mention(target)} يصير مالك **${company.name}**.\nوش يصير للمالك السابق ${mention(company.ownerId)}؟`, embeds: [], components: [row], allowedMentions: NO_PING }));
  }

  /* --- تنفيذ تعيين المنصب --- */
  if (i.isStringSelectMenu() && act === "posel") {
    const target = extra;
    const mine = await CompanyMember.findOne({ guildId, userId: target });
    if (mine && mine.companyId !== cid) return void (await back("❌ هذا العضو في شركة ثانية."));
    if (mine?.role === "owner" || company.ownerId === target) return void (await back("❌ هذا المالك، انقل الملكية أول."));
    const v = i.values[0];
    const isBoard = v === "board";
    const def = isBoard ? null : titleByKey(v);
    if (!isBoard && !def) return void (await back("❌ منصب غير صالح."));
    const title = isBoard ? BOARD_TITLE : (def?.name as string);
    const role = isBoard ? "official" : "employee";
    const salary = isBoard ? mine?.salary ?? 0 : company.positions.find((p) => p.title === title)?.salary ?? mine?.salary ?? 0;
    if (mine) await CompanyMember.updateOne({ _id: mine._id }, { $set: { role, title, salary } });
    else await CompanyMember.create({ guildId, companyId: cid, userId: target, role, title, salary });
    await addLog(guildId, cid, `🛠️ ${mention(uid)} (إدارة البوت) ${mine ? "غيّر منصب" : "أضاف"} ${mention(target)} إلى **${title}**`);
    return void (await back(`🏷️ ${mention(target)} صار **${title}**.`));
  }

  /* --- تنفيذ نقل الملكية --- */
  if (i.isButton() && act === "ownf") {
    const target = extra;
    const oldId = company.ownerId;
    if (oldId === target) return void (await back("ℹ️ هذا هو المالك الحالي."));
    const mine = await CompanyMember.findOne({ guildId, userId: target });
    if (mine && mine.companyId !== cid) return void (await back("❌ المالك الجديد في شركة ثانية."));
    const moved = await Company.findOneAndUpdate({ _id: cid, ownerId: oldId }, { $set: { ownerId: target } });
    if (!moved) return void (await back("⚠️ تغيّر المالك قبل التنفيذ، افتح اللوحة من جديد."));
    // المالك الجديد
    if (mine) await CompanyMember.updateOne({ _id: mine._id }, { $set: { role: "owner", title: "المالك", salary: 0, penalty: 0 } });
    else await CompanyMember.create({ guildId, companyId: cid, userId: target, role: "owner", title: "المالك", salary: 0 });
    // المالك السابق
    if (mode === "out") await CompanyMember.deleteOne({ companyId: cid, userId: oldId });
    else if (mode === "board") await CompanyMember.updateOne({ companyId: cid, userId: oldId }, { $set: { role: "official", title: BOARD_TITLE } });
    else await CompanyMember.updateOne({ companyId: cid, userId: oldId }, { $set: { role: "employee", title: "عامل نظافة" } });
    const fate = mode === "out" ? "طلع من الشركة" : mode === "board" ? "صار مجلس إدارة" : "صار موظف";
    await addLog(guildId, cid, `🛠️ ${mention(uid)} (إدارة البوت) نقل الملكية من ${mention(oldId)} إلى ${mention(target)} (السابق ${fate})`);
    return void (await back(`👑 ${mention(target)} صار المالك، والمالك السابق ${fate}.`));
  }
}
