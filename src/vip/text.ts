import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type Guild,
  type Interaction,
  type Message,
  type ModalSubmitInteraction,
  type Role,
  type StringSelectMenuInteraction,
} from "discord.js";
import { config } from "../config";
import { UserProfile } from "../database/models/UserProfile";
import { VipRole } from "../database/models/VipRole";
import { logger } from "../utils/logger";
import { renderVipBanner, VIP_PLANS } from "./card";

/** !انشاء رتبة خاصة — لمالك البوت/السيرفر فقط */
export const VIP_TRIGGER = /^!\s*(?:انشاء|إنشاء|انشاء|سوي|لوحة)\s+رتب(?:ة|ه)\s+خاص(?:ة|ه)(?:\s+([\s\S]+))?$/;

const eph = { flags: MessageFlags.Ephemeral } as const;
const COLOR = 0xa78bfa;
const P = "vip";
const id = (...a: string[]): string => [P, ...a].join("|");

function isOwner(userId: string, guild: Guild): boolean {
  return userId === guild.ownerId || (!!config.ownerId && userId === config.ownerId);
}

function panelRows(): ActionRowBuilder<ButtonBuilder>[] {
  const b = (cid: string, label: string, style: ButtonStyle) => new ButtonBuilder().setCustomId(id(cid)).setLabel(label).setStyle(style);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(b("create", "انشاء رتبة", ButtonStyle.Primary), b("rename", "تغيير الاسم", ButtonStyle.Secondary)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(b("icon", "تغيير الصورة", ButtonStyle.Secondary), b("color", "تغيير اللون", ButtonStyle.Secondary)),
    new ActionRowBuilder<ButtonBuilder>().addComponents(b("sub", "اشتراك", ButtonStyle.Primary), b("remove", "ازالة", ButtonStyle.Danger), b("add", "اضافة", ButtonStyle.Success)),
  ];
}

export async function handleVipMessage(message: Message<true>): Promise<void> {
  if (!isOwner(message.author.id, message.guild)) {
    await message.reply({ content: "❌ هذا الأمر لمالك البوت فقط.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  const me = message.guild.members.me;
  if (!me?.permissions.has("ManageRoles")) {
    await message.reply({ content: "❌ البوت يحتاج صلاحية «إدارة الرتب».", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }

  const rest = (VIP_TRIGGER.exec(message.content.trim())?.[1] ?? "").trim();
  const att = message.attachments.find((a) => a.contentType?.startsWith("image/"));
  const link = /https?:\/\/\S+/.exec(rest)?.[0];
  const custom = att?.url ?? link ?? null;

  const embed = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("الرتب الخاصة")
    .setDescription(
      [
        "✥ اشترك واصنع رتبتك الخاصة باسمك ولونك وصورتك، وتظهر فوق كل رتبك.",
        "✥ رتبة وحدة فقط، تعدّل عليها متى شئت (الاسم واللون والصورة)، وتشيلها من نفسك وترجعها وقت ما تبي.",
        "✥ إذا انتهى الاشتراك تُحذف الرتبة، ولازم تشترك من جديد.",
        "",
        VIP_PLANS.map((p) => `✦ **${p.label}** — ${p.price.toLocaleString("en-US")} جيني`).join("\n"),
      ].join("\n"),
    )
    .setFooter({ text: message.guild.name });

  const files: AttachmentBuilder[] = [];
  if (custom) embed.setImage(custom);
  else {
    try {
      files.push(new AttachmentBuilder(await renderVipBanner(), { name: "vip.png" }));
      embed.setImage("attachment://vip.png");
    } catch (err) {
      logger.error("فشل رسم بانر الرتب الخاصة", err);
    }
  }

  await message.channel.send({ embeds: [embed], files, components: panelRows() }).catch(() => undefined);
  await message.delete().catch(() => undefined);
}

// ───────── أدوات ─────────

async function activeSub(guildId: string, userId: string) {
  const doc = await VipRole.findOne({ guildId, userId });
  if (!doc) return null;
  if (doc.expiresAt.getTime() <= Date.now()) return null;
  return doc;
}

async function fetchRole(guild: Guild, roleId: string | null): Promise<Role | null> {
  if (!roleId) return null;
  return guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
}

function parseColor(raw: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(raw.trim());
  return m ? parseInt(m[1], 16) : null;
}

const left = (d: Date): string => {
  const ms = Math.max(0, d.getTime() - Date.now());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days > 0 ? `${days} يوم و${hours} ساعة` : `${hours} ساعة`;
};

/** يرفع الرتبة فوق أعلى رتبة عند العضو (بحدود رتبة البوت) */
async function placeAbove(guild: Guild, role: Role, userId: string): Promise<boolean> {
  const member = await guild.members.fetch(userId).catch(() => null);
  const me = guild.members.me;
  if (!member || !me) return false;
  const highest = member.roles.cache.filter((r) => r.id !== role.id && r.id !== guild.id).reduce((m, r) => Math.max(m, r.position), 0);
  const cap = me.roles.highest.position - 1;
  const target = Math.min(highest + 1, cap);
  if (target <= 0) return false;
  await role.setPosition(target).catch(() => undefined);
  return highest + 1 <= cap;
}

async function deleteVip(guild: Guild | null, roleId: string | null): Promise<void> {
  if (!guild || !roleId) return;
  const role = await fetchRole(guild, roleId);
  await role?.delete("انتهاء اشتراك الرتبة الخاصة").catch(() => undefined);
}

// ───────── الأزرار ─────────

async function onButton(i: ButtonInteraction, act: string): Promise<void> {
  const guild = i.guild;
  if (!guild) return;

  if (act === "sub") {
    const doc = await activeSub(guild.id, i.user.id);
    const menu = new StringSelectMenuBuilder()
      .setCustomId(id("plan"))
      .setPlaceholder("اختر مدة الاشتراك")
      .addOptions(VIP_PLANS.map((p) => ({ label: `${p.label} — ${p.price.toLocaleString("en-US")} جيني`, value: p.id })));
    await i.reply({
      content: doc ? `✅ اشتراكك فعّال، باقي ${left(doc.expiresAt)}. اختيارك الجديد يمدّد المدة.` : "اختر مدة الاشتراك:",
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
      ...eph,
    });
    return;
  }

  const doc = await activeSub(guild.id, i.user.id);
  if (!doc) {
    await i.reply({ content: "❌ لازم تشترك أولاً (زر «اشتراك»).", ...eph });
    return;
  }

  if (act === "create") {
    if (await fetchRole(guild, doc.roleId)) {
      await i.reply({ content: "❌ عندك رتبة بالفعل، عدّلها من الأزرار.", ...eph });
      return;
    }
    const modal = new ModalBuilder().setCustomId(id("m", "create")).setTitle("انشاء رتبة خاصة").addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("name").setLabel("اسم الرتبة").setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(true)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("color").setLabel("اللون (مثال: #a78bfa) - اختياري").setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false)),
    );
    await i.showModal(modal);
    return;
  }

  const role = await fetchRole(guild, doc.roleId);
  if (!role) {
    await i.reply({ content: "❌ ما عندك رتبة، اضغط «انشاء رتبة» أولاً.", ...eph });
    return;
  }

  if (act === "rename") {
    const modal = new ModalBuilder().setCustomId(id("m", "rename")).setTitle("تغيير الاسم").addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("name").setLabel("الاسم الجديد").setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(true).setValue(role.name.slice(0, 50))),
    );
    await i.showModal(modal);
    return;
  }
  if (act === "color") {
    const modal = new ModalBuilder().setCustomId(id("m", "color")).setTitle("تغيير اللون").addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("color").setLabel("اللون (مثال: #ff5599)").setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(true)),
    );
    await i.showModal(modal);
    return;
  }
  if (act === "icon") {
    if (!guild.features.includes("ROLE_ICONS")) {
      await i.reply({ content: "❌ السيرفر ما يدعم صور الرتب (يحتاج بوست مستوى 2).", ...eph });
      return;
    }
    await i.reply({ content: "📷 أرسل الصورة (مرفق أو رابط) هنا في الشات خلال دقيقة.", ...eph });
    const ch = i.channel;
    if (!ch || !("awaitMessages" in ch)) return;
    const got = await ch.awaitMessages({ filter: (m) => m.author.id === i.user.id, max: 1, time: 60_000 }).catch(() => null);
    const m = got?.first();
    if (!m) return void (await i.editReply({ content: "⌛ انتهى الوقت." }).catch(() => undefined));
    const url = m.attachments.find((a) => a.contentType?.startsWith("image/"))?.url ?? /https?:\/\/\S+/.exec(m.content)?.[0];
    m.delete().catch(() => undefined);
    if (!url) return void (await i.editReply({ content: "❌ ما لقيت صورة." }).catch(() => undefined));
    const ok = await role.setIcon(url).then(() => true).catch(() => false);
    await i.editReply({ content: ok ? "✅ تم تغيير صورة الرتبة." : "❌ ما قدرت أحط الصورة (تأكد أنها PNG/JPG وحجمها صغير)." }).catch(() => undefined);
    return;
  }
  if (act === "add" || act === "remove") {
    const member = await guild.members.fetch(i.user.id).catch(() => null);
    if (!member) return void (await i.reply({ content: "❌ ما قدرت أجيب حسابك.", ...eph }));
    const has = member.roles.cache.has(role.id);
    if (act === "add" && has) return void (await i.reply({ content: "ℹ️ الرتبة عليك أصلاً.", ...eph }));
    if (act === "remove" && !has) return void (await i.reply({ content: "ℹ️ الرتبة مو عليك.", ...eph }));
    const ok = await (act === "add" ? member.roles.add(role) : member.roles.remove(role)).then(() => true).catch(() => false);
    await i.reply({ content: ok ? (act === "add" ? "✅ رجعت لك الرتبة." : "✅ انشالت الرتبة منك، ترجعها وقت ما تبي بزر «اضافة».") : "❌ ما قدرت أعدّل الرتبة (تأكد أن رتبة البوت أعلى منها).", ...eph });
  }
}

// ───────── القوائم ─────────

async function onPlan(i: StringSelectMenuInteraction): Promise<void> {
  const guild = i.guild;
  if (!guild) return;
  const plan = VIP_PLANS.find((p) => p.id === i.values[0]);
  if (!plan) return;
  await i.deferUpdate();

  const paid = await UserProfile.findOneAndUpdate({ userId: i.user.id, guildId: guild.id, coins: { $gte: plan.price } }, { $inc: { coins: -plan.price } });
  if (!paid) {
    await i.editReply({ content: `❌ رصيدك ما يكفي، تحتاج ${plan.price.toLocaleString("en-US")} جيني في المحفظة.`, components: [] });
    return;
  }

  try {
    const cur = await VipRole.findOne({ guildId: guild.id, userId: i.user.id });
    const base = cur && cur.expiresAt.getTime() > Date.now() ? cur.expiresAt.getTime() : Date.now();
    const expiresAt = new Date(base + plan.days * 86_400_000);
    await VipRole.updateOne({ guildId: guild.id, userId: i.user.id }, { $set: { expiresAt }, $setOnInsert: { roleId: cur?.roleId ?? null } }, { upsert: true });
    const hasRole = !!(await fetchRole(guild, cur?.roleId ?? null));
    await i.editReply({
      content: `✅ تم الاشتراك ${plan.label} (-${plan.price.toLocaleString("en-US")}).${hasRole ? "" : " الحين اضغط «انشاء رتبة»."}`,
      components: [],
    });
  } catch (err) {
    await UserProfile.updateOne({ userId: i.user.id, guildId: guild.id }, { $inc: { coins: plan.price } });
    logger.error("فشل الاشتراك بالرتبة الخاصة", err);
    await i.editReply({ content: "❌ صار خطأ، رجعت لك فلوسك.", components: [] }).catch(() => undefined);
  }
}

// ───────── النماذج ─────────

async function onModal(i: ModalSubmitInteraction, act: string): Promise<void> {
  const guild = i.guild;
  if (!guild) return;
  const doc = await activeSub(guild.id, i.user.id);
  if (!doc) return void (await i.reply({ content: "❌ اشتراكك منتهي.", ...eph }));

  if (act === "create") {
    if (await fetchRole(guild, doc.roleId)) return void (await i.reply({ content: "❌ عندك رتبة بالفعل.", ...eph }));
    const name = i.fields.getTextInputValue("name").trim();
    const raw = i.fields.getTextInputValue("color").trim();
    const color = raw ? parseColor(raw) : 0xa78bfa;
    if (color === null) return void (await i.reply({ content: "❌ اللون غلط، مثال: #a78bfa", ...eph }));
    await i.deferReply(eph);
    const role = await guild.roles.create({ name, color, permissions: [], mentionable: false, reason: `رتبة خاصة لـ ${i.user.tag}` }).catch(() => null);
    if (!role) return void (await i.editReply({ content: "❌ ما قدرت أنشئ الرتبة (تأكد من صلاحيات البوت)." }));
    await VipRole.updateOne({ guildId: guild.id, userId: i.user.id }, { $set: { roleId: role.id } });
    const member = await guild.members.fetch(i.user.id).catch(() => null);
    const above = await placeAbove(guild, role, i.user.id);
    await member?.roles.add(role).catch(() => undefined);
    await i.editReply({ content: `✅ انصنعت رتبتك <@&${role.id}> وتنتهي بعد ${left(doc.expiresAt)}.${above ? "" : "\n⚠️ ما قدرت أرفعها فوق كل رتبك، اطلب من الإدارة ترفع رتبة البوت."}` });
    return;
  }

  const role = await fetchRole(guild, doc.roleId);
  if (!role) return void (await i.reply({ content: "❌ ما عندك رتبة.", ...eph }));
  if (act === "rename") {
    const name = i.fields.getTextInputValue("name").trim();
    const ok = await role.setName(name).then(() => true).catch(() => false);
    await i.reply({ content: ok ? "✅ تم تغيير الاسم." : "❌ ما قدرت أغيّر الاسم.", ...eph });
  } else if (act === "color") {
    const color = parseColor(i.fields.getTextInputValue("color"));
    if (color === null) return void (await i.reply({ content: "❌ اللون غلط، مثال: #ff5599", ...eph }));
    const ok = await role.setColor(color).then(() => true).catch(() => false);
    await i.reply({ content: ok ? "✅ تم تغيير اللون." : "❌ ما قدرت أغيّر اللون.", ...eph });
  }
}

export async function handleVipComponent(i: Interaction): Promise<boolean> {
  const cid = "customId" in i ? (i.customId as string) : "";
  if (!cid.startsWith(`${P}|`)) return false;
  const [, a, b] = cid.split("|");
  void b;
  try {
    if (i.isButton()) await onButton(i, a);
    else if (i.isStringSelectMenu() && a === "plan") await onPlan(i);
    else if (i.isModalSubmit() && a === "m") await onModal(i, b);
    else return false;
  } catch (err) {
    logger.error("خطأ في الرتب الخاصة", err);
    if (i.isRepliable() && !i.replied && !i.deferred) await i.reply({ content: "⚠️ صار خطأ.", ...eph }).catch(() => undefined);
  }
  return true;
}

// ───────── حذف الرتب المنتهية ─────────

export async function sweepExpiredVip(client: Client): Promise<void> {
  const expired = await VipRole.find({ expiresAt: { $lte: new Date() } }).limit(50);
  for (const d of expired) {
    const guild = client.guilds.cache.get(d.guildId) ?? null;
    await deleteVip(guild, d.roleId);
    await VipRole.deleteOne({ _id: d._id });
  }
}

export function startVipChecker(client: Client): void {
  const run = () => sweepExpiredVip(client).catch((err) => logger.error("فشل فحص الرتب الخاصة", err));
  setTimeout(run, 15_000);
  setInterval(run, 60_000);
}
