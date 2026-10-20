import { jenny } from "../constants";
import { LabProfile, type ILabProfile } from "../database/models/LabProfile";
import { UserProfile } from "../database/models/UserProfile";
import { todayKey } from "../quests/time";
import { logTransaction } from "../services/transactions";
import { COMPOUND_MAP, COMPOUNDS, type CompoundDef } from "./compounds";
import { hasEngram, engramName } from "./engrams";
import { pageUnlocked, passive } from "./tree";
import { ELEMENT_MAP, ELEMENTS } from "./elements";
import { getLabProfile, grantLabXp } from "./service";

/* ───────────── الأجهزة ومعدات السلامة ───────────── */

export type DeviceKey = "centrifuge" | "distiller" | "analyzer" | "cooler" | "geiger" | "extinguisher" | "robot";

/** أجهزة تحتاج إنجرام مفتوح قبل الشراء */
export const DEVICES: Record<DeviceKey, { name: string; icon: string; price: number; desc: string }> = {
  analyzer: { name: "المحلّل (المجهر)", icon: "🔬", price: 2000, desc: "تلميحات بنص السعر، ويلمّح لك لو خليطك ناقص" },
  extinguisher: { name: "طفاية الحريق", icon: "🧯", price: 700, desc: "تقلل احتمال الحوادث 25%" },
  geiger: { name: "عدّاد جايغر", icon: "📟", price: 800, desc: "يعرض مستوى الإشعاع بدقة ويحذّرك" },
  centrifuge: { name: "الطرد المركزي", icon: "🌀", price: 2500, desc: "يحوّل النفايات الكيميائية لعناصر" },
  distiller: { name: "وحدة التقطير", icon: "⚗️", price: 3500, desc: "25% فرصة لمضاعفة الناتج" },
  robot: { name: "الروبوت الآلي", icon: "🤖", price: 4000, desc: "يصنّع لك وأنت غايب (يترقى مثل الفرن)" },
  cooler: { name: "مبرّد المفاعل", icon: "🧊", price: 1000, desc: "يفتح تفاعلات التبريد (تحت الصفر) + إشعاع أبطأ وإصابة أقصر (30 دقيقة)" },
};

/** هل الجهاز مفتوح للشراء؟ المبرّد يفتح من أول مستوى بالشجرة، والباقي من إنجرامه */
export function deviceUnlocked(p: { engrams?: string[]; unlockedElements?: string[] }, key: string): boolean {
  return key === "cooler" ? pageUnlocked(p, 1) : hasEngram(p, key);
}

export const isDevice = (k: string): k is DeviceKey => k in DEVICES;

/** المستهلكات: تُستخدم تلقائياً عند الحاجة (ما عدا مضاد الإشعاع) */
export const CONSUMABLES: Record<string, { name: string; icon: string; price: number; desc: string }> = {
  catalyst: { name: "محفّز", icon: "🧫", price: 150, desc: "ينقذ تفاعلاً حرارته/ضغطه خارج النطاق بقليل (±20° و ±3 ضغط)" },
  stabilizer: { name: "مثبّت", icon: "🛡️", price: 250, desc: "يمنع حادثاً مخبرياً لو كان بيصير" },
  antirad: { name: "مضاد إشعاع", icon: "💊", price: 400, desc: "يصفّر الإشعاع ويشفيك من الإصابة (استخدمه من الأجهزة)" },
  energy: { name: "مشروب طاقة", icon: "🥤", price: 120, desc: "×1.5 خبرة في تفاعلك الناجح التالي" },
};

export const consumableCount = (p: Pick<ILabProfile, "consumables">, k: string): number => p.consumables?.[k] ?? 0;

export type EquipKey = "furnace" | "pump" | "goggles" | "gloves" | "hazmat" | DeviceKey;

export const MAX_LEVEL = 5;
/** تكلفة الترقية إلى المستوى 2، 3، 4، 5 */
export const UPGRADE_COST = [600, 1800, 4500, 11000];

export const GEAR: Record<"goggles" | "gloves" | "hazmat", { name: string; icon: string; price: number; reduce: number; desc: string }> = {
  goggles: { name: "نظارات السلامة", icon: "🥽", price: 500, reduce: 0.4, desc: "تقلل احتمال الحوادث 40%" },
  gloves: { name: "قفازات مقاومة", icon: "🧤", price: 400, reduce: 0.3, desc: "تقلل احتمال الحوادث 30%" },
  hazmat: { name: "بدلة حماية", icon: "🥼", price: 3000, reduce: 0.2, desc: "تقلل الحوادث 20% وتحميك من الإشعاع" },
};

export const level = (p: Pick<ILabProfile, "equipment">, key: "furnace" | "pump" | "robot"): number =>
  Math.max(1, Math.min(MAX_LEVEL, p.equipment?.[key] ?? 1));
export const hasGear = (p: Pick<ILabProfile, "equipment">, key: string): boolean =>
  (p.equipment?.[key] ?? 0) >= 1;

/** هامش التسامح الإضافي للحرارة (الفرن) والضغط (المضخة) */
export function tolerance(p: Pick<ILabProfile, "equipment" | "engrams">): { temp: number; pressure: number } {
  const f = level(p, "furnace");
  const pm = level(p, "pump");
  return { temp: (f - 1) * 10 + passive(p, "tol"), pressure: pm >= 3 ? pm - 2 : 0 };
}

/** احتمال حادث لتفاعل معيّن (0 لو غير خطير) */
export function accidentChance(compound: CompoundDef, p: Pick<ILabProfile, "equipment" | "engrams">): number {
  if (!compound.hazard) return 0;
  const base = compound.hazard * 0.1;
  const reduce =
    (["goggles", "gloves", "hazmat"] as const).reduce((a, k) => a + (hasGear(p, k) ? GEAR[k].reduce : 0), 0) +
    (hasGear(p, "extinguisher") ? 0.25 : 0) +
    passive(p, "safe");
  return base * (1 - Math.min(0.9, reduce));
}

export type BuyEquipResult =
  | { ok: true; spent: number; label: string }
  | { ok: false; reason: "max" | "owned" | "coins" | "unknown" | "engram"; engram?: string };

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
  } else if (key === "robot") {
    const cur = profile.equipment?.robot ?? 0;
    if (cur === 0) {
      if (!hasEngram(profile, "robot")) return { ok: false, reason: "engram", engram: engramName("robot") };
      cost = DEVICES.robot.price;
      newValue = 1;
      label = `${DEVICES.robot.icon} ${DEVICES.robot.name}`;
      guard = { $or: [{ [path]: { $exists: false } }, { [path]: 0 }] };
    } else {
      if (cur >= MAX_LEVEL) return { ok: false, reason: "max" };
      cost = UPGRADE_COST[cur - 1];
      newValue = cur + 1;
      label = `🤖 الروبوت → مستوى ${newValue}`;
      guard = { [path]: cur };
    }
  } else if (isDevice(key)) {
    if (hasGear(profile, key)) return { ok: false, reason: "owned" };
    if (!deviceUnlocked(profile, key)) return { ok: false, reason: "engram", engram: key === "cooler" ? "المستوى 1" : engramName(key) };
    cost = DEVICES[key].price;
    newValue = 1;
    label = `${DEVICES[key].icon} ${DEVICES[key].name}`;
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
    return { ok: false, reason: key === "furnace" || key === "pump" || (key === "robot" && (profile.equipment?.robot ?? 0) > 0) ? "max" : "owned" };
  }
  await logTransaction(guildId, userId, "lab_purchase", cost);
  return { ok: true, spent: cost, label };
}

export async function buyConsumable(userId: string, guildId: string, key: string): Promise<{ ok: true; spent: number; label: string } | { ok: false; reason: "coins" | "unknown" }> {
  const def = CONSUMABLES[key];
  if (!def) return { ok: false, reason: "unknown" };
  await getLabProfile(userId, guildId);
  const paid = await UserProfile.findOneAndUpdate({ userId, guildId, coins: { $gte: def.price } }, { $inc: { coins: -def.price } });
  if (!paid) return { ok: false, reason: "coins" };
  await LabProfile.updateOne({ userId, guildId }, { $inc: { [`consumables.${key}`]: 1 } });
  await logTransaction(guildId, userId, "lab_purchase", def.price);
  return { ok: true, spent: def.price, label: `${def.icon} ${def.name}` };
}

/** يستهلك وحدة من مستهلك بشكل ذرّي (يرجع false لو ما عنده) */
export async function consumeOne(userId: string, guildId: string, key: string): Promise<boolean> {
  const res = await LabProfile.findOneAndUpdate({ userId, guildId, [`consumables.${key}`]: { $gte: 1 } }, { $inc: { [`consumables.${key}`]: -1 } });
  return Boolean(res);
}

/** مضاد الإشعاع: يصفّر الإشعاع والإصابة */
export async function useAntirad(userId: string, guildId: string): Promise<boolean> {
  if (!(await consumeOne(userId, guildId, "antirad"))) return false;
  await LabProfile.updateOne({ userId, guildId }, { $set: { radiation: 0, radiationAt: new Date(), sickUntil: null } });
  return true;
}

/* ───────────── الإشعاع ───────────── */

const EXPOSURE_PER_REACTION = 35;
const DECAY_PER_HOUR = 10;
const SICK_MS = 60 * 60 * 1000;
const SICK_MS_COOLER = 30 * 60 * 1000;

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
  const cooler = hasGear(profile, "cooler");
  const total = currentRadiation(profile, now) + Math.round(EXPOSURE_PER_REACTION * (cooler ? 0.5 : 1) * (1 - passive(profile, "rad")));
  if (total >= 100) {
    const ms = cooler ? SICK_MS_COOLER : SICK_MS;
    await LabProfile.updateOne(
      { userId, guildId },
      { $set: { radiation: 0, radiationAt: new Date(now), sickUntil: new Date(now + ms) } },
    );
    return `☢️ تعرّضت لجرعة إشعاع عالية وأُصبت! لا يمكنك التفاعل لمدة ${cooler ? "30 دقيقة" : "ساعة"}. بدلة الحماية أو مضاد الإشعاع 💊 يحلّان المشكلة.`;
  }
  await LabProfile.updateOne({ userId, guildId }, { $set: { radiation: total, radiationAt: new Date(now) } });
  if (!hasGear(profile, "geiger")) return "☢️ تعرّضت لإشعاع! ما تعرف كم مستواه بدون عدّاد جايغر 📟.";
  return `☢️ مستوى إشعاعك الآن **${total}/100**.${total >= 70 ? " ⚠️ خطر! تفاعل مشع ثاني ممكن يصيبك." : ""} بدلة الحماية تمنع ذلك.`;
}

/* ───────────── طلبات العملاء ───────────── */

export interface OrderDef {
  compoundId: string;
  qty: number;
  coins: number;
  xp: number;
}

const ORDER_COUNT = 3;
const ORDER_POOL = COMPOUNDS.filter((c) => ["common", "uncommon", "rare"].includes(c.rarity) && !c.radioactive && !c.engram && !c.cold && (c.hazard ?? 0) < 3);
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

  const coins = Math.round(order.coins * (1 + passive(taken, "order")));
  await UserProfile.updateOne({ userId, guildId }, { $inc: { coins } }, { upsert: true });
  const xpRes = await grantLabXp(userId, guildId, order.xp);
  return { ok: true, coins, xp: order.xp, levelUp: xpRes.leveledUp, level: xpRes.level };
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
  const rolls = (hours === 2 ? 4 : 2) + (Math.random() < passive(done, "loot") ? 1 : 0);
  const available = ELEMENTS.filter((e) => e.tier === 1 || (e.tier === 2 && hasEngram(done, e.id)));
  const items: Record<string, number> = {};
  const add = (id: string, n: number) => {
    items[id] = (items[id] ?? 0) + n;
  };

  for (let i = 0; i < rolls; i++) add(pick(available).id, 2 + Math.floor(Math.random() * 4));
  if (Math.random() < 0.3) add("waste", 1 + Math.floor(Math.random() * 2));
  if (hours === 2 && done.labLevel >= URANIUM_MIN_LEVEL && Math.random() < URANIUM_CHANCE) add("uranium", 1 + Math.floor(Math.random() * 2));
  // مواد مشعة متقدمة: تحتاج إنجرام الكيمياء النووية
  if (hours === 2 && hasEngram(done, "nuclear")) {
    if (done.labLevel >= 12 && Math.random() < 0.1) add("radium", 1);
    if (done.labLevel >= 16 && Math.random() < 0.06) add("plutonium", 1);
  }

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


/* ───────────── الطرد المركزي ───────────── */

const CENTRIFUGE_BATCH = 3;
const CENTRIFUGE_MAX_BATCHES = 5;

export type CentrifugeResult =
  | { ok: true; batches: number; items: Record<string, number> }
  | { ok: false; reason: "no_device" | "no_waste" };

/** كل 3 نفايات تعطي 3 عناصر عشوائية متاحة لك (حتى 5 دفعات بالمرة) */
export async function runCentrifuge(userId: string, guildId: string): Promise<CentrifugeResult> {
  const profile = await getLabProfile(userId, guildId);
  if (!hasGear(profile, "centrifuge")) return { ok: false, reason: "no_device" };
  const batches = Math.min(CENTRIFUGE_MAX_BATCHES, Math.floor((profile.inventory?.waste ?? 0) / CENTRIFUGE_BATCH));
  if (batches < 1) return { ok: false, reason: "no_waste" };

  const used = batches * CENTRIFUGE_BATCH;
  const taken = await LabProfile.findOneAndUpdate(
    { userId, guildId, "inventory.waste": { $gte: used } },
    { $inc: { "inventory.waste": -used } },
  );
  if (!taken) return { ok: false, reason: "no_waste" };

  const pool = ELEMENTS.filter((e) => e.tier === 1 || (e.tier === 2 && hasEngram(profile, e.id)));
  const items: Record<string, number> = {};
  for (let i = 0; i < batches * 3; i++) {
    const id = pick(pool).id;
    items[id] = (items[id] ?? 0) + 1 + (Math.random() < 0.25 ? 1 : 0);
  }
  const inc: Record<string, number> = {};
  for (const [id, n] of Object.entries(items)) inc[`inventory.${id}`] = n;
  await LabProfile.updateOne({ userId, guildId }, { $inc: inc });
  return { ok: true, batches, items };
}

/* ───────────── الروبوت الآلي ───────────── */

export const ROBOT_MINUTES_PER_UNIT = 12;

/** عدد الوحدات بالدفعة = مستوى الروبوت × 2 */
export const robotBatch = (p: Pick<ILabProfile, "equipment">): number => level(p, "robot") * 2;

/** المركبات اللي يقدر الروبوت يصنعها: معروفة، مو مشعة، مو نادرة جداً، ومفتوحة */
export function robotEligible(p: ILabProfile): CompoundDef[] {
  return COMPOUNDS.filter(
    (c) =>
      p.discovered.includes(c.id) &&
      !c.radioactive &&
      c.rarity !== "legendary" &&
      (c.hazard ?? 0) < 3 &&
      (!c.engram || hasEngram(p, c.engram)),
  );
}

export function robotState(p: Pick<ILabProfile, "robotEndsAt" | "robotCompound" | "robotQty">, now = Date.now()):
  | { status: "idle" }
  | { status: "running"; endsAt: number; compoundId: string; qty: number }
  | { status: "ready"; compoundId: string; qty: number } {
  const ends = p.robotEndsAt ? new Date(p.robotEndsAt).getTime() : 0;
  if (!ends) return { status: "idle" };
  return ends > now
    ? { status: "running", endsAt: ends, compoundId: p.robotCompound, qty: p.robotQty }
    : { status: "ready", compoundId: p.robotCompound, qty: p.robotQty };
}

export type RobotStartResult = { ok: true; qty: number; endsAt: number } | { ok: false; reason: "no_robot" | "busy" | "ingredients" | "invalid" };

export async function startRobot(userId: string, guildId: string, compoundId: string): Promise<RobotStartResult> {
  const profile = await getLabProfile(userId, guildId);
  if (!hasGear(profile, "robot")) return { ok: false, reason: "no_robot" };
  const def = COMPOUND_MAP[compoundId];
  if (!def || !robotEligible(profile).some((c) => c.id === compoundId)) return { ok: false, reason: "invalid" };
  if (robotState(profile).status !== "idle") return { ok: false, reason: "busy" };

  // نصنّع أكبر كمية ممكنة (حتى سعة الدفعة) حسب المكونات المتوفرة
  const have = (id: string) => (COMPOUND_MAP[id] ? profile.compounds?.[id] : profile.inventory?.[id]) ?? 0;
  let qty = robotBatch(profile);
  for (const [id, n] of Object.entries(def.recipe)) qty = Math.min(qty, Math.floor(have(id) / n));
  if (qty < 1) return { ok: false, reason: "ingredients" };

  const filter: Record<string, unknown> = {
    userId,
    guildId,
    $or: [{ robotEndsAt: null }, { robotEndsAt: { $exists: false } }],
  };
  const dec: Record<string, number> = {};
  for (const [id, n] of Object.entries(def.recipe)) {
    const path = COMPOUND_MAP[id] ? `compounds.${id}` : `inventory.${id}`;
    filter[path] = { $gte: n * qty };
    dec[path] = -n * qty;
  }
  const endsAt = Date.now() + Math.round(qty * ROBOT_MINUTES_PER_UNIT * (1 - passive(profile, "robot")) * 60_000);
  const res = await LabProfile.findOneAndUpdate(filter, {
    $inc: dec,
    $set: { robotCompound: compoundId, robotQty: qty, robotEndsAt: new Date(endsAt) },
  });
  return res ? { ok: true, qty, endsAt } : { ok: false, reason: "busy" };
}

export async function collectRobot(userId: string, guildId: string): Promise<{ compoundId: string; qty: number; xp: number; levelUp: boolean; level: number } | null> {
  // ذرّي: يستلمها مرة وحدة وبعد انتهاء الوقت
  const done = await LabProfile.findOneAndUpdate(
    { userId, guildId, robotEndsAt: { $lte: new Date() } },
    { $set: { robotEndsAt: null, robotCompound: "", robotQty: 0 } },
  );
  if (!done) return null;
  const def = COMPOUND_MAP[done.robotCompound];
  if (!def) return null;
  await LabProfile.updateOne(
    { userId, guildId },
    { $inc: { [`compounds.${def.id}`]: done.robotQty, "stats.crafts": done.robotQty } },
  );
  const xp = Math.max(1, Math.round(def.xp * done.robotQty * 0.5));
  const res = await grantLabXp(userId, guildId, xp);
  return { compoundId: def.id, qty: done.robotQty, xp, levelUp: res.leveledUp, level: res.level };
}
