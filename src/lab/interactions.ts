import { MessageFlags, type ButtonInteraction, type StringSelectMenuInteraction } from "discord.js";
import { jenny } from "../constants";
import { getProfile } from "../services/economy";
import { logger } from "../utils/logger";
import { PRESSURE, TEMP } from "./compounds";
import { ELEMENT_MAP } from "./elements";
import {
  BACK,
  LEVELS_UNLOCK_SELECT,
  MARKET_SELL_SELECT,
  MARKET_SELLALL_SELECT,
  OPEN_CODEX,
  OPEN_LEVELS,
  OPEN_MARKET,
  OPEN_SHOP,
  OPEN_TOP,
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
import {
  addToMix,
  adjustPressure,
  adjustTemp,
  attemptReaction,
  buyElement,
  getLabProfile,
  getSession,
  getTopScientists,
  publishArticle,
  resetSession,
  toggleStep,
  unlockElement,
} from "./service";
import {
  buildArticleEmbed,
  buildCodexView,
  buildLevelsView,
  buildMainPanel,
  buildMarketView,
  buildReactSuccessView,
  buildShopView,
  buildTopView,
  buildWarehouseView,
  backRow,
  type PanelResult,
} from "./views";

const NOT_OWNER = "🔒 هذا مختبر غيرك. اكتب `lab` عشان تفتح مختبرك.";

/** attachments: [] يمسح الصور القديمة، وإلا تتراكم مع كل تحديث */
function asUpdate(panel: PanelResult) {
  return { content: panel.content ?? null, embeds: panel.embeds, components: panel.components, files: panel.files, attachments: [] };
}

async function renderMain(userId: string, guildId: string, note?: string): Promise<PanelResult> {
  const [profile, session] = await Promise.all([getLabProfile(userId, guildId), getSession(userId, guildId)]);
  return buildMainPanel(profile, session, note);
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
    await interaction.reply({ content: NOT_OWNER, flags: MessageFlags.Ephemeral }).catch(() => undefined);
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
        await interaction.update(asUpdate(await renderMain(userId, guildId)));
        return true;

      case OPEN_WAREHOUSE: {
        const [profile, coins] = await Promise.all([getLabProfile(userId, guildId), coinsOf(userId, guildId)]);
        await interaction.update(asUpdate(buildWarehouseView(profile, coins)));
        return true;
      }

      case OPEN_CODEX:
        await interaction.update(asUpdate(buildCodexView(await getLabProfile(userId, guildId))));
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

      case OPEN_LEVELS:
        await interaction.update(asUpdate(buildLevelsView(await getLabProfile(userId, guildId))));
        return true;

      case OPEN_TOP:
        await interaction.update(asUpdate(buildTopView(userId, await getTopScientists(guildId))));
        return true;

      case REACT: {
        const result = await attemptReaction(userId, guildId);

        if (!result.ok) {
          const msg = result.reason === "empty_mix" ? "❌ خليطك فاضي، أضف عناصر أول." : "❌ مكونات الخليط ما تكفي، جرب تصفير الخليط.";
          if (result.reason === "missing") {
            await interaction.update(asUpdate(await renderMain(userId, guildId, msg)));
          } else {
            await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
          }
          return true;
        }

        if (!result.success && result.kind === "near") {
          const note = `🔎 قريب جداً! المكونات صحيحة لكن الظروف غلط:\n${result.hints.join("\n")}\n_(ما انصرف شيء من مكوناتك)_`;
          await interaction.update(asUpdate(await renderMain(userId, guildId, note)));
          return true;
        }

        if (!result.success) {
          await interaction.update(asUpdate(await renderMain(userId, guildId, "💨 ما طابق أي تفاعل معروف. المكونات تبخّرت، جرب تركيبة ثانية!")));
          return true;
        }

        const view = await buildReactSuccessView(
          userId,
          result.compound.id,
          result.discoveredNow,
          result.xpResult.level,
          result.xpResult.leveledUp,
          result.xpResult.tokensGained,
        );
        await interaction.update(asUpdate(view));
        return true;
      }

      case PUBLISH: {
        const result = await publishArticle(userId, guildId, extra ?? "");
        if (!result.ok) {
          await interaction.reply({ content: "❌ تعذّر نشر المقال (ربما نشرته من قبل).", flags: MessageFlags.Ephemeral });
          return true;
        }
        await interaction.update({ components: [backRow(userId)] });
        await interaction.followUp({
          embeds: [buildArticleEmbed(userId, extra ?? "", result.reputation ?? 0, result.total ?? 0)],
          allowedMentions: { parse: [] },
        });
        return true;
      }
    }
  } catch (err) {
    logger.error("خطأ في زر المختبر", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ صار خطأ، حاول مرة ثانية.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    }
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
    await interaction.reply({ content: NOT_OWNER, flags: MessageFlags.Ephemeral }).catch(() => undefined);
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
        const note = result.ok
          ? `✅ اشتريت ${el?.icon} ${el?.name} ×${qty} مقابل ${jenny(result.spent)}`
          : result.reason === "locked"
            ? "❌ هذا العنصر مقفل، افتحه أول من المستويات."
            : "❌ رصيد محفظتك ما يكفي.";
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
        const note = result.ok
          ? `✅ بعت ×${result.sold} مقابل ${jenny(result.earned)}${result.bonus > 0 ? ` (شامل +${Math.round(result.bonus * 100)}% سمعة)` : ""}`
          : "❌ تعذّر البيع.";
        await interaction.update(asUpdate(await buildMarketView(guildId, profile, note)));
        return true;
      }

      case LEVELS_UNLOCK_SELECT: {
        const result = await unlockElement(userId, guildId, value);
        const profile = await getLabProfile(userId, guildId);
        const messages: Record<string, string> = {
          already: "❌ فاتح هذا العنصر بالفعل.",
          tokens: "❌ رموز المختبر ما تكفي.",
          unknown: "❌ عنصر غير معروف.",
        };
        const note = result.ok ? `🔓 فتحت ${ELEMENT_MAP[value]?.icon} ${ELEMENT_MAP[value]?.name}!` : messages[result.reason];
        await interaction.update(asUpdate(buildLevelsView(profile, note)));
        return true;
      }
    }
  } catch (err) {
    logger.error("خطأ في قائمة المختبر", err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ صار خطأ، حاول مرة ثانية.", flags: MessageFlags.Ephemeral }).catch(() => undefined);
    }
    return true;
  }

  return false;
}
