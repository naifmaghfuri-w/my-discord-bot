import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder,
  type BaseMessageOptions, type ButtonInteraction, type Guild, type Message, type StringSelectMenuInteraction,
} from "discord.js";
import { Inventory } from "../database/models/Inventory";
import { Marriage } from "../database/models/Marriage";
import { UserProfile } from "../database/models/UserProfile";
import { jenny } from "../constants";
import { logTransaction } from "../services/transactions";
import { INV_PER_PAGE, renderFlowerShop, renderInventory, renderJewelryShop, renderMarriageCard, renderShops } from "./card";
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
  const png = await renderShops([
    { name: "محل ورد", sub: `الوردة بـ ${ITEMS.flower.price} Jenny`, icon: "flower" },
    { name: "محل مجوهرات", sub: `${ITEMS.ring.name} بـ ${ITEMS.ring.price} Jenny`, icon: "ring" },
  ]);
  return view(png, "shops.png", [row(btn(id(owner, "flower"), "محل ورد", ButtonStyle.Primary), btn(id(owner, "jewelry"), "محل مجوهرات", ButtonStyle.Primary))], "المحلات: محل ورد، محل مجوهرات");
}

async function flowerView(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const have = await owned(owner, guildId, "flower");
  const png = await renderFlowerShop(ITEMS.flower.price, have);
  return view(
    png, "flower.png",
    [row(btn(id(owner, "buy", "flower"), "شراء", ButtonStyle.Success))],
    `محل ورد — السعر ${ITEMS.flower.price}`, note,
  );
}

async function jewelryView(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const have = await owned(owner, guildId, "ring");
  const png = await renderJewelryShop(ITEMS.ring.price, have);
  return view(png, "jewelry.png", [row(btn(id(owner, "buy", "ring"), "شراء", ButtonStyle.Success))], `محل مجوهرات — ${ITEMS.ring.name} ${ITEMS.ring.price}`, note);
}

/* ───────── مقتنياتي ───────── */

async function spouseIds(userId: string, guildId: string): Promise<string[]> {
  const ms = await Marriage.find({ guildId, $or: [{ husbandId: userId }, { wifeId: userId }] });
  return ms.map((m) => (m.husbandId === userId ? m.wifeId : m.husbandId));
}

async function inventoryView(guild: Guild, owner: string, page = 0): Promise<BaseMessageOptions> {
  const [flowers, rings, member] = await Promise.all([owned(owner, guild.id, "flower"), owned(owner, guild.id, "ring"), guild.members.fetch(owner).catch(() => null)]);
  const all: { name: string; count: number; icon: "flower" | "ring" }[] = [];
  if (flowers > 0) all.push({ name: ITEMS.flower.name, count: flowers, icon: "flower" });
  if (rings > 0) all.push({ name: ITEMS.ring.name, count: rings, icon: "ring" });
  const pages = Math.max(1, Math.ceil(all.length / INV_PER_PAGE));
  const pg = Math.min(Math.max(0, page), pages - 1);
  const rows = all.slice(pg * INV_PER_PAGE, (pg + 1) * INV_PER_PAGE);
  const png = await renderInventory(`مقتنيات ${member?.displayName ?? ""}`.trim(), rows, pg, pages);
  const components = pages > 1 ? [row(btn(id(owner, "ipg", String(pg - 1)), "السابق").setDisabled(pg <= 0), btn(id(owner, "ipg", String(pg + 1)), "التالي").setDisabled(pg >= pages - 1))] : [];
  return view(png, "inv.png", components, all.length ? all.map((r) => `${r.name} × ${r.count}`).join("\n") : "ما عندك مقتنيات.");
}

/** يهدي وردة: ينقص من مقتنيات المهدي ويزيد عداد الورد في الزواج */
async function giftFlower(guild: Guild, from: string, to: string): Promise<string> {
  const took = await Inventory.findOneAndUpdate({ userId: from, guildId: guild.id, "items.flower": { $gte: 1 } }, { $inc: { "items.flower": -1 } });
  if (!took) return "❌ ما عندك إهداء";
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
  if (act === "jewelry") return await edit(await jewelryView(owner, guild.id)), true;

  if (act === "buy") {
    const item = arg === "ring" ? "ring" : "flower";
    const cost = ITEMS[item].price;
    const back = (note: string) => (item === "ring" ? jewelryView(owner, guild.id, note) : flowerView(owner, guild.id, note));
    const paid = await UserProfile.findOneAndUpdate({ userId: owner, guildId: guild.id, coins: { $gte: cost } }, { $inc: { coins: -cost } });
    if (!paid) return await edit(await back(`❌ ما تكفي محفظتك (${cost}).`)), true;
    await Inventory.updateOne({ userId: owner, guildId: guild.id }, { $inc: { [`items.${item}`]: 1 } }, { upsert: true });
    await logTransaction(guild.id, owner, "shop_purchase", cost);
    return await edit(await back(`✅ اشتريت ${ITEMS[item].name} بـ ${cost}. شوفه في !مقتنياتي`)), true;
  }

  if (act === "ipg") return await edit(await inventoryView(guild, owner, Number(arg) || 0)), true;

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
