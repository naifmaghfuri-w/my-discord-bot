import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle,
  type BaseMessageOptions, type ButtonInteraction, type ChatInputCommandInteraction, type Message, type ModalSubmitInteraction, type StringSelectMenuInteraction,
} from "discord.js";
import { config } from "../config";
import { jenny } from "../constants";
import { Inventory } from "../database/models/Inventory";
import { Mail, MailState } from "../database/models/Mail";
import { UserProfile } from "../database/models/UserProfile";
import { CAR_IDS, ITEMS, PHONE_IDS } from "../shop/data";
import { logger } from "../utils/logger";

/** !ارسل ايميل (لمالك البوت فقط) */
export const MAIL_SEND_TRIGGER = /^!\s*[اإأ]رسل\s+[اإأ]يميل$/;

const COLOR = 0x3498db;
const PER_PAGE = 4;
const eph = { flags: MessageFlags.Ephemeral } as const;
const btn = (id: string, label: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
const row = (...b: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);
const cid = (owner: string, act: string, a = "", b = "", c = "", d = "") => `mail|${owner}|${act}|${a}|${b}|${c}|${d}`;
const ts = (d: Date | string): number => Math.floor(new Date(d).getTime() / 1000);
const isOwner = (id: string): boolean => Boolean(config.ownerId) && id === config.ownerId;

type Filter = "all" | "unread" | "deleted";
type Sort = "new" | "old";
type Rewards = { coins: number; items: { id: string; count: number }[] };
const UNIQUE = new Set<string>([...CAR_IDS, ...PHONE_IDS]);

/* ───────── الجوائز ───────── */

const normAr = (s: string): string => s.replace(/[أإآ]/g, "ا").replace(/\s+/g, " ").trim().toLowerCase();
const toNum = (s: string): number => {
  const t = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/[,٬،\s]/g, "");
  return /^\d+$/.test(t) ? Number(t) : NaN;
};

/** يقرأ نص الجوائز: سطر لكل جائزة. "5000" أو "عملة 5000" = عملة، و"ورد 3" أو "iphone_18" = غرض */
export function parseRewards(text: string): Rewards & { errors: string[] } {
  const out: Rewards & { errors: string[] } = { coins: 0, items: [], errors: [] };
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const coin = /^(?:(?:عملة|عملات|فلوس|stk)\s+)?([\d٠-٩,٬،]+)(?:\s*(?:عملة|عملات|فلوس|stk))?$/i.exec(line);
    if (coin && Number.isFinite(toNum(coin[1]))) {
      out.coins += toNum(coin[1]);
      continue;
    }
    const m = /^(.+?)(?:\s+([\d٠-٩]+))?$/.exec(line);
    const name = normAr(m?.[1] ?? line);
    const count = m?.[2] ? toNum(m[2]) : 1;
    const key = (Object.keys(ITEMS) as (keyof typeof ITEMS)[]).find((k) => k.toLowerCase() === name || normAr(ITEMS[k].name) === name);
    if (!key || !(count >= 1 && count <= 100)) {
      out.errors.push(line);
      continue;
    }
    const cur = out.items.find((x) => x.id === key);
    if (cur) cur.count += count;
    else out.items.push({ id: key, count });
  }
  if (out.coins > 10_000_000) out.errors.push("العملة أكثر من 10,000,000");
  return out;
}

const hasRewards = (m: { coins?: number | null; items?: unknown[] | null }): boolean => (m.coins ?? 0) > 0 || (m.items?.length ?? 0) > 0;

function rewardsText(m: { coins?: number | null; items?: { id?: string | null; count?: number | null }[] | null }): string {
  const parts: string[] = [];
  if ((m.coins ?? 0) > 0) parts.push(jenny(m.coins as number));
  for (const it of m.items ?? []) {
    const def = ITEMS[String(it.id) as keyof typeof ITEMS];
    if (def) parts.push(`${def.name}${(it.count ?? 1) > 1 ? ` ×${it.count}` : ""}`);
  }
  return parts.join(" • ");
}

/* ───────── الواجهات ───────── */

async function load(userId: string, filter: Filter, sort: Sort) {
  const mails = await Mail.find().sort({ createdAt: -1 }).limit(200);
  const states = await MailState.find({ userId, mailId: { $in: mails.map((m) => String(m._id)) } });
  const st = new Map(states.map((s) => [s.mailId, s]));
  let rows = mails.map((m) => ({ m, s: st.get(String(m._id)) }));
  const unread = rows.filter((r) => !r.s?.deleted && !r.s?.read).length;
  rows = rows.filter((r) => (filter === "deleted" ? Boolean(r.s?.deleted) : !r.s?.deleted && (filter === "all" || !r.s?.read)));
  if (sort === "old") rows.reverse();
  return { rows, unread };
}

const FILTER_NAME: Record<Filter, string> = { all: "كل الرسائل", unread: "غير المقروءة", deleted: "المحذوفة" };

async function listView(owner: string, filter: Filter, sort: Sort, pageArg: number, note?: string): Promise<BaseMessageOptions> {
  const { rows, unread } = await load(owner, filter, sort);
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = Math.min(Math.max(0, pageArg), pages - 1);
  const shown = rows.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const lines = shown.map((r, k) => `**${k + 1}.** ${r.s?.read ? "" : "● "}${r.m.title}\n↳ <t:${ts(r.m.createdAt)}:f>${hasRewards(r.m) ? (r.s?.claimed ? " • جوائز: مستلمة" : " • جوائز: بانتظارك") : ""}`);
  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("صندوق البريد")
    .setDescription([note ?? "", lines.join("\n\n") || "ما فيه رسائل هنا."].filter(Boolean).join("\n\n"))
    .setFooter({ text: `${FILTER_NAME[filter]} • ${sort === "new" ? "الأحدث أولًا" : "الأقدم أولًا"} • غير مقروء: ${unread} • صفحة ${page + 1}/${pages}` });

  const menu = new StringSelectMenuBuilder()
    .setCustomId(cid(owner, "sel", filter, sort))
    .setPlaceholder(`الفلتر: ${FILTER_NAME[filter]}`)
    .addOptions(
      { label: "كل الرسائل", value: "all", default: filter === "all" },
      { label: "غير المقروءة", value: "unread", default: filter === "unread" },
      { label: "المحذوفة", value: "deleted", default: filter === "deleted" },
      { label: "الأحدث أولًا", value: "new", default: false },
      { label: "الأقدم أولًا", value: "old", default: false },
    );
  const components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] = [];
  if (shown.length) components.push(row(...shown.map((r, k) => btn(cid(owner, "op", String(r.m._id), filter, sort, String(page)), `فتح ${k + 1}`, ButtonStyle.Primary))));
  components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu));
  components.push(row(btn(cid(owner, "ls", filter, sort, String(page - 1)), "السابق").setDisabled(page <= 0), btn(cid(owner, "ls", filter, sort, String(page + 1)), "التالي").setDisabled(page >= pages - 1)));
  return { embeds: [embed], components: components as ActionRowBuilder<any>[], content: "" };
}

async function openView(owner: string, mailId: string, filter: Filter, sort: Sort, page: number, note?: string): Promise<BaseMessageOptions | null> {
  const mail = await Mail.findById(mailId);
  if (!mail) return null;
  await MailState.updateOne({ userId: owner, mailId }, { $set: { read: true } }, { upsert: true });
  const s = await MailState.findOne({ userId: owner, mailId });
  const rw = hasRewards(mail);
  const desc = [note ?? "", mail.body, rw ? `\n**الجوائز:** ${rewardsText(mail)}${s?.claimed ? " (تم الاستلام)" : ""}` : "", `\n<t:${ts(mail.createdAt)}:f>`].filter(Boolean).join("\n");
  const embed = new EmbedBuilder().setColor(COLOR).setTitle(mail.title.slice(0, 250)).setDescription(desc.slice(0, 4000));
  const back = btn(cid(owner, "ls", filter, sort, String(page)), "رجوع");
  const bs: ButtonBuilder[] = [back];
  if (rw) bs.push(s?.claimed ? btn("mail|noop", "تم استلام الجوائز").setDisabled(true) : btn(cid(owner, "cl", mailId, filter, sort, String(page)), "استلام الجوائز", ButtonStyle.Success));
  if (s?.deleted) bs.push(btn(cid(owner, "rs", mailId, filter, sort, String(page)), "استرجاع", ButtonStyle.Primary));
  else bs.push(btn(cid(owner, "dl", mailId, filter, sort, String(page)), "حذف", ButtonStyle.Danger).setDisabled(rw && !s?.claimed));
  return { embeds: [embed], components: [row(...bs)], content: "" };
}

/* ───────── استلام الجوائز ───────── */

async function claim(userId: string, guildId: string, mailId: string): Promise<string> {
  const mail = await Mail.findById(mailId);
  if (!mail || !hasRewards(mail)) return "❌ ما فيه جوائز في هذي الرسالة.";
  // نحجز الاستلام أول (مرة وحدة)، وبعدها ندفع
  const reserved = await MailState.findOneAndUpdate({ userId, mailId, claimed: { $ne: true } }, { $set: { claimed: true, read: true } }, { upsert: true }).then(() => true, () => false);
  if (!reserved) return "❌ استلمت جوائز هذي الرسالة من قبل.";
  try {
    let coins = mail.coins ?? 0;
    const inc: Record<string, number> = {};
    const inv = await Inventory.findOne({ userId, guildId }, { items: 1 });
    const have = (inv?.items ?? {}) as Record<string, number>;
    const notes: string[] = [];
    for (const it of mail.items ?? []) {
      const id = String(it.id);
      const def = ITEMS[id as keyof typeof ITEMS];
      if (!def) continue;
      if (UNIQUE.has(id)) {
        if (Number(have[id] ?? 0) > 0) {
          const back = Math.floor(def.price / 2);
          coins += back;
          notes.push(`${def.name} عندك من قبل، أخذت نص سعره ${jenny(back)}`);
        } else inc[`items.${id}`] = 1;
      } else inc[`items.${id}`] = Number(it.count ?? 1);
    }
    if (coins > 0) await UserProfile.updateOne({ userId, guildId }, { $inc: { coins } }, { upsert: true });
    if (Object.keys(inc).length) await Inventory.updateOne({ userId, guildId }, { $inc: inc }, { upsert: true });
    return `✅ استلمت: ${rewardsText(mail)}${notes.length ? `\n${notes.join("\n")}` : ""}`;
  } catch (err) {
    logger.error("فشل استلام جوائز الايميل", err);
    await MailState.updateOne({ userId, mailId }, { $set: { claimed: false } }).catch(() => undefined);
    return "❌ صار خطأ، حاول مرة ثانية.";
  }
}

/* ───────── /mail ───────── */

export async function handleMailSlash(i: ChatInputCommandInteraction): Promise<void> {
  if (!i.inGuild()) return void (await i.reply({ content: "هذا الأمر داخل السيرفر فقط.", ...eph }));
  await i.reply({ ...(await listView(i.user.id, "all", "new", 0)), ...eph });
}

/* ───────── !ارسل ايميل (المالك) ───────── */

export async function handleMailSendMessage(message: Message): Promise<boolean> {
  if (!message.inGuild() || !MAIL_SEND_TRIGGER.test(message.content.trim())) return false;
  if (!isOwner(message.author.id)) {
    await message.reply({ content: "❌ هذا الأمر لمالك البوت فقط.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return true;
  }
  await message.reply({ content: "اضغط الزر لكتابة الايميل (العنوان، النص، الجوائز).", components: [row(btn("mail|compose", "كتابة ايميل", ButtonStyle.Primary))], allowedMentions: { repliedUser: false } }).catch(() => undefined);
  return true;
}

const field = (id: string, label: string, style: TextInputStyle, required: boolean, max: number, ph?: string) => {
  const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
  if (ph) t.setPlaceholder(ph);
  return new ActionRowBuilder<TextInputBuilder>().addComponents(t);
};

/* ───────── التفاعلات ───────── */

export async function handleMailComponent(i: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void> {
  if (!i.inGuild()) return;
  const [, owner, act, a, b, c, d] = i.customId.split("|");

  // كتابة ايميل (المالك)
  if (owner === "compose" && i.isButton()) {
    if (!isOwner(i.user.id)) return void (await i.reply({ content: "❌ لمالك البوت فقط.", ...eph }));
    const m = new ModalBuilder()
      .setCustomId("mail|composem")
      .setTitle("ايميل جديد")
      .addComponents(
        field("title", "العنوان", TextInputStyle.Short, true, 100, "تحديث 1.0"),
        field("body", "النص", TextInputStyle.Paragraph, true, 3500),
        field("rewards", "الجوائز (اختياري، سطر لكل جائزة)", TextInputStyle.Paragraph, false, 400, "5000\nورد 3\nآيفون 18"),
      );
    return void (await i.showModal(m));
  }
  if (owner === "composem" && i.isModalSubmit()) {
    if (!isOwner(i.user.id)) return void (await i.reply({ content: "❌ لمالك البوت فقط.", ...eph }));
    const title = i.fields.getTextInputValue("title").trim();
    const body = i.fields.getTextInputValue("body").trim();
    const rw = parseRewards(i.fields.getTextInputValue("rewards") ?? "");
    if (!title || !body) return void (await i.reply({ content: "❌ العنوان والنص مطلوبين.", ...eph }));
    if (rw.errors.length) {
      return void (await i.reply({
        content: `❌ ما فهمت هذي الجوائز:\n${rw.errors.map((x) => `• ${x}`).join("\n")}\n\nاكتب كل جائزة في سطر: رقم للعملة (مثل \`5000\`)، أو اسم الغرض ثم العدد (مثل \`ورد 3\`)، أو ايدي الغرض (مثل \`iphone_18\`).`,
        ...eph,
      }));
    }
    await Mail.create({ title, body, coins: rw.coins, items: rw.items, by: i.user.id });
    return void (await i.reply({ content: `✅ تم إرسال الايميل لكل اللاعبين (يظهرون في \`/mail\`).${rw.coins || rw.items.length ? `\nالجوائز: ${rewardsText(rw)}` : "\nبدون جوائز."}`, ...eph }));
  }
  if (owner === "noop") return void (await (i as ButtonInteraction).deferUpdate());

  // باقي التفاعلات خاصة بصاحب الصندوق
  if (i.user.id !== owner) return void (await i.reply({ content: "هذا مو صندوقك، اكتب `/mail`.", ...eph }));
  if (i.isModalSubmit()) return;
  const filter = (["all", "unread", "deleted"].includes(a) ? a : "all") as Filter;

  if (act === "sel" && i.isStringSelectMenu()) {
    const v = i.values[0];
    const f: Filter = v === "all" || v === "unread" || v === "deleted" ? v : (a as Filter);
    const s: Sort = v === "new" || v === "old" ? v : (b as Sort);
    return void (await i.update(await listView(owner, f, s, 0)));
  }
  if (!i.isButton()) return;
  const sort: Sort = (act === "ls" ? b : c) === "old" ? "old" : "new";
  const pageStr = act === "ls" ? c : d;
  const page = Number(pageStr) || 0;

  if (act === "ls") return void (await i.update(await listView(owner, filter, sort, page)));
  // رسائل فيها mailId: a = mailId، b = filter، c = sort، d = page
  const mailId = a;
  const f2 = (["all", "unread", "deleted"].includes(b) ? b : "all") as Filter;
  const s2: Sort = c === "old" ? "old" : "new";
  const p2 = Number(d) || 0;

  if (act === "op") {
    const v = await openView(owner, mailId, f2, s2, p2);
    return void (await i.update(v ?? (await listView(owner, f2, s2, p2, "❌ الرسالة ما عادت موجودة."))));
  }
  if (act === "cl") {
    const note = await claim(owner, i.guildId as string, mailId);
    const v = await openView(owner, mailId, f2, s2, p2, note);
    return void (await i.update(v ?? (await listView(owner, f2, s2, p2, note))));
  }
  if (act === "dl" || act === "rs") {
    if (act === "dl") {
      const mail = await Mail.findById(mailId);
      const s = await MailState.findOne({ userId: owner, mailId });
      if (mail && hasRewards(mail) && !s?.claimed) {
        const v = await openView(owner, mailId, f2, s2, p2, "❌ استلم الجوائز أول قبل الحذف.");
        return void (await i.update(v ?? (await listView(owner, f2, s2, p2))));
      }
    }
    await MailState.updateOne({ userId: owner, mailId }, { $set: { deleted: act === "dl" } }, { upsert: true });
    return void (await i.update(await listView(owner, f2, s2, p2, act === "dl" ? "🗑️ تم حذف الرسالة (تجدها في فلتر المحذوفة)." : "تم استرجاع الرسالة.")));
  }
}
