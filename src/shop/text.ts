import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, StringSelectMenuBuilder,
  type BaseMessageOptions, type ButtonInteraction, type Guild, type Message, type StringSelectMenuInteraction,
} from "discord.js";
import { Inventory } from "../database/models/Inventory";
import { Marriage } from "../database/models/Marriage";
import { UserProfile } from "../database/models/UserProfile";
import { jenny } from "../constants";
import { logTransaction } from "../services/transactions";
import { INV_COLS, INV_PER_PAGE, renderCars, renderEstate, renderFlowerShop, renderInventory, renderJewelryShop, renderMarriageCard, renderPhones, renderShops } from "./card";
import { CAR_IDS, ESTATE_IDS, PHONE_IDS, ITEMS, lovePercent, type ItemId } from "./data";

export const SHOPS_TRIGGER = /^!\s*محلات$/;
export const ESTATE_TRIGGER = /^!\s*(?:العقار|العقارات|عقار)$/;
export const CARS_TRIGGER = /^!\s*(?:السيارات|سيارات|معرض(?:\s+السيارات)?|محل\s+سيارات)$/;
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
    { name: "معرض سيارات", sub: `من ${ITEMS.cherry_arrizo.price.toLocaleString("en-US")} Jenny`, icon: "land_cruiser" },
    { name: "محل هواتف", sub: `من ${ITEMS.huawei.price.toLocaleString("en-US")} Jenny`, icon: "iphone_18" },
  ]);
  return view(png, "shops.png", [row(btn(id(owner, "flower"), "محل ورد", ButtonStyle.Primary), btn(id(owner, "jewelry"), "محل مجوهرات", ButtonStyle.Primary), btn(id(owner, "cars"), "معرض سيارات", ButtonStyle.Primary), btn(id(owner, "phones"), "محل هواتف", ButtonStyle.Primary))], "المحلات: محل ورد، محل مجوهرات، معرض سيارات، محل هواتف");
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

async function estateView(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const inv = await Inventory.findOne({ userId: owner, guildId }, { items: 1 });
  const have = (inv?.items ?? {}) as Record<string, number>;
  const rows = ESTATE_IDS.map((k) => ({ id: k, name: ITEMS[k].name, price: ITEMS[k].price, count: Number(have[k] ?? 0) }));
  const png = await renderEstate(rows);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(id(owner, "ebuy"))
    .setPlaceholder("اختر عقار للشراء")
    .addOptions(rows.map((r) => ({ label: r.name, value: r.id, description: `${r.price.toLocaleString("en-US")} Jenny` })));
  return view(png, "estate.png", [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], rows.map((r) => `${r.name}: ${r.price}`).join("\n"), note);
}

async function carsView(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const inv = await Inventory.findOne({ userId: owner, guildId }, { items: 1 });
  const have = (inv?.items ?? {}) as Record<string, number>;
  const rows = CAR_IDS.map((k) => ({ id: k, name: ITEMS[k].name, price: ITEMS[k].price, count: Number(have[k] ?? 0) }));
  const png = await renderCars(rows);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(id(owner, "cbuy"))
    .setPlaceholder("اختر سيارة للشراء")
    .addOptions(rows.map((r) => ({ label: r.name, value: r.id, description: `${r.price.toLocaleString("en-US")} Jenny` })));
  return view(png, "cars.png", [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], rows.map((r) => `${r.name}: ${r.price}`).join("\n"), note);
}

async function phonesView(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const inv = await Inventory.findOne({ userId: owner, guildId }, { items: 1 });
  const have = (inv?.items ?? {}) as Record<string, number>;
  const rows = PHONE_IDS.map((k) => ({ id: k, name: ITEMS[k].name, price: ITEMS[k].price, count: Number(have[k] ?? 0) }));
  const png = await renderPhones(rows);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(id(owner, "pbuy"))
    .setPlaceholder("اختر هاتف للشراء")
    .addOptions(rows.map((r) => ({ label: r.name, value: r.id, description: `${r.price.toLocaleString("en-US")} Jenny` })));
  return view(png, "phones.png", [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], rows.map((r) => `${r.name}: ${r.price}`).join("\n"), note);
}

/* ───────── مقتنياتي ───────── */

async function spouseIds(userId: string, guildId: string): Promise<string[]> {
  const ms = await Marriage.find({ guildId, $or: [{ husbandId: userId }, { wifeId: userId }] });
  return ms.map((m) => (m.husbandId === userId ? m.wifeId : m.husbandId));
}

interface InvItem {
  key: ItemId;
  name: string;
  count: number;
}

async function loadInv(userId: string, guildId: string): Promise<InvItem[]> {
  const inv = await Inventory.findOne({ userId, guildId }, { items: 1 });
  const have = (inv?.items ?? {}) as Record<string, number>;
  const out: InvItem[] = [];
  for (const key of Object.keys(ITEMS) as ItemId[]) {
    const n = Number(have[key] ?? 0);
    if (n > 0) out.push({ key, name: ITEMS[key].name, count: n });
  }
  return out;
}

/** سعر البيع = نصف سعر الشراء */
const sellPrice = (key: ItemId): number => Math.floor(ITEMS[key].price / 2);

/** يرسم إطار أبيض حول الخانة المحددة (نفس أبعاد renderInventory) */
async function highlightCell(png: Buffer | null, index: number): Promise<Buffer | null> {
  if (!png) return null;
  try {
    const img = await loadImage(png);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const CW = 920, S = 136, GAP = 34, y0 = 140;
    const x0 = (CW - (INV_COLS * S + (INV_COLS - 1) * GAP)) / 2;
    const col = index % INV_COLS;
    const r = Math.floor(index / INV_COLS);
    const x = x0 + (INV_COLS - 1 - col) * (S + GAP); // الترتيب من اليمين لليسار
    const y = y0 + r * (S + GAP);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.strokeRect(x - 5, y - 5, S + 10, S + 10);
    return await canvas.encode("png");
  } catch {
    return png;
  }
}

/** يحرك التحديد داخل الصفحة (الشبكة 5 أعمدة، العمود 0 أقصى اليمين) */
function moveSel(op: string, sel: number, len: number): number {
  if (len <= 0) return 0;
  const col = sel % INV_COLS;
  const rowI = Math.floor(sel / INV_COLS);
  const lastRow = Math.floor((len - 1) / INV_COLS);
  const toRow = (r: number) => Math.min(len - 1, r * INV_COLS + col);
  switch (op) {
    case "up": return toRow(Math.max(0, rowI - 1));
    case "down": return toRow(Math.min(lastRow, rowI + 1));
    case "top": return toRow(0);
    case "bottom": return toRow(lastRow);
    case "left": return col < INV_COLS - 1 && sel + 1 < len ? sel + 1 : sel; // يسار الشاشة = عمود أكبر
    case "right": return col > 0 ? sel - 1 : sel;
    case "fl": return Math.min(rowI * INV_COLS + INV_COLS - 1, len - 1); // أقصى اليسار في الصف
    case "fr": return rowI * INV_COLS; // أقصى اليمين في الصف
    default: return sel;
  }
}

function navRows(owner: string, page: number, sel: number, pages: number): ActionRowBuilder<ButtonBuilder>[] {
  const nav = (op: string, emoji: string, style = ButtonStyle.Secondary, disabled = false) =>
    new ButtonBuilder().setCustomId(id(owner, "inv", `${page},${sel},${op}`)).setEmoji(emoji).setStyle(style).setDisabled(disabled);
  return [
    row(nav("fl", "⏪"), nav("up", "⬆️", ButtonStyle.Primary), nav("fr", "⏩")),
    row(nav("left", "⬅️", ButtonStyle.Primary), nav("pick", "💠", ButtonStyle.Success), nav("right", "➡️", ButtonStyle.Primary)),
    row(nav("top", "⏫"), nav("down", "⬇️", ButtonStyle.Primary), nav("bottom", "⏬")),
    row(nav("prev", "◀️", ButtonStyle.Secondary, page <= 0), nav("refresh", "🔄", ButtonStyle.Primary), nav("next", "▶️", ButtonStyle.Secondary, page >= pages - 1)),
  ];
}

async function inventoryView(guild: Guild, owner: string, page = 0, sel = 0, picked = false, note?: string): Promise<BaseMessageOptions> {
  const all = await loadInv(owner, guild.id);
  const member = await guild.members.fetch(owner).catch(() => null);
  const pages = Math.max(1, Math.ceil(all.length / INV_PER_PAGE));
  const pg = Math.min(Math.max(0, page), pages - 1);
  const onPage = all.slice(pg * INV_PER_PAGE, (pg + 1) * INV_PER_PAGE);
  const s = Math.min(Math.max(0, sel), Math.max(0, onPage.length - 1));

  const basePng = await renderInventory(
    `مقتنيات ${member?.displayName ?? ""}`.trim(),
    onPage.map((it) => ({ name: it.name, count: it.count, icon: it.key })),
    pg,
    pages,
  );
  const png = onPage.length > 0 ? await highlightCell(basePng, s) : basePng;

  const components: ActionRowBuilder<ButtonBuilder>[] = onPage.length > 0 ? navRows(owner, pg, s, pages) : [];
  let content = note ?? "";
  const cur = onPage[s];
  if (picked && cur) {
    const price = sellPrice(cur.key);
    content = `المحدد: **${cur.name}** × ${cur.count}\nسعر البيع: **${price.toLocaleString("en-US")}** Jenny (نصف سعر الشراء)`;
    components.push(
      row(
        new ButtonBuilder().setCustomId(id(owner, "inv", `${pg},${s},sell`)).setLabel(`بيع بـ ${price.toLocaleString("en-US")}`).setEmoji("💰").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(id(owner, "inv", `${pg},${s},cancel`)).setLabel("إلغاء").setStyle(ButtonStyle.Secondary),
      ),
    );
  }

  const v = view(png, "inv.png", components, all.length ? all.map((r) => `${r.name} × ${r.count}`).join("\n") : "ما عندك مقتنيات.");
  return { ...v, content };
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
  if (ESTATE_TRIGGER.test(text)) return void (await send(await estateView(owner, message.guildId)));
  if (CARS_TRIGGER.test(text)) return void (await send(await carsView(owner, message.guildId)));
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
  if (act === "cars") return await edit(await carsView(owner, guild.id)), true;
  if (act === "phones") return await edit(await phonesView(owner, guild.id)), true;

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

  if (act === "ebuy" && i.isStringSelectMenu()) {
    const key = i.values[0] as (typeof ESTATE_IDS)[number];
    if (!ESTATE_IDS.includes(key)) return await edit(await estateView(owner, guild.id)), true;
    const cost = ITEMS[key].price;
    const paid = await UserProfile.findOneAndUpdate({ userId: owner, guildId: guild.id, coins: { $gte: cost } }, { $inc: { coins: -cost } });
    if (!paid) return await edit(await estateView(owner, guild.id, `❌ ما تكفي محفظتك (${cost.toLocaleString("en-US")}).`)), true;
    await Inventory.updateOne({ userId: owner, guildId: guild.id }, { $inc: { [`items.${key}`]: 1 } }, { upsert: true });
    await logTransaction(guild.id, owner, "shop_purchase", cost);
    return await edit(await estateView(owner, guild.id, `✅ اشتريت ${ITEMS[key].name} بـ ${cost.toLocaleString("en-US")}. شوفه في !مقتنياتي`)), true;
  }
  if (act === "cbuy" && i.isStringSelectMenu()) {
    const key = i.values[0] as (typeof CAR_IDS)[number];
    if (!CAR_IDS.includes(key)) return await edit(await carsView(owner, guild.id)), true;
    const cost = ITEMS[key].price;
    // نحجز السيارة أول (مرة وحدة لكل موديل)، وبعدها ندفع
    const reserved = await Inventory.findOneAndUpdate({ userId: owner, guildId: guild.id, [`items.${key}`]: { $not: { $gte: 1 } } }, { $inc: { [`items.${key}`]: 1 } }, { upsert: true }).then(() => true, () => false);
    if (!reserved) return await edit(await carsView(owner, guild.id, `❌ عندك ${ITEMS[key].name} من قبل.`)), true;
    const paid = await UserProfile.findOneAndUpdate({ userId: owner, guildId: guild.id, coins: { $gte: cost } }, { $inc: { coins: -cost } });
    if (!paid) {
      await Inventory.updateOne({ userId: owner, guildId: guild.id }, { $inc: { [`items.${key}`]: -1 } });
      return await edit(await carsView(owner, guild.id, `❌ ما تكفي محفظتك (${cost.toLocaleString("en-US")}).`)), true;
    }
    await logTransaction(guild.id, owner, "shop_purchase", cost);
    return await edit(await carsView(owner, guild.id, `✅ اشتريت ${ITEMS[key].name} بـ ${cost.toLocaleString("en-US")}. شوفها في !مقتنياتي`)), true;
  }
  if (act === "pbuy" && i.isStringSelectMenu()) {
    const key = i.values[0] as (typeof PHONE_IDS)[number];
    if (!PHONE_IDS.includes(key)) return await edit(await phonesView(owner, guild.id)), true;
    const cost = ITEMS[key].price;
    // نحجز الهاتف أول (مرة وحدة لكل موديل)، وبعدها ندفع
    const reserved = await Inventory.findOneAndUpdate({ userId: owner, guildId: guild.id, [`items.${key}`]: { $not: { $gte: 1 } } }, { $inc: { [`items.${key}`]: 1 } }, { upsert: true }).then(() => true, () => false);
    if (!reserved) return await edit(await phonesView(owner, guild.id, `❌ عندك ${ITEMS[key].name} من قبل.`)), true;
    const paid = await UserProfile.findOneAndUpdate({ userId: owner, guildId: guild.id, coins: { $gte: cost } }, { $inc: { coins: -cost } });
    if (!paid) {
      await Inventory.updateOne({ userId: owner, guildId: guild.id }, { $inc: { [`items.${key}`]: -1 } });
      return await edit(await phonesView(owner, guild.id, `❌ ما تكفي محفظتك (${cost.toLocaleString("en-US")}).`)), true;
    }
    await logTransaction(guild.id, owner, "shop_purchase", cost);
    return await edit(await phonesView(owner, guild.id, `✅ اشتريت ${ITEMS[key].name} بـ ${cost.toLocaleString("en-US")}. شوفه في !مقتنياتي`)), true;
  }
  if (act === "ipg") return await edit(await inventoryView(guild, owner, Number(arg) || 0)), true;

  // أزرار تحريك الشبكة في مقتنياتي + اختيار وبيع بنصف السعر
  if (act === "inv") {
    const [pgS, selS, op] = (arg ?? "").split(",");
    let page = Number(pgS) || 0;
    let sel = Number(selS) || 0;
    let picked = false;
    let note: string | undefined;

    const all = await loadInv(owner, guild.id);
    const pages = Math.max(1, Math.ceil(all.length / INV_PER_PAGE));
    page = Math.min(Math.max(0, page), pages - 1);
    const onPage = all.slice(page * INV_PER_PAGE, (page + 1) * INV_PER_PAGE);

    if (op === "prev") {
      page = Math.max(0, page - 1);
      sel = 0;
    } else if (op === "next") {
      page = Math.min(pages - 1, page + 1);
      sel = 0;
    } else if (op === "pick") {
      picked = true;
    } else if (op === "sell") {
      const it = onPage[Math.min(sel, Math.max(0, onPage.length - 1))];
      if (!it) {
        note = "❌ ما لقيت هذا المقتنى.";
      } else {
        const price = sellPrice(it.key);
        // خصم ذرّي: لو ما عنده المقتنى ما يتم البيع (يمنع تكرار البيع بضغطتين)
        const took = await Inventory.findOneAndUpdate(
          { userId: owner, guildId: guild.id, [`items.${it.key}`]: { $gte: 1 } },
          { $inc: { [`items.${it.key}`]: -1 } },
        );
        if (!took) {
          note = `❌ ما عندك ${it.name}.`;
        } else {
          await UserProfile.updateOne({ userId: owner, guildId: guild.id }, { $inc: { coins: price } });
          await logTransaction(guild.id, owner, "pay_received", price);
          note = `✅ بعت ${it.name} بـ ${price.toLocaleString("en-US")} ${jenny(price) ? "Jenny" : "Jenny"}`;
        }
      }
    } else if (op !== "refresh" && op !== "cancel") {
      sel = moveSel(op, sel, onPage.length);
    }

    return await edit(await inventoryView(guild, owner, page, sel, picked, note)), true;
  }

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
