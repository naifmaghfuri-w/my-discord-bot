import { MessageFlags, type ButtonInteraction, type StringSelectMenuInteraction } from "discord.js";
import { jenny } from "../constants";
import { LabSession } from "../database/models/LabSession";
import { getProfile } from "../services/economy";
import { logger } from "../utils/logger";
import { PRESSURE, TEMP } from "./compounds";
import { ELEMENT_MAP } from "./elements";
import {
  BACK,
  CENTRIFUGE_RUN,
  ENGRAM_TAB,
  MARKET_PAGE,
  OPEN_ROBOT,
  PAGE_CYCLE,
  ROBOT_COLLECT,
  ROBOT_START,
  USE_ANTIRAD,
  CODEX_PAGE,
  HINT_BUY_SELECT,
  HINT_PAGE,
  NOOP,
  OPEN_ACH,
  OPEN_HINTS,
  OPEN_QUESTS,
  OPEN_TRADE_HELP,
  OPEN_EQUIP,
  EQUIP_BUY_SELECT,
  OPEN_ORDERS,
  ORDER_DELIVER_SELECT,
  OPEN_EXPED,
  EXPED_START,
  EXPED_COLLECT,
  TRADE_CANCEL,
  TRADE_NO,
  TRADE_OK,
  TRADE_PICK,
  OPEN_EXTRA,
  OPEN_LAB,
  LEVELS_UNLOCK_SELECT,
  MARKET_SELL_SELECT,
  MARKET_SELLALL_SELECT,
  OPEN_CODEX,
  OPEN_LEVELS,
  OPEN_MARKET,
  OPEN_SHOP,
  OPEN_WAREHOUSE,
  PRESSURE_DOWN,
  PRESSURE_UP,
  PUBLISH,
  REACT,
  RESET,
  SELECT_COMPOUND,
  SELECT_ELEMENT,
  SHOP_BUY_SELECT,
  SHOP_QTY,
  STEP_TOGGLE,
  TEMP_DOWN,
  TEMP_UP,
  parseCid,
} from "./ids";
import { sellAllCompound, sellCompound } from "./market";
import { recordEvent } from "./progress";
import { renderReactionGif } from "./render";
import { OFFER_TTL_MS, buildOffer, executeTrade } from "./trade";
import { ENGRAM_MAP, KIND_LABEL, type EngramKind } from "./engrams";
import { buyConsumable, buyEquipment, collectExpedition, collectRobot, deliverOrder, lootLines, runCentrifuge, startExpedition, startRobot, useAntirad } from "./workshop";
import { COMPOUND_MAP } from "./compounds";
import { RARITY_INFO } from "./compounds";
import {
  addToMix,
  adjustPressure,
  adjustTemp,
  attemptReaction,
  buyElement,
  buyHint,
  getLabProfile,
  getSession,
  publishArticle,
  resetSession,
  toggleStep,
  unlockEngram,
} from "./service";
import {
  buildAccidentView,
  buildEquipView,
  buildExpeditionView,
  buildOrdersView,
  buildArticleEmbed,
  buildCodexView,
  buildAchievementsView,
  buildExtraPanel,
  buildHintsView,
  buildHubPanel,
  buildQuestsView,
  buildReactFailView,
  buildTradeHelpView,
  buildLevelsView,
  buildMainPanel,
  buildMarketView,
  buildReactSuccessView,
  buildRobotView,
  buildShopView,
  buildWarehouseView,
  backRow,
  type PanelResult,
} from "./views";

const tabOf = (v?: string): EngramKind => (v && v in KIND_LABEL ? (v as EngramKind) : "element");

const NOT_YOUR_OFFER = "🔒 هذا العرض مو لك.";
const NOT_OWNER = "🔒 هذا مختبر غيرك. اكتب `lab` عشان تفتح مختبرك.";

/** attachments: [] يمسح الصور القديمة، وإلا تتراكم مع كل تحديث */
function asUpdate(panel: PanelResult) {
  return { content: panel.content ?? null, embeds: panel.embeds, components: panel.components, files: panel.files, attachments: [] };
}

async function renderMain(userId: string, guildId: string, note?: string): Promise<PanelResult> {
  const [profile, session] = await Promise.all([getLabProfile(userId, guildId), getSession(userId, guildId)]);
  return buildMainPanel(profile, session, note);
}

/** القائمة الرئيسية (تُستخدم أيضاً من أمر lab النصي) */
export async function buildLabHub(userId: string, guildId: string, name: string, avatarUrl: string): Promise<PanelResult> {
  const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
  return buildHubPanel(profile, coins, name, avatarUrl);
}

function nameOf(interaction: ButtonInteraction): string {
  const m = interaction.member;
  return m && "displayName" in m ? m.displayName : interaction.user.username;
}

async function coinsOf(userId: string, guildId: string): Promise<number> {
  return (await getProfile(userId, guildId)).coins;
}

export async function handleLabButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId || !customId.startsWith("lab_")) return false;

  const { base, ownerId, extra } = parseCid(customId);
  const userId = interaction.user.id;

  if (ownerId !== userId) {
    const msg = base.startsWith("lab_trade") ? NOT_YOUR_OFFER : NOT_OWNER;
    await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => undefined);
    return true;
  }

  try {
    switch (base) {
      case TEMP_UP:
      case TEMP_DOWN:
        await adjustTemp(userId, guildId, base === TEMP_UP ? 1 : -1, TEMP.step, TEMP.min, TEMP.max);
        await interaction.update(asUpdate(await renderMain(userId, guildId)));
        return true;

      case PRESSURE_UP:
      case PRESSURE_DOWN:
        await adjustPressure(userId, guildId, base === PRESSURE_UP ? 1 : -1, PRESSURE.step, PRESSURE.min, PRESSURE.max);
        await interaction.update(asUpdate(await renderMain(userId, guildId)));
        return true;

      case STEP_TOGGLE:
        await toggleStep(userId, guildId);
        await interaction.update(asUpdate(await renderMain(userId, guildId)));
        return true;

      case RESET:
        await resetSession(userId, guildId);
        await interaction.update(asUpdate(await renderMain(userId, guildId)));
        return true;

      case BACK:
        await interaction.update(asUpdate(await buildLabHub(userId, guildId, nameOf(interaction), interaction.user.displayAvatarURL())));
        return true;

      case OPEN_LAB:
        await interaction.update(asUpdate(await renderMain(userId, guildId)));
        return true;

      case OPEN_EXTRA:
        await interaction.update(asUpdate(buildExtraPanel(userId)));
        return true;

      case NOOP:
        await interaction.deferUpdate();
        return true;

      case PAGE_CYCLE: {
        const [profile, session] = await Promise.all([getLabProfile(userId, guildId), getSession(userId, guildId)]);
        const n = Math.max(
          1,
          Math.ceil(Object.values(profile.inventory ?? {}).filter((q) => q > 0).length / 25),
          Math.ceil(Object.values(profile.compounds ?? {}).filter((q) => q > 0).length / 25),
        );
        await LabSession.updateOne({ userId, guildId }, { $set: { page: ((session.page ?? 0) + 1) % n } });
        await interaction.update(asUpdate(await renderMain(userId, guildId)));
        return true;
      }

      case MARKET_PAGE:
        await interaction.update(asUpdate(await buildMarketView(guildId, await getLabProfile(userId, guildId), undefined, Number(extra) || 0)));
        return true;

      case ENGRAM_TAB:
        await interaction.update(asUpdate(buildLevelsView(await getLabProfile(userId, guildId), undefined, tabOf(extra))));
        return true;

      case OPEN_ROBOT:
        await interaction.update(asUpdate(buildRobotView(await getLabProfile(userId, guildId))));
        return true;

      case ROBOT_COLLECT: {
        const res = await collectRobot(userId, guildId);
        const c = res ? COMPOUND_MAP[res.compoundId] : null;
        const note = res
          ? `🎁 استلمت ${c?.icon ?? ""} ${c?.name ?? ""} ×${res.qty} • +${res.xp} XP${res.levelUp ? ` • 🆙 المستوى **${res.level}**` : ""}`
          : "⏳ الروبوت لسه ما خلص.";
        await interaction.update(asUpdate(buildRobotView(await getLabProfile(userId, guildId), note)));
        return true;
      }

      case CENTRIFUGE_RUN: {
        const res = await runCentrifuge(userId, guildId);
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        const note = res.ok
          ? `🌀 دفعات: ${res.batches}\n${Object.entries(res.items).map(([id, n]) => `${ELEMENT_MAP[id]?.icon ?? ""} ${ELEMENT_MAP[id]?.name ?? id} ×**${n}**`).join(" • ")}`
          : res.reason === "no_device"
            ? "❌ ما تملك الطرد المركزي."
            : "❌ تحتاج 3 نفايات كيميائية على الأقل.";
        await interaction.update(asUpdate(buildEquipView(profile, coins, note)));
        return true;
      }

      case USE_ANTIRAD: {
        const ok = await useAntirad(userId, guildId);
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildEquipView(profile, coins, ok ? "💊 تم تصفير إشعاعك وشُفيت من الإصابة." : "❌ ما عندك مضاد إشعاع.")));
        return true;
      }

      case OPEN_WAREHOUSE: {
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildWarehouseView(profile, coins)));
        return true;
      }

      case OPEN_CODEX:
      case CODEX_PAGE:
        await interaction.update(asUpdate(buildCodexView(await getLabProfile(userId, guildId), Number(extra) || 0)));
        return true;

      case OPEN_MARKET:
        await interaction.update(asUpdate(await buildMarketView(guildId, await getLabProfile(userId, guildId))));
        return true;

      case OPEN_SHOP: {
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildShopView(profile, coins, 1)));
        return true;
      }

      case SHOP_QTY: {
        const qty = Math.max(1, Math.min(25, Number(extra) || 1));
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildShopView(profile, coins, qty)));
        return true;
      }

      case OPEN_QUESTS:
        await interaction.update(asUpdate(buildQuestsView(await getLabProfile(userId, guildId))));
        return true;

      case OPEN_ACH:
        await interaction.update(asUpdate(buildAchievementsView(await getLabProfile(userId, guildId))));
        return true;

      case OPEN_TRADE_HELP:
        await interaction.update(asUpdate(buildTradeHelpView(userId)));
        return true;

      case OPEN_HINTS:
      case HINT_PAGE: {
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildHintsView(profile, coins, Number(extra) || 0)));
        return true;
      }

      case OPEN_LEVELS:
        await interaction.update(asUpdate(buildLevelsView(await getLabProfile(userId, guildId))));
        return true;

      case OPEN_EQUIP: {
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildEquipView(profile, coins)));
        return true;
      }

      case OPEN_ORDERS:
        await interaction.update(asUpdate(buildOrdersView(await getLabProfile(userId, guildId))));
        return true;

      case OPEN_EXPED:
        await interaction.update(asUpdate(buildExpeditionView(await getLabProfile(userId, guildId))));
        return true;

      case EXPED_START: {
        const res = await startExpedition(userId, guildId, Number(extra) || 0);
        const note = res.ok ? "🧭 انطلق المساعد في رحلته!" : "❌ المساعد في رحلة بالفعل.";
        await interaction.update(asUpdate(buildExpeditionView(await getLabProfile(userId, guildId), note)));
        return true;
      }

      case EXPED_COLLECT: {
        const loot = await collectExpedition(userId, guildId);
        const note = loot ? `🎁 غنائم الرحلة:\n${lootLines(loot)}` : "⏳ المساعد لسه ما رجع.";
        await interaction.update(asUpdate(buildExpeditionView(await getLabProfile(userId, guildId), note)));
        return true;
      }

      case REACT: {
        // توليد الـ GIF قد يأخذ أكثر من 3 ثواني، فنؤجل الرد أولاً
        await interaction.deferUpdate();
        const result = await attemptReaction(userId, guildId);

        if (!result.ok) {
          if (result.reason === "sick") {
            await interaction.editReply(asUpdate(await renderMain(userId, guildId, `🤒 أنت مصاب بالإشعاع، المختبر معطّل **${result.minutes}** دقيقة. بدلة الحماية تمنع هذا مستقبلاً.`)));
          } else if (result.reason === "locked_recipe") {
            await interaction.editReply(asUpdate(await renderMain(userId, guildId, `🔐 خليطك يطابق وصفة لكنها مقفلة. افتح إنجرام **${result.engram}** من 🎚️ المستويات (ما انصرف شيء من مكوناتك).`)));
          } else if (result.reason === "missing") {
            await interaction.editReply(asUpdate(await renderMain(userId, guildId, "❌ مكونات الخليط ما تكفي، جرب تصفير الخليط.")));
          } else {
            await interaction.followUp({ content: "❌ خليطك فاضي، أضف عناصر أول.", flags: MessageFlags.Ephemeral });
          }
          return true;
        }

        if (!result.success && result.kind === "near") {
          const note = `🔎 قريب جداً! المكونات صحيحة لكن الظروف غلط:\n${result.hints.join("\n")}\n_(ما انصرف شيء من مكوناتك)_`;
          await interaction.editReply(asUpdate(await renderMain(userId, guildId, note)));
          return true;
        }

        if (!result.success) {
          const [gif, lines] = await Promise.all([
            renderReactionGif(result.snapshot.mix, result.snapshot.temp, result.snapshot.pressure, { kind: "fail" }),
            recordEvent(userId, guildId, { type: "experiment_failed" }),
          ]);
          const all = [...result.notes, ...lines];
          const view =
            result.kind === "accident"
              ? buildAccidentView(userId, gif, result.compound.id, result.xp, result.waste, all)
              : buildReactFailView(userId, gif, result.xp, result.waste, all);
          await interaction.editReply(asUpdate(view));
          return true;
        }

        const rarity = RARITY_INFO[result.compound.rarity];
        const [gif, lines] = await Promise.all([
          renderReactionGif(result.snapshot.mix, result.snapshot.temp, result.snapshot.pressure, {
            kind: "success",
            color: rarity.color,
            name: result.compound.name,
            rarityName: rarity.name,
          }),
          recordEvent(userId, guildId, { type: "craft", rarity: result.compound.rarity, discoveredNow: result.discoveredNow }),
        ]);
        const view = await buildReactSuccessView(
          userId,
          result.compound.id,
          result.discoveredNow,
          result.xpResult.level,
          result.xpResult.leveledUp,
          result.xpResult.tokensGained,
          gif,
          [...result.notes, ...lines],
        );
        await interaction.editReply(asUpdate(view));
        return true;
      }

      case TRADE_NO:
      case TRADE_CANCEL: {
        const [sellerId = "", compoundId = ""] = (extra ?? "").split(":");
        const c = COMPOUND_MAP[compoundId];
        const text =
          base === TRADE_NO
            ? `❌ <@${userId}> رفض عرض <@${sellerId}> (${c?.icon ?? ""} ${c?.name ?? "مركب"}).`
            : `🚫 <@${userId}> ألغى عرضه.`;
        await interaction.update({ content: text, components: [], allowedMentions: { parse: [] } });
        return true;
      }

      case TRADE_OK: {
        const [sellerId = "", compoundId = "", priceStr = "0", qtyStr = "1"] = (extra ?? "").split(":");
        const price = Number(priceStr);
        const qty = Number(qtyStr);
        const msg = interaction.message;

        if (Date.now() - msg.createdTimestamp > OFFER_TTL_MS) {
          await interaction.update({ content: "⌛ انتهت مدة هذا العرض.", components: [], allowedMentions: { parse: [] } });
          return true;
        }

        const result = await executeTrade(sellerId, userId, guildId, compoundId, price, qty);
        if (!result.ok) {
          if (result.reason === "buyer_coins") {
            await interaction.reply({ content: "❌ رصيدك ما يكفي لهذا العرض.", flags: MessageFlags.Ephemeral });
            return true;
          }
          const text = result.reason === "seller_stock" ? "❌ البائع ما عاد عنده هذي الكمية، انتهى العرض." : "❌ العرض غير صالح.";
          await interaction.update({ content: text, components: [], allowedMentions: { parse: [] } });
          return true;
        }

        const c = COMPOUND_MAP[compoundId];
        await interaction.update({
          content: `✅ تمت الصفقة! <@${userId}> اشترى ${c.icon} **${c.name}** ×${qty} من <@${sellerId}> بسعر ${jenny(price)}`,
          components: [],
          allowedMentions: { parse: [] },
        });

        const [buyerLines, sellerLines] = await Promise.all([
          recordEvent(userId, guildId, { type: "trade" }),
          recordEvent(sellerId, guildId, { type: "trade" }),
        ]);
        const extraLines = [
          ...buyerLines.map((l) => `<@${userId}>: ${l}`),
          ...sellerLines.map((l) => `<@${sellerId}>: ${l}`),
        ];
        if (extraLines.length) {
          await interaction.followUp({ content: extraLines.join("\n"), allowedMentions: { parse: [] } });
        }
        return true;
      }

      case PUBLISH: {
        const result = await publishArticle(userId, guildId, extra ?? "");
        if (!result.ok) {
          await interaction.reply({ content: "❌ تعذّر نشر المقال (ربما نشرته من قبل).", flags: MessageFlags.Ephemeral });
          return true;
        }
        await interaction.update({ components: [backRow(userId, "lab")] });
        await interaction.followUp({
          embeds: [buildArticleEmbed(userId, extra ?? "", result.reputation ?? 0, result.total ?? 0)],
          allowedMentions: { parse: [] },
        });
        return true;
      }
    }
  } catch (err) {
    logger.error("خطأ في زر المختبر", err);
    const payload = { content: "❌ صار خطأ، حاول مرة ثانية.", flags: MessageFlags.Ephemeral } as const;
    if (!interaction.replied && !interaction.deferred) await interaction.reply(payload).catch(() => undefined);
    else await interaction.followUp(payload).catch(() => undefined);
    return true;
  }

  return false;
}

export async function handleLabSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId || !customId.startsWith("lab_")) return false;

  const { base, ownerId, extra } = parseCid(customId);
  const userId = interaction.user.id;
  const value = interaction.values[0];

  if (ownerId !== userId) {
    const msg = base.startsWith("lab_trade") ? NOT_YOUR_OFFER : NOT_OWNER;
    await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral }).catch(() => undefined);
    return true;
  }

  try {
    switch (base) {
      case SELECT_ELEMENT:
      case SELECT_COMPOUND: {
        const res = await addToMix(userId, guildId, value);
        const note = res.ok ? undefined : res.reason === "insufficient" ? "❌ ما عندك كمية أكثر من هذا بالمستودع." : "❌ هذا العنصر غير متاح لك.";
        await interaction.update(asUpdate(await renderMain(userId, guildId, note)));
        return true;
      }

      case SHOP_BUY_SELECT: {
        const qty = Math.max(1, Math.min(25, Number(extra) || 1));
        const result = await buyElement(userId, guildId, value, qty);
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        const el = ELEMENT_MAP[value];
        let note = result.ok
          ? `✅ اشتريت ${el?.icon} ${el?.name} ×${qty} مقابل ${jenny(result.spent)}`
          : result.reason === "locked"
            ? "❌ هذا العنصر مقفل، افتحه أول من المستويات."
            : "❌ رصيد محفظتك ما يكفي.";
        if (result.ok) {
          const lines = await recordEvent(userId, guildId, { type: "buy", qty });
          if (lines.length) note += `\n${lines.join("\n")}`;
        }
        await interaction.update(asUpdate(buildShopView(profile, coins, qty, note)));
        return true;
      }

      case MARKET_SELL_SELECT:
      case MARKET_SELLALL_SELECT: {
        const result =
          base === MARKET_SELL_SELECT
            ? await sellCompound(userId, guildId, value, 1)
            : await sellAllCompound(userId, guildId, value);
        const profile = await getLabProfile(userId, guildId);
        let note = result.ok
          ? `✅ بعت ×${result.sold} مقابل ${jenny(result.earned)}${result.bonus > 0 ? ` (شامل +${Math.round(result.bonus * 100)}% سمعة)` : ""}`
          : "❌ تعذّر البيع.";
        if (result.ok) {
          const lines = await recordEvent(userId, guildId, { type: "sell", coins: result.earned });
          if (lines.length) note += `\n${lines.join("\n")}`;
        }
        await interaction.update(asUpdate(await buildMarketView(guildId, profile, note, Number(extra) || 0)));
        return true;
      }

      case HINT_BUY_SELECT: {
        const page = Number(extra) || 0;
        const res = await buyHint(userId, guildId, value);
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        const messages: Record<string, string> = {
          unknown: "❌ مركب غير معروف.",
          discovered: "❌ اكتشفت هذا المركب بالفعل.",
          no_more: "❌ كشفت كل تلميحاته.",
          coins: "❌ رصيدك ما يكفي لشراء تلميح.",
        };
        const note = res.ok
          ? `💡 تلميح جديد: **${res.clue}** (−${jenny(res.price)}) • باقي ${res.left}`
          : messages[res.reason];
        await interaction.update(asUpdate(buildHintsView(profile, coins, page, note)));
        return true;
      }

      case EQUIP_BUY_SELECT: {
        if (value.startsWith("c_")) {
          const cres = await buyConsumable(userId, guildId, value.slice(2));
          const [cp, cc] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
          const cnote = cres.ok ? `✅ ${cres.label} (−${jenny(cres.spent)})` : "❌ رصيدك ما يكفي.";
          await interaction.update(asUpdate(buildEquipView(cp, cc, cnote)));
          return true;
        }
        const res = await buyEquipment(userId, guildId, value);
        const messages: Record<string, string> = {
          max: "❌ وصلت أعلى مستوى.",
          owned: "❌ تملكها بالفعل.",
          coins: "❌ رصيدك ما يكفي.",
          unknown: "❌ عنصر غير معروف.",
          engram: "❌ لازم تفتحه أول من 🎚️ المستويات.",
        };
        const note = res.ok ? `✅ ${res.label} (−${jenny(res.spent)})` : messages[res.reason];
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildEquipView(profile, coins, note)));
        return true;
      }

      case ORDER_DELIVER_SELECT: {
        const res = await deliverOrder(userId, guildId, value);
        const messages: Record<string, string> = {
          no_order: "❌ هذا مو من طلبات اليوم.",
          done: "❌ سلّمت هذا الطلب بالفعل.",
          stock: "❌ ما عندك الكمية المطلوبة من هذا المركب.",
        };
        const note = res.ok
          ? `✅ تم التسليم! +${jenny(res.coins)} • +${res.xp} XP${res.levelUp ? ` • 🆙 المستوى **${res.level}**` : ""}`
          : messages[res.reason];
        await interaction.update(asUpdate(buildOrdersView(await getLabProfile(userId, guildId), note)));
        return true;
      }

      case ROBOT_START: {
        const res = await startRobot(userId, guildId, value);
        const messages: Record<string, string> = {
          no_robot: "❌ ما تملك الروبوت.",
          busy: "❌ الروبوت مشغول.",
          ingredients: "❌ المكونات ما تكفي لوحدة وحدة على الأقل.",
          invalid: "❌ هذا المركب ما يقدر الروبوت يصنعه.",
        };
        const c = COMPOUND_MAP[value];
        const note = res.ok ? `🤖 بدأ يصنّع ${c?.icon ?? ""} ${c?.name ?? ""} ×${res.qty}` : messages[res.reason];
        await interaction.update(asUpdate(buildRobotView(await getLabProfile(userId, guildId), note)));
        return true;
      }

      case TRADE_PICK: {
        const [targetId = "", priceStr = "0", qtyStr = "1"] = (extra ?? "").split(":");
        const price = Number(priceStr);
        const qty = Number(qtyStr);
        const profile = await getLabProfile(userId, guildId);
        if (!COMPOUND_MAP[value] || (profile.compounds[value] ?? 0) < qty) {
          await interaction.reply({ content: "❌ ما عندك هذي الكمية من المركب.", flags: MessageFlags.Ephemeral });
          return true;
        }
        await interaction.update({ ...buildOffer(userId, targetId, value, price, qty), allowedMentions: { users: [targetId] } });
        return true;
      }

      case LEVELS_UNLOCK_SELECT: {
        const result = await unlockEngram(userId, guildId, value);
        const profile = await getLabProfile(userId, guildId);
        const messages: Record<string, string> = {
          already: "❌ فاتحه بالفعل.",
          points: "❌ نقاط الفتح ما تكفي.",
          level: "❌ مستواك ما يكفي.",
          prereq: "❌ ناقصك متطلبات سابقة.",
          unknown: "❌ غير معروف.",
        };
        const def = ENGRAM_MAP[value];
        const note = result.ok ? `🔓 فتحت ${def?.icon ?? ""} **${result.name}**!` : `${messages[result.reason]}${result.need ? ` (${result.need})` : ""}`;
        await interaction.update(asUpdate(buildLevelsView(profile, note, def?.kind ?? tabOf(extra))));
        return true;
      }
    }
  } catch (err) {
    logger.error("خطأ في قائمة المختبر", err);
    const payload = { content: "❌ صار خطأ، حاول مرة ثانية.", flags: MessageFlags.Ephemeral } as const;
    if (!interaction.replied && !interaction.deferred) await interaction.reply(payload).catch(() => undefined);
    else await interaction.followUp(payload).catch(() => undefined);
    return true;
  }

  return false;
}
