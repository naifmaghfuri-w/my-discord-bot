import { jenny } from "../constants";
import { LabProfile, type ILabProfile } from "../database/models/LabProfile";
import { UserProfile } from "../database/models/UserProfile";
import { todayKey } from "../quests/time";
import { logTransaction } from "../services/transactions";
import { COMPOUND_MAP, COMPOUNDS, type CompoundDef } from "./compounds";
import { ELEMENT_MAP, ELEMENTS } from "./elements";
import { getLabProfile, grantLabXp } from "./service";

/* ───────────── الأجهزة ومعدات السلامة ───────────── */

export type EquipKey = "furnace" | "pump" | "goggles" | "gloves" | "hazmat";

export const MAX_LEVEL = 5;
/** تكلفة الترقية إلى المستوى 2، 3، 4، 5 */
export const UPGRADE_COST = [600, 1800, 4500, 11000];

export const GEAR: Record<"goggles" | "gloves" | "hazmat", { name: string; icon: string; price: number; reduce: number; desc: string }> = {
  goggles: { name: "نظارات السلامة", icon: "🥽", price: 500, reduce: 0.4, desc: "تقلل احتمال الحوادث 40%" },
  gloves: { name: "قفازات مقاومة", icon: "🧤", price: 400, reduce: 0.3, desc: "تقلل احتمال الحوادث 30%" },
  hazmat: { name: "بدلة حماية", icon: "🥼", price: 3000, reduce: 0.2, desc: "تقلل الحوادث 20% وتحميك من الإشعاع" },
};

export const level = (p: Pick<ILabProfile, "equipment">, key: "furnace" | "pump"): number =>
  Math.max(1, Math.min(MAX_LEVEL, p.equipment?.[key] ?? 1));
export const hasGear = (p: Pick<ILabProfile, "equipment">, key: "goggles" | "gloves" | "hazmat"): boolean =>
  (p.equipment?.[key] ?? 0) >= 1;

/** هامش التسامح الإضافي للحرارة (الفرن) والضغط (المضخة) */
export function tolerance(p: Pick<ILabProfile, "equipment">): { temp: number; pressure: number } {
  const f = level(p, "furnace");
  const pm = level(p, "pump");
  return { temp: (f - 1) * 10, pressure: pm >= 3 ? pm - 2 : 0 };
}

/** احتمال حادث لتفاعل معيّن (0 لو غير خطير) */
export function accidentChance(compound: CompoundDef, p: Pick<ILabProfile, "equipment">): number {
  if (!compound.hazard) return 0;
  const base = compound.hazard * 0.1;
  const reduce = (["goggles", "gloves", "hazmat"] as const).reduce((a, k) => a + (hasGear(p, k) ? GEAR[k].reduce : 0), 0);
  return base * (1 - Math.min(0.9, reduce));
}

export type BuyEquipResult = { ok: true; spent: number; label: string } | { ok: false; reason: "max" | "owned" | "coins" | "unknown" };

export async function buyEquipment(userId: string, guildId: string, key: string): Promise<BuyEquipResult> {
  const profile = await getLabProfile(userId, guildId);
  let cost: number;
  let newValue: number;
  let label: string;
  let guard: Record<string, unknown>;
  const path = `equipment.${key}`;

  if (key === "furnace" || key === "pump") {
    const cur = level(profile, key);
    if (cur >= MAX_LEVEL) return { ok: false, reason: "max" };
    cost = UPGRADE_COST[cur - 1];
    newValue = cur + 1;
    label = `${key === "furnace" ? "الفرن" : "مضخة الضغط"} → مستوى ${newValue}`;
    guard = cur === 1 ? { $or: [{ [path]: { $exists: false } }, { [path]: 1 }] } : { [path]: cur };
  } else if (key === "goggles" || key === "gloves" || key === "hazmat") {
    if (hasGear(profile, key)) return { ok: false, reason: "owned" };
    cost = GEAR[key].price;
    newValue = 1;
    label = `${GEAR[key].icon} ${GEAR[key].name}`;
    guard = { [path]: { $ne: 1 } };
  } else {
    return { ok: false, reason: "unknown" };
  }

  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: cost } }, { $inc: { coins: -cost } });
  if (!paid) return { ok: false, reason: "coins" };

  const res = await LabProfile.updateOne({ userId, guildId, ...guard }, { $set: { [path]: newValue } });
  if (res.modifiedCount === 0) {
    // ضغطة مزدوجة: رجّع الفلوس
    await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: cost } });
    return { ok: false, reason: key === "furnace" || key === "pump" ? "max" : "owned" };
  }
  await logTransaction(guildId, userId, "lab_purchase", cost);
  return { ok: true, spent: cost, label };
}

/* ───────────── الإشعاع ───────────── */

const EXPOSURE_PER_REACTION = 35;
const DECAY_PER_HOUR = 10;
const SICK_MS = 60 * 60 * 1000;

export const isRadioactiveItem = (id: string): boolean => Boolean(ELEMENT_MAP[id]?.radioactive || COMPOUND_MAP[id]?.radioactive);

/** مستوى الإشعاع الحالي بعد التناقص مع الوقت */
export function currentRadiation(p: Pick<ILabProfile, "radiation" | "radiationAt">, now = Date.now()): number {
  const last = p.radiationAt ? new Date(p.radiationAt).getTime() : now;
  const hours = Math.max(0, (now - last) / 3_600_000);
  return Math.max(0, Math.round((p.radiation ?? 0) - hours * DECAY_PER_HOUR));
}

export function sickMinutesLeft(p: Pick<ILabProfile, "sickUntil">, now = Date.now()): number {
  const until = p.sickUntil ? new Date(p.sickUntil).getTime() : 0;
  return until > now ? Math.ceil((until - now) / 60_000) : 0;
}

/** يسجّل تعرّضاً للإشعاع بعد تفاعل فيه مادة مشعة. يرجع ملاحظة للعرض (أو null) */
export async function applyRadiation(userId: string, guildId: string, mixIds: string[]): Promise<string | null> {
  if (!mixIds.some(isRadioactiveItem)) return null;
  const profile = await getLabProfile(userId, guildId);
  if (hasGear(profile, "hazmat")) return "🥼 بدلة الحماية صدّت الإشعاع.";

  const now = Date.now();
  const total = currentRadiation(profile, now) + EXPOSURE_PER_REACTION;
  if (total >= 100) {
    await LabProfile.updateOne(
      { userId, guildId },
      { $set: { radiation: 0, radiationAt: new Date(now), sickUntil: new Date(now + SICK_MS) } },
    );
    return "☢️ تعرّضت لجرعة إشعاع عالية وأُصبت! لا يمكنك التفاعل لمدة ساعة. اشترِ بدلة حماية لتتفادى ذلك.";
  }
  await LabProfile.updateOne({ userId, guildId }, { $set: { radiation: total, radiationAt: new Date(now) } });
  return `☢️ مستوى إشعاعك الآن **${total}/100**. عند 100 تُصاب ويتعطل مختبرك ساعة. بدلة الحماية تمنع ذلك.`;
}

/* ───────────── طلبات العملاء ───────────── */

export interface OrderDef {
  compoundId: string;
  qty: number;
  coins: number;
  xp: number;
}

const ORDER_COUNT = 3;
const ORDER_POOL = COMPOUNDS.filter((c) => ["common", "uncommon", "rare"].includes(c.rarity) && !c.radioactive && (c.hazard ?? 0) < 3);
const ORDER_QTY: Record<string, [number, number]> = { common: [2, 3], uncommon: [1, 2], rare: [1, 2] };
const ORDER_XP: Record<string, number> = { common: 10, uncommon: 20, rare: 35 };

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function next(seed: number): number {
  return Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0;
}

/** طلبات اليوم لهذا اللاعب (ثابتة طوال اليوم، وتتغير غداً) */
export function ordersForDay(day: string, userId: string): OrderDef[] {
  const pool = [...ORDER_POOL];
  const orders: OrderDef[] = [];
  let seed = hash(`${day}:${userId}`);
  while (orders.length < ORDER_COUNT && pool.length > 0) {
    seed = next(seed);
    const c = pool.splice(seed % pool.length, 1)[0];
    seed = next(seed);
    const [lo, hi] = ORDER_QTY[c.rarity];
    const qty = lo + (seed % (hi - lo + 1));
    orders.push({
      compoundId: c.id,
      qty,
      coins: Math.round(c.basePrice * qty * 1.4),
      xp: ORDER_XP[c.rarity] * qty,
    });
  }
  return orders;
}

export function doneOrders(profile: ILabProfile, day = todayKey()): string[] {
  return profile.orderDay === day ? (profile.orderDone ?? []) : [];
}

export type DeliverResult =
  | { ok: true; coins: number; xp: number; levelUp: boolean; level: number }
  | { ok: false; reason: "no_order" | "done" | "stock" };

export async function deliverOrder(userId: string, guildId: string, compoundId: string): Promise<DeliverResult> {
  const day = todayKey();
  const order = ordersForDay(day, userId).find((o) => o.compoundId === compoundId);
  if (!order) return { ok: false, reason: "no_order" };

  // يوم جديد؟ نصفّر السجل أولاً
  await LabProfile.updateOne({ userId, guildId, orderDay: { $ne: day } }, { $set: { orderDay: day, orderDone: [] } }, { upsert: false });

  const path = `compounds.${compoundId}`;
  const taken = await LabProfile.findOneAndUpdate(
    { userId, guildId, [path]: { $gte: order.qty }, orderDone: { $ne: compoundId } },
    { $inc: { [path]: -order.qty }, $addToSet: { orderDone: compoundId }, $set: { orderDay: day } },
  );
  if (!taken) {
    const fresh = await getLabProfile(userId, guildId);
    return { ok: false, reason: doneOrders(fresh, day).includes(compoundId) ? "done" : "stock" };
  }

  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins: order.coins } }, { upsert: true });
  const xpRes = await grantLabXp(userId, guildId, order.xp);
  return { ok: true, coins: order.coins, xp: order.xp, levelUp: xpRes.leveledUp, level: xpRes.level };
}

/* ───────────── رحلات الاستكشاف ───────────── */

export const EXPEDITION_HOURS = [1, 2] as const;
const URANIUM_MIN_LEVEL = 8;
const URANIUM_CHANCE = 0.15;

export function expeditionState(p: Pick<ILabProfile, "expeditionEndsAt" | "expeditionHours">, now = Date.now()):
  | { status: "none" }
  | { status: "running"; endsAt: number; hours: number }
  | { status: "ready"; hours: number } {
  const ends = p.expeditionEndsAt ? new Date(p.expeditionEndsAt).getTime() : 0;
  if (!ends) return { status: "none" };
  return ends > now ? { status: "running", endsAt: ends, hours: p.expeditionHours } : { status: "ready", hours: p.expeditionHours };
}

export async function startExpedition(userId: string, guildId: string, hours: number): Promise<{ ok: boolean; endsAt?: number }> {
  if (!EXPEDITION_HOURS.includes(hours as 1 | 2)) return { ok: false };
  await getLabProfile(userId, guildId);
  const endsAt = Date.now() + hours * 3_600_000;
  const res = await LabProfile.findOneAndUpdate(
    { userId, guildId, $or: [{ expeditionEndsAt: null }, { expeditionEndsAt: { $exists: false } }] },
    { $set: { expeditionEndsAt: new Date(endsAt), expeditionHours: hours } },
  );
  return res ? { ok: true, endsAt } : { ok: false };
}

export interface ExpeditionLoot {
  items: Record<string, number>;
  coins: number;
}

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export async function collectExpedition(userId: string, guildId: string): Promise<ExpeditionLoot | null> {
  // ذرّي: ما يستلمها إلا مرة وحدة وبعد انتهاء الوقت
  const done = await LabProfile.findOneAndUpdate(
    { userId, guildId, expeditionEndsAt: { $lte: new Date() } },
    { $set: { expeditionEndsAt: null } },
  );
  if (!done) return null;

  const hours = done.expeditionHours || 1;
  const rolls = hours === 2 ? 4 : 2;
  const available = ELEMENTS.filter((e) => e.tier === 1 || (e.tier === 2 && done.unlockedElements.includes(e.id)));
  const items: Record<string, number> = {};
  const add = (id: string, n: number) => {
    items[id] = (items[id] ?? 0) + n;
  };

  for (let i = 0; i < rolls; i++) add(pick(available).id, 2 + Math.floor(Math.random() * 4));
  if (Math.random() < 0.3) add("waste", 1 + Math.floor(Math.random() * 2));
  if (hours === 2 && done.labLevel >= URANIUM_MIN_LEVEL && Math.random() < URANIUM_CHANCE) add("uranium", 1 + Math.floor(Math.random() * 2));

  const coins = hours * 50;
  const inc: Record<string, number> = {};
  for (const [id, n] of Object.entries(items)) inc[`inventory.${id}`] = n;
  await LabProfile.updateOne({ userId, guildId }, { $inc: inc });
  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins } }, { upsert: true });
  return { items, coins };
}

export const lootLines = (loot: ExpeditionLoot): string =>
  Object.entries(loot.items)
    .map(([id, n]) => `${ELEMENT_MAP[id]?.icon ?? ""} ${ELEMENT_MAP[id]?.name ?? id} ×**${n}**`)
    .join("\n") + `\n${jenny(loot.coins)}`;
