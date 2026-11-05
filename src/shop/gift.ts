import type { Message } from "discord.js";
import { Inventory } from "../database/models/Inventory";
import { CAR_IDS, ESTATE_IDS, FURNITURE_IDS, ITEMS, PHONE_IDS, type ItemId } from "./data";

/** !اهداء اسم الغرض @شخص  (أو !اهداء @شخص اسم الغرض) */
export const GIFT_TRIGGER = /^!\s*(?:اهداء|إهداء)(?:\s+(.+))?$/;

const noPing = (id?: string) => ({ parse: [] as never[], users: id ? [id] : [], repliedUser: false });
const UNIQUE = new Set<string>([...ESTATE_IDS, ...CAR_IDS, ...PHONE_IDS]);
void FURNITURE_IDS;

const norm = (s: string) => s.replace(/[ًٌٍَُِّْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim().toLowerCase();

function findItem(q: string): ItemId | "many" | null {
  const n = norm(q);
  if (!n) return null;
  const keys = Object.keys(ITEMS) as ItemId[];
  const exact = keys.find((k) => norm(ITEMS[k].name) === n);
  if (exact) return exact;
  const part = keys.filter((k) => norm(ITEMS[k].name).includes(n));
  if (part.length === 1) return part[0];
  return part.length > 1 ? "many" : null;
}

export async function handleGiftMessage(message: Message): Promise<boolean> {
  const m = GIFT_TRIGGER.exec(message.content.trim());
  if (!m || !message.inGuild()) return false;
  const reply = (content: string, to?: string) => message.reply({ content, allowedMentions: noPing(to) }).catch(() => undefined);
  const usage = "❌ الاستخدام: `!اهداء اسم الغرض @الشخص`\nمثال: `!اهداء سرير @فلان`";

  const body = m[1] ?? "";
  const mention = /<@!?(\d+)>/.exec(body);
  if (!mention) return void (await reply(usage)), true;
  const to = mention[1];
  const from = message.author.id;
  const q = body.replace(/<@!?\d+>/g, "").trim();
  if (!q) return void (await reply(usage)), true;
  if (to === from) return void (await reply("❌ ما تقدر تهدي نفسك.")), true;
  const target = await message.guild.members.fetch(to).catch(() => null);
  if (!target || target.user.bot) return void (await reply("❌ لازم تهدي شخص حقيقي موجود في السيرفر.")), true;

  const key = findItem(q);
  if (key === "many") return void (await reply("❌ اسم الغرض مشترك بين أكثر من غرض، اكتبه كامل.")), true;
  if (!key) return void (await reply("❌ ما لقيت هذا الغرض، اكتب اسمه مثل ما يظهر في `!مقتنياتي`.")), true;
  const item = ITEMS[key];
  const gid = message.guildId;
  const path = `items.${key}`;

  if (UNIQUE.has(key)) {
    // عقار/سيارة/هاتف: يُمتلك مرة وحدة، نحجز عند المستلم أولًا
    const reserved = await Inventory.findOneAndUpdate({ userId: to, guildId: gid, [path]: { $not: { $gte: 1 } } }, { $inc: { [path]: 1 } }, { upsert: true }).then(() => true, () => false);
    if (!reserved) return void (await reply(`❌ <@${to}> عنده ${item.name} من قبل.`, to)), true;
    const took = await Inventory.findOneAndUpdate({ userId: from, guildId: gid, [path]: { $gte: 1 } }, { $inc: { [path]: -1 } });
    if (!took) {
      await Inventory.updateOne({ userId: to, guildId: gid }, { $inc: { [path]: -1 } });
      return void (await reply(`❌ ما عندك ${item.name}.`)), true;
    }
  } else {
    const took = await Inventory.findOneAndUpdate({ userId: from, guildId: gid, [path]: { $gte: 1 } }, { $inc: { [path]: -1 } });
    if (!took) return void (await reply(`❌ ما عندك ${item.name}.`)), true;
    await Inventory.updateOne({ userId: to, guildId: gid }, { $inc: { [path]: 1 } }, { upsert: true });
  }
  await reply(`🎁 <@${from}> أهدى **${item.name}** إلى <@${to}>`, to);
  return true;
}
