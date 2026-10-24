import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder,
  type BaseMessageOptions, type ButtonInteraction, type Guild, type Message, type StringSelectMenuInteraction,
} from "discord.js";
import { Inventory } from "../database/models/Inventory";
import { Marriage } from "../database/models/Marriage";
import { UserProfile } from "../database/models/UserProfile";
import { jenny } from "../constants";
import { logTransaction } from "../services/transactions";
import { renderFlowerShop, renderInventory, renderMarriageCard, renderShops } from "./card";
import { ITEMS, lovePercent } from "./data";

export const SHOPS_TRIGGER = /^!\s*محلات$/;
export const INVENTORY_TRIGGER = /^!\s*مقتنياتي$/;
export const MYMARRIAGE_TRIGGER = /^!\s*زواجي$/;

const PFX = "shp";
const COLOR = 0x2b2d31;
const eph = { flags: MessageFlags.Ephemeral } as const;
const id = (owner: string, act: string, arg = "") => `${PFX}|${owner}|${act}|${arg}`;
const btn = (cid: string, label: string, style = ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(cid).setLabel(label).setStyle(style);
const row = (...b: ButtonBuilder[]) => new ActionRowBuilder<ButtonBuilder>().addComponents(...b);

async function owned(userId: string, guildId: string, item: string): Promise<number> {
  const inv = await Inventory.findOne({ userId, guildId }, { items: 1 });
  return Number((inv?.items as Record<string, number> | undefined)?.[item] ?? 0);
}

function view(png: Buffer | null, name: string, components: ActionRowBuilder<any>[], fallback: string, note?: string): BaseMessageOptions {
  const embed = new EmbedBuilder().setColor(COLOR);
  if (png) embed.setImage(`attachment://${name}`);
  else embed.setDescription(fallback);
  if (note) embed.setFooter({ text: note });
  return { content: note ?? "", embeds: [embed], files: png ? [new AttachmentBuilder(png, { name })] : [], components };
}

/* ───────── المحلات ───────── */

async function shopsView(owner: string): Promise<BaseMessageOptions> {
  const png = await renderShops([{ name: "محل ورد", sub: `الوردة بـ ${ITEMS.flower.price} Jenny` }]);
  return view(png, "shops.png", [row(btn(id(owner, "flower"), "محل ورد", ButtonStyle.Primary))], "المحلات: محل ورد");
}

async function flowerView(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const have = await owned(owner, guildId, "flower");
  const png = await renderFlowerShop(ITEMS.flower.price, have);
  return view(
    png, "flower.png",
    [row(btn(id(owner, "buy", "1"), `شراء 1 (${ITEMS.flower.price})`, ButtonStyle.Success), btn(id(owner, "buy", "5"), `شراء 5 (${ITEMS.flower.price * 5})`, ButtonStyle.Success), btn(id(owner, "shops"), "رجوع"))],
    `محل ورد — السعر ${ITEMS.flower.price}`, note,
  );
}

/* ───────── مقتنياتي ───────── */

async function spouseIds(userId: string, guildId: string): Promise<string[]> {
  const ms = await Marriage.find({ guildId, $or: [{ husbandId: userId }, { wifeId: userId }] });
  return ms.map((m) => (m.husbandId === userId ? m.wifeId : m.husbandId));
}

async function inventoryView(guild: Guild, owner: string, note?: string): Promise<BaseMessageOptions> {
  const flowers = await owned(owner, guild.id, "flower");
  const rows = flowers > 0 ? [{ name: ITEMS.flower.name, count: flowers }] : [];
  const png = await renderInventory(rows);
  const buttons: ButtonBuilder[] = [];
  if (flowers > 0 && (await spouseIds(owner, guild.id)).length > 0) buttons.push(btn(id(owner, "gift"), "إهداء", ButtonStyle.Success));
  return view(png, "inv.png", buttons.length ? [row(...buttons)] : [], flowers ? `ورد × ${flowers}` : "ما عندك مقتنيات.", note);
}

/** يهدي وردة: ينقص من مقتنيات المهدي ويزيد عداد الورد في الزواج */
async function giftFlower(guild: Guild, from: string, to: string): Promise<string> {
  const took = await Inventory.findOneAndUpdate({ userId: from, guildId: guild.id, "items.flower": { $gte: 1 } }, { $inc: { "items.flower": -1 } });
  if (!took) return "❌ ما عندك ورد. اشتر من `!محلات`.";
  await Marriage.updateOne(
    { guildId: guild.id, $or: [{ husbandId: from, wifeId: to }, { husbandId: to, wifeId: from }] },
    { $inc: { gifts: 1, lovePoints: ITEMS.flower.love } },
  );
  return "ok";
}

/* ───────── بطاقة الزواج ───────── */

async function marriageView(guild: Guild, owner: string, partnerId?: string, note?: string): Promise<BaseMessageOptions | string> {
  const ms = await Marriage.find({ guildId: guild.id, $or: [{ husbandId: owner }, { wifeId: owner }] }).sort({ createdAt: 1 });
  if (ms.length === 0) return "ما أنت متزوج. اكتب `!زواج` لتعرف الطريقة.";
  const m = ms.find((x) => (x.husbandId === owner ? x.wifeId : x.husbandId) === partnerId) ?? ms[0];
  const pid = m.husbandId === owner ? m.wifeId : m.husbandId;
  const [a, b] = await Promise.all([guild.members.fetch(owner).catch(() => null), guild.members.fetch(pid).catch(() => null)]);
  const days = Math.max(0, Math.floor((Date.now() - new Date(m.createdAt).getTime()) / 86_400_000));
  const png = await renderMarriageCard({
    aName: a?.displayName ?? "؟",
    aAvatar: a?.displayAvatarURL({ extension: "png", size: 256 }),
    bName: b?.displayName ?? "عضو غادر",
    bAvatar: b?.displayAvatarURL({ extension: "png", size: 256 }),
    since: new Date(m.createdAt).toLocaleDateString("en-GB"),
    days,
    gifts: m.gifts ?? m.flowers ?? 0,
    love: lovePercent(m.lovePoints ?? (m.flowers ?? 0) * ITEMS.flower.love, days),
  });
  const rows: ActionRowBuilder<any>[] = [row(btn(id(owner, "mgift", pid), "إهداء", ButtonStyle.Success))];
  if (ms.length > 1) {
    const opts = await Promise.all(
      ms.map(async (x) => {
        const p = x.husbandId === owner ? x.wifeId : x.husbandId;
        const mem = await guild.members.fetch(p).catch(() => null);
        return { label: (mem?.displayName ?? p).slice(0, 90), value: p, default: p === pid };
      }),
    );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id(owner, "msel")).setPlaceholder("اختر الزواج").addOptions(opts)));
  }
  return view(png, "marriage.png", rows, `زواج ${a?.displayName} و ${b?.displayName}`, note);
}

/* ───────── الرسائل ───────── */

export async function handleShopMessage(message: Message<true>): Promise<void> {
  const text = message.content.trim();
  const owner = message.author.id;
  const send = (v: BaseMessageOptions) => message.channel.send(v).catch(() => undefined);
  if (SHOPS_TRIGGER.test(text)) return void (await send(await shopsView(owner)));
  if (INVENTORY_TRIGGER.test(text)) return void (await send(await inventoryView(message.guild, owner)));
  if (MYMARRIAGE_TRIGGER.test(text)) {
    const v = await marriageView(message.guild, owner);
    if (typeof v === "string") await message.reply({ content: v, allowedMentions: { repliedUser: false } }).catch(() => undefined);
    else await send(v);
  }
}

/* ───────── الأزرار والقوائم ───────── */

export async function handleShopComponent(i: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  const [prefix, owner, act, arg] = i.customId.split("|");
  if (prefix !== PFX || !i.inGuild() || !i.guild) return false;
  if (i.user.id !== owner) {
    await i.reply({ content: "هذي مو قائمتك.", ...eph });
    return true;
  }
  const guild = i.guild;
  const edit = async (v: BaseMessageOptions) => void (await i.editReply({ ...v, attachments: [] }));
  await i.deferUpdate();

  if (act === "shops") return await edit(await shopsView(owner)), true;
  if (act === "flower") return await edit(await flowerView(owner, guild.id)), true;

  if (act === "buy") {
    const qty = arg === "5" ? 5 : 1;
    const cost = ITEMS.flower.price * qty;
    const paid = await UserProfile.findOneAndUpdate({ userId: owner, guildId: guild.id, coins: { $gte: cost } }, { $inc: { coins: -cost } });
    if (!paid) return await edit(await flowerView(owner, guild.id, `❌ ما تكفي محفظتك (${cost}).`)), true;
    await Inventory.updateOne({ userId: owner, guildId: guild.id }, { $inc: { "items.flower": qty } }, { upsert: true });
    await logTransaction(guild.id, owner, "shop_purchase", cost);
    return await edit(await flowerView(owner, guild.id, `✅ اشتريت ${qty} ورد بـ ${cost}. شوفها في !مقتنياتي`)), true;
  }

  if (act === "gift") {
    const ids = await spouseIds(owner, guild.id);
    if (ids.length === 0) return await edit(await inventoryView(guild, owner, "❌ ما عندك شريك حياة.")), true;
    if (ids.length === 1) return await sendGift(i, guild, owner, ids[0], () => inventoryView(guild, owner)), true;
    const opts = await Promise.all(ids.map(async (p) => ({ label: ((await guild.members.fetch(p).catch(() => null))?.displayName ?? p).slice(0, 90), value: p })));
    const menu = new StringSelectMenuBuilder().setCustomId(id(owner, "gsel")).setPlaceholder("لمن تبي تهدي الورد؟").addOptions(opts);
    return await edit({ ...(await inventoryView(guild, owner)), components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] }), true;
  }
  if (act === "gsel" && i.isStringSelectMenu()) return await sendGift(i, guild, owner, i.values[0], () => inventoryView(guild, owner)), true;

  if (act === "mgift") return await sendGift(i, guild, owner, arg, async () => {
    const v = await marriageView(guild, owner, arg);
    return typeof v === "string" ? { content: v } : v;
  }), true;
  if (act === "msel" && i.isStringSelectMenu()) {
    const v = await marriageView(guild, owner, i.values[0]);
    return await edit(typeof v === "string" ? { content: v } : v), true;
  }
  return true;
}

async function sendGift(i: ButtonInteraction | StringSelectMenuInteraction, guild: Guild, from: string, to: string, refresh: () => Promise<BaseMessageOptions>): Promise<void> {
  const ids = await spouseIds(from, guild.id);
  if (!ids.includes(to)) return void (await i.editReply({ ...(await refresh()), attachments: [] }));
  const r = await giftFlower(guild, from, to);
  const base = await refresh();
  await i.editReply({ ...base, content: r === "ok" ? "" : r, attachments: [] });
  if (r === "ok" && i.channel && "send" in i.channel) {
    await i.channel
      .send({ embeds: [new EmbedBuilder().setColor(0xf43f5e).setDescription(`<@${from}> أهدى <@${to}> وردة`)], allowedMentions: { users: [to] } })
      .catch(() => undefined);
  }
}
