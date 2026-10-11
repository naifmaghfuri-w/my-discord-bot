import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type Message,
} from "discord.js";
import { jenny } from "../constants";
import { LabProfile } from "../database/models/LabProfile";
import { UserProfile } from "../database/models/UserProfile";
import { logTransaction } from "../services/transactions";
import { COMPOUND_MAP, COMPOUNDS } from "./compounds";
import { TRADE_CANCEL, TRADE_NO, TRADE_OK, TRADE_PICK, cid } from "./ids";
import { getLabProfile } from "./service";

/** عرض @شخص السعر [الكمية]  — بدون سلاش */
export const TRADE_TRIGGER = /^عرض\s+<@!?(\d+)>\s+(\d{1,7})(?:\s+(\d{1,2}))?$/;

/** قنوات التبادل المسموحة فقط */
export const TRADE_CHANNELS = ["1522782977472462898", "1551169206400188538"];

export const MAX_PRICE = 1_000_000;
export const OFFER_TTL_MS = 10 * 60 * 1000;

/** يبدأ عرض تبادل: يرسل قائمة لاختيار المركب (للبائع فقط) */
export async function startTradeFromMessage(message: Message<true>, targetId: string, price: number, qty: number): Promise<void> {
  if (!TRADE_CHANNELS.includes(message.channelId)) {
    await message.reply({ content: `🤝 التبادل يشتغل فقط في: ${TRADE_CHANNELS.map((c) => `<#${c}>`).join(" • ")}`, allowedMentions: { parse: [] } }).catch(() => undefined);
    return;
  }
  const sellerId = message.author.id;
  const target = await message.client.users.fetch(targetId).catch(() => null);

  if (!target || target.bot || targetId === sellerId) {
    await message.channel.send("❌ ما تقدر تعرض مركباً على هذا الشخص.").catch(() => undefined);
    return;
  }
  if (price < 1 || price > MAX_PRICE || qty < 1) {
    await message.channel.send(`❌ السعر لازم بين 1 و ${MAX_PRICE.toLocaleString("en-US")}.`).catch(() => undefined);
    return;
  }

  const profile = await getLabProfile(sellerId, message.guildId);
  const options = COMPOUNDS.filter((c) => (profile.compounds[c.id] ?? 0) >= qty)
    .slice(0, 25)
    .map((c) => ({ label: `${c.name} (معك ${profile.compounds[c.id]})`, value: c.id, emoji: c.icon }));

  if (options.length === 0) {
    await message.channel.send(`❌ ما عندك مركب بكمية ${qty} أو أكثر لتعرضه.`).catch(() => undefined);
    return;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(cid(TRADE_PICK, sellerId, `${targetId}:${price}:${qty}`))
    .setPlaceholder("🧬 اختر المركب الذي تعرضه")
    .addOptions(options);

  await message.channel
    .send({
      content: `🤝 <@${sellerId}> يجهّز عرضاً لـ <@${targetId}>: **${qty}** وحدة بسعر ${jenny(price)}\nاختر المركب من القائمة:`,
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
      allowedMentions: { users: [targetId] },
    })
    .catch(() => undefined);
}

/** رسالة العرض النهائية: زر قبول/رفض للمشتري، وإلغاء للبائع */
export function buildOffer(sellerId: string, targetId: string, compoundId: string, price: number, qty: number) {
  const c = COMPOUND_MAP[compoundId];
  const extra = `${sellerId}:${compoundId}:${price}:${qty}`;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(cid(TRADE_OK, targetId, extra)).setLabel("قبول وشراء").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(cid(TRADE_NO, targetId, extra)).setLabel("رفض").setEmoji("❌").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(cid(TRADE_CANCEL, sellerId, extra)).setLabel("إلغاء العرض").setEmoji("🚫").setStyle(ButtonStyle.Secondary),
  );
  return {
    content: `🤝 **عرض تبادل**\n<@${sellerId}> يعرض على <@${targetId}>: ${c.icon} **${c.name}** ×${qty}\nالسعر: ${jenny(price)} • ينتهي بعد 10 دقائق`,
    components: [row],
  };
}

export type TradeResult =
  | { ok: true; compoundId: string }
  | { ok: false; reason: "seller_stock" | "buyer_coins" | "invalid" };

/** تنفيذ الصفقة بخطوات ذرّية مع تراجع لو فشلت الدفعة */
export async function executeTrade(
  sellerId: string,
  buyerId: string,
  guildId: string,
  compoundId: string,
  price: number,
  qty: number,
): Promise<TradeResult> {
  if (!COMPOUND_MAP[compoundId] || sellerId === buyerId || price < 1 || price > MAX_PRICE || qty < 1) {
    return { ok: false, reason: "invalid" };
  }

  const taken = await LabProfile.findOneAndUpdate(
    { userId: sellerId, guildId, [`compounds.${compoundId}`]: { $gte: qty } },
    { $inc: { [`compounds.${compoundId}`]: -qty } },
  );
  if (!taken) return { ok: false, reason: "seller_stock" };

  const paid = await UserProfile.findOneAndUpdate(
    { userId: buyerId, guildId, coins: { $gte: price } },
    { $inc: { coins: -price } },
  );
  if (!paid) {
    await LabProfile.updateOne({ userId: sellerId, guildId }, { $inc: { [`compounds.${compoundId}`]: qty } });
    return { ok: false, reason: "buyer_coins" };
  }

  await UserProfile.updateOne({ userId: sellerId, guildId }, { $inc: { coins: price } }, { upsert: true });
  await LabProfile.updateOne(
    { userId: buyerId, guildId },
    { $inc: { [`compounds.${compoundId}`]: qty } },
    { upsert: true },
  );
  await logTransaction(guildId, buyerId, "pay_sent", price, sellerId);
  await logTransaction(guildId, sellerId, "pay_received", price, buyerId);
  return { ok: true, compoundId };
}
