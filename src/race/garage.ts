import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  type BaseMessageOptions,
  type ButtonInteraction,
  type Message,
  type StringSelectMenuInteraction,
} from "discord.js";
import { jenny } from "../constants";
import { renderPartsShop, renderTune, type PartRow } from "./card";
import { CATS, CAT_IDS, carName, effectiveStats, fxText, isCar, isCat, partId, partInfo, type CarId, type CatId, type Tier } from "./data";
import { buyPart, getGarage, installPart, ownedCars } from "./service";

/** !تعديل سياراتي */
export const TUNE_TRIGGER = /^!\s*تعديل\s+سياراتي$/;

const COLOR = 0x2b2d31;
const eph = { flags: MessageFlags.Ephemeral } as const;
type AnyRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>;

const tid = (owner: string, act: string, ...args: string[]): string => ["tun", owner, act, ...args].join("|");
const pid = (owner: string, act: string, ...args: string[]): string => ["prt", owner, act, ...args].join("|");
const back = (cid: string, label = "رجوع"): ActionRowBuilder<ButtonBuilder> => new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(cid).setLabel(label).setStyle(ButtonStyle.Secondary));

function view(png: Buffer | null, name: string, components: AnyRow[], fallback: string, note?: string): BaseMessageOptions {
  const embed = new EmbedBuilder().setColor(COLOR);
  if (png) embed.setImage(`attachment://${name}`);
  else embed.setDescription(fallback);
  if (note) embed.setFooter({ text: note });
  return { content: note ?? "", embeds: [embed], files: png ? [new AttachmentBuilder(png, { name })] : [], components };
}

function textView(text: string, components: AnyRow[] = []): BaseMessageOptions {
  return { content: "", embeds: [new EmbedBuilder().setColor(COLOR).setDescription(text)], files: [], components };
}

const carSelect = (cid: string, cars: CarId[], placeholder: string, current?: CarId) =>
  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder().setCustomId(cid).setPlaceholder(placeholder).addOptions(cars.map((c) => ({ label: carName(c), value: c, default: c === current }))),
  );

const NO_CAR = "ما عندك أي سيارة. اشترِ وحدة من `!معرض` أول.";

/* ───────────────── تعديل السيارات ───────────────── */

async function slotsOf(owner: string, guildId: string, car: CarId) {
  const g = await getGarage(owner, guildId);
  const inst = g.installed[car] ?? {};
  return { g, inst, slots: CAT_IDS.map((cat) => { const t = (inst[cat] ?? 0) as Tier; return { cat: CATS[cat].name, part: partInfo(car, cat, t).name, stock: t === 0 }; }) };
}

async function tunePick(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const cars = await ownedCars(owner, guildId);
  if (!cars.length) return textView(NO_CAR);
  return textView(note ?? "اختر السيارة اللي تبي تعدّلها:", [carSelect(tid(owner, "car"), cars, "اختر سيارة")]);
}

async function tuneCar(owner: string, guildId: string, car: CarId, note?: string): Promise<BaseMessageOptions> {
  const { inst, slots } = await slotsOf(owner, guildId, car);
  const png = await renderTune({ title: carName(car), sub: "اختر الجزء اللي تبي تعدّله", carId: car, stats: effectiveStats(car, inst), slots });
  const menu = new StringSelectMenuBuilder()
    .setCustomId(tid(owner, "cat", car))
    .setPlaceholder("اختر الجزء")
    .addOptions(CAT_IDS.map((cat) => ({ label: CATS[cat].name, value: cat, description: `المركّب: ${partInfo(car, cat, (inst[cat] ?? 0) as Tier).name}` })));
  return view(png, "tune.png", [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), back(tid(owner, "home"), "سيارة ثانية")], carName(car), note);
}

async function tuneCat(owner: string, guildId: string, car: CarId, cat: CatId, note?: string): Promise<BaseMessageOptions> {
  const { g, inst, slots } = await slotsOf(owner, guildId, car);
  const cur = (inst[cat] ?? 0) as Tier;
  const png = await renderTune({ title: `${CATS[cat].name} — ${carName(car)}`, sub: "اختر قطعة لمعاينة تأثيرها على السيارة", carId: car, stats: effectiveStats(car, inst), slots });
  const tiers: Tier[] = [0, 1, 2, 3];
  const menu = new StringSelectMenuBuilder().setCustomId(tid(owner, "part", car, cat)).setPlaceholder("اختر قطعة").addOptions(
    tiers.map((t) => {
      const p = partInfo(car, cat, t);
      const have = t === 0 || g.owned.has(p.id);
      return { label: `${t === cur ? "✅ " : have ? "🟢 " : "🔒 "}${p.name}`, value: String(t), description: t === 0 ? "القطعة الأصلية" : `${fxText(p.fx)} — ${have ? "مملوكة" : `غير مملوكة (${p.price})`}`.slice(0, 100), default: t === cur };
    }),
  );
  return view(png, "tune.png", [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), back(tid(owner, "carv", car))], carName(car), note);
}

async function tunePreview(owner: string, guildId: string, car: CarId, cat: CatId, tier: Tier): Promise<BaseMessageOptions> {
  const { g, inst, slots } = await slotsOf(owner, guildId, car);
  const cur = (inst[cat] ?? 0) as Tier;
  const p = partInfo(car, cat, tier);
  const have = tier === 0 || g.owned.has(p.id);
  const png = await renderTune({ title: `${p.name} — ${carName(car)}`, sub: tier === cur ? "هذي القطعة مركّبة حالياً" : `معاينة التبديل: ${partInfo(car, cat, cur).name} ← ${p.name}`, carId: car, stats: effectiveStats(car, inst), preview: effectiveStats(car, { ...inst, [cat]: tier }), slots });
  const install = new ButtonBuilder().setCustomId(tid(owner, "inst", car, cat, String(tier))).setStyle(ButtonStyle.Success);
  if (tier === cur) install.setLabel("مركّبة").setDisabled(true);
  else if (have) install.setLabel("تركيب");
  else install.setLabel(`غير مملوكة (${p.price}) — اشترها من محل سبير بارتس`).setStyle(ButtonStyle.Secondary).setDisabled(true);
  return view(png, "tune.png", [new ActionRowBuilder<ButtonBuilder>().addComponents(install), back(tid(owner, "catv", car, cat))], carName(car));
}

export async function handleTuneMessage(message: Message): Promise<void> {
  if (!message.inGuild()) return;
  await message.channel.send(await tunePick(message.author.id, message.guildId)).catch(() => undefined);
}

/* ───────────────── محل سبير بارتس ───────────────── */

export async function partsHome(owner: string, guildId: string, note?: string): Promise<BaseMessageOptions> {
  const cars = await ownedCars(owner, guildId);
  if (!cars.length) return textView(`🔧 محل سبير بارتس: القطع خاصة بالسيارات اللي تملكها.\n${NO_CAR}`);
  return textView(note ?? "🔧 **محل سبير بارتس** — محركات، إطارات، نيترو، فرامل وأكثر.\nاختر السيارة اللي تبي قطع لها:", [carSelect(pid(owner, "car"), cars, "اختر سيارة")]);
}

async function shopCar(owner: string, guildId: string, car: CarId, note?: string): Promise<BaseMessageOptions> {
  const g = await getGarage(owner, guildId);
  const lines = CAT_IDS.map((cat) => {
    const have = ([1, 2, 3] as Tier[]).filter((t) => g.owned.has(partId(car, cat, t))).length;
    return `• **${CATS[cat].name}** — من ${jenny(partInfo(car, cat, 1).price)} إلى ${jenny(partInfo(car, cat, 3).price)} (تملك ${have}/3)`;
  });
  const menu = new StringSelectMenuBuilder().setCustomId(pid(owner, "cat", car)).setPlaceholder("اختر نوع القطعة").addOptions(CAT_IDS.map((cat) => ({ label: CATS[cat].name, value: cat })));
  const v = textView([`🔧 **قطع ${carName(car)}**`, "", ...lines].join("\n"), [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), back(pid(owner, "home"), "سيارة ثانية")]);
  if (note) v.content = note;
  return v;
}

async function shopCat(owner: string, guildId: string, car: CarId, cat: CatId, note?: string): Promise<BaseMessageOptions> {
  const g = await getGarage(owner, guildId);
  const cur = (g.installed[car]?.[cat] ?? 0) as Tier;
  const tiers: Tier[] = [1, 2, 3];
  const rows: PartRow[] = tiers.map((t) => {
    const p = partInfo(car, cat, t);
    return { name: p.name, effects: fxText(p.fx), price: p.price, state: cur === t ? "installed" : g.owned.has(p.id) ? "owned" : "buy" };
  });
  const png = await renderPartsShop(`${CATS[cat].name} — ${carName(car)}`, "اختر القطعة من القائمة اللي تحت للشراء", car, rows);
  const rowsC: AnyRow[] = [];
  const buyable = tiers.filter((t) => !g.owned.has(partId(car, cat, t)));
  if (buyable.length) {
    rowsC.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(pid(owner, "buy", car, cat)).setPlaceholder("اشترِ قطعة").addOptions(
          buyable.map((t) => { const p = partInfo(car, cat, t); return { label: p.name, value: String(t), description: `${p.price.toLocaleString("en-US")} Jenny — ${fxText(p.fx)}`.slice(0, 100) }; }),
        ),
      ),
    );
  }
  rowsC.push(back(pid(owner, "carv", car)));
  return view(png, "parts.png", rowsC, `${CATS[cat].name} — ${carName(car)}`, note);
}

/* ───────────────── الأزرار والقوائم ───────────────── */

export async function handleGarageComponent(i: ButtonInteraction | StringSelectMenuInteraction): Promise<boolean> {
  const [prefix, owner = "", act = "", a1 = "", a2 = "", a3 = ""] = i.customId.split("|");
  if ((prefix !== "tun" && prefix !== "prt") || !i.inGuild()) return false;
  if (i.user.id !== owner) {
    await i.reply({ content: "هذي مو قائمتك.", ...eph }).catch(() => undefined);
    return true;
  }
  const gid = i.guildId;
  await i.deferUpdate().catch(() => undefined);
  const edit = (v: BaseMessageOptions) => i.editReply({ ...v, attachments: [] }).catch(() => undefined);
  const pick = i.isStringSelectMenu() ? (i.values[0] ?? "") : "";
  const tierOf = (x: string): Tier => (([0, 1, 2, 3] as number[]).includes(Number(x)) ? (Number(x) as Tier) : 0);

  try {
    if (prefix === "tun") {
      if (act === "home") await edit(await tunePick(owner, gid));
      else if (act === "car" && isCar(pick)) await edit(await tuneCar(owner, gid, pick));
      else if (act === "carv" && isCar(a1)) await edit(await tuneCar(owner, gid, a1));
      else if (act === "cat" && isCar(a1) && isCat(pick)) await edit(await tuneCat(owner, gid, a1, pick));
      else if (act === "catv" && isCar(a1) && isCat(a2)) await edit(await tuneCat(owner, gid, a1, a2));
      else if (act === "part" && isCar(a1) && isCat(a2)) await edit(await tunePreview(owner, gid, a1, a2, tierOf(pick)));
      else if (act === "inst" && isCar(a1) && isCat(a2)) {
        const r = await installPart(owner, gid, a1, a2, tierOf(a3));
        const msg = r === "ok" ? `✅ تم تركيب ${partInfo(a1, a2, tierOf(a3)).name}.` : r === "no_car" ? "❌ ما تملك هذي السيارة." : "❌ ما تملك هذي القطعة.";
        await edit(await tuneCar(owner, gid, a1, msg));
      }
    } else {
      if (act === "home") await edit(await partsHome(owner, gid));
      else if (act === "car" && isCar(pick)) await edit(await shopCar(owner, gid, pick));
      else if (act === "carv" && isCar(a1)) await edit(await shopCar(owner, gid, a1));
      else if (act === "cat" && isCar(a1) && isCat(pick)) await edit(await shopCat(owner, gid, a1, pick));
      else if (act === "buy" && isCar(a1) && isCat(a2)) {
        const t = tierOf(pick);
        const r = await buyPart(owner, gid, a1, a2, t);
        const name = partInfo(a1, a2, t).name;
        const msg =
          r.result === "ok" ? `✅ اشتريت ${name} بـ ${r.price.toLocaleString("en-US")}${r.autoInstalled ? " وتركّبت تلقائياً" : " — ركّبها من !تعديل سياراتي"}.`
          : r.result === "have" ? "❌ عندك هذي القطعة من قبل."
          : r.result === "no_car" ? "❌ ما تملك هذي السيارة."
          : `❌ ما تكفي محفظتك (${r.price.toLocaleString("en-US")}).`;
        await edit(await shopCat(owner, gid, a1, a2, msg));
      }
    }
  } catch (err) {
    console.error("[garage]", err);
  }
  return true;
}
