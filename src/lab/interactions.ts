import { MessageFlags, type ButtonInteraction, type StringSelectMenuInteraction } from "discord.js";
import { jenny } from "../constants";
import { ELEMENT_MAP } from "./elements";
import {
  BACK,
  LEVELS_UNLOCK_SELECT,
  MARKET_SELL_SELECT,
  OPEN_CODEX,
  OPEN_LEVELS,
  OPEN_MARKET,
  OPEN_SHOP,
  PRESSURE_DOWN,
  PRESSURE_UP,
  PUBLISH_PREFIX,
  REACT,
  RESET,
  SELECT_ELEMENT,
  SHOP_BUY_SELECT,
  TEMP_DOWN,
  TEMP_UP,
} from "./ids";
import { sellCompound } from "./market";
import {
  addToMix,
  adjustPressure,
  adjustTemp,
  attemptReaction,
  buyElement,
  getLabProfile,
  getSession,
  publishArticle,
  resetSession,
  unlockElement,
} from "./service";
import { PRESSURE, TEMP } from "./compounds";
import { backRow, buildCodexView, buildLevelsView, buildMainPanel, buildMarketView, buildReactSuccessView, buildShopView } from "./views";
import { logger } from "../utils/logger";

async function renderMain(userId: string, guildId: string) {
  const [profile, session] = await Promise.all([getLabProfile(userId, guildId), getSession(userId, guildId)]);
  return buildMainPanel(profile, session);
}

export async function handleLabButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId || !customId.startsWith("lab_")) return false;
  const userId = interaction.user.id;

  try {
    if (customId === TEMP_UP || customId === TEMP_DOWN) {
      const delta = customId === TEMP_UP ? TEMP.step : -TEMP.step;
      await adjustTemp(userId, guildId, delta, TEMP.min, TEMP.max);
      await interaction.update(await renderMain(userId, guildId));
      return true;
    }

    if (customId === PRESSURE_UP || customId === PRESSURE_DOWN) {
      const delta = customId === PRESSURE_UP ? PRESSURE.step : -PRESSURE.step;
      await adjustPressure(userId, guildId, delta, PRESSURE.min, PRESSURE.max);
      await interaction.update(await renderMain(userId, guildId));
      return true;
    }

    if (customId === RESET) {
      await resetSession(userId, guildId);
      await interaction.update(await renderMain(userId, guildId));
      return true;
    }

    if (customId === BACK) {
      await interaction.update(await renderMain(userId, guildId));
      return true;
    }

    if (customId === OPEN_CODEX) {
      const profile = await getLabProfile(userId, guildId);
      await interaction.update(buildCodexView(profile));
      return true;
    }

    if (customId === OPEN_MARKET) {
      const profile = await getLabProfile(userId, guildId);
      await interaction.update(await buildMarketView(guildId, profile));
      return true;
    }

    if (customId === OPEN_SHOP) {
      const profile = await getLabProfile(userId, guildId);
      await interaction.update(buildShopView(profile));
      return true;
    }

    if (customId === OPEN_LEVELS) {
      const profile = await getLabProfile(userId, guildId);
      await interaction.update(buildLevelsView(profile));
      return true;
    }

    if (customId === REACT) {
      const result = await attemptReaction(userId, guildId);

      if (!result.ok) {
        await interaction.reply({ content: "❌ خليطك فاضي، أضف عناصر أول.", flags: MessageFlags.Ephemeral });
        return true;
      }

      if (!result.success) {
        await interaction.update({
          content: "💨 ما طابق أي تفاعل معروف. المكونات تبخّرت، جرب تركيبة ثانية!",
          embeds: [],
          components: (await renderMain(userId, guildId)).components,
          files: [],
        });
        return true;
      }

      const view = buildReactSuccessView(
        result.compound.id,
        result.discoveredNow,
        result.xpResult.level,
        result.xpResult.leveledUp,
        result.xpResult.tokensGained,
      );
      await interaction.update({ content: null, embeds: view.embeds, components: view.components, files: [] });
      return true;
    }

    if (customId.startsWith(PUBLISH_PREFIX)) {
      const compoundId = customId.slice(PUBLISH_PREFIX.length);
      const result = await publishArticle(userId, guildId, compoundId);
      if (!result.ok) {
        await interaction.reply({ content: "❌ تعذّر نشر المقال.", flags: MessageFlags.Ephemeral });
        return true;
      }
      await interaction.update({ components: [backRow()] });
      await interaction.followUp({
        content: `📰 نشر <@${userId}> مقالاً علمياً! +${result.reputation} سمعة ✨`,
        allowedMentions: { parse: [] },
      });
      return true;
    }
  } catch (err) {
    logger.error("خطأ في زر المختبر", err);
  }

  return false;
}

export async function handleLabSelect(interaction: StringSelectMenuInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId || !customId.startsWith("lab_")) return false;
  const userId = interaction.user.id;
  const value = interaction.values[0];

  try {
    if (customId === SELECT_ELEMENT) {
      await addToMix(userId, guildId, value);
      await interaction.update(await renderMain(userId, guildId));
      return true;
    }

    if (customId === SHOP_BUY_SELECT) {
      const result = await buyElement(userId, guildId, value, 1);
      const profile = await getLabProfile(userId, guildId);
      if (!result.ok) {
        const messages: Record<string, string> = {
          locked: "❌ هذا العنصر مقفل، افتحه أول من المستويات.",
          insufficient: "❌ رصيد محفظتك ما يكفي.",
        };
        await interaction.update({ ...buildShopView(profile), content: messages[result.reason] });
        return true;
      }
      await interaction.update({ ...buildShopView(profile), content: `✅ اشتريت ${ELEMENT_MAP[value]?.icon} ${ELEMENT_MAP[value]?.name}!` });
      return true;
    }

    if (customId === MARKET_SELL_SELECT) {
      const result = await sellCompound(userId, guildId, value, 1);
      const profile = await getLabProfile(userId, guildId);
      if (!result.ok) {
        await interaction.update({ ...(await buildMarketView(guildId, profile)), content: "❌ تعذّر البيع." });
        return true;
      }
      await interaction.update({ ...(await buildMarketView(guildId, profile)), content: `✅ بعت مقابل ${jenny(result.earned)}!` });
      return true;
    }

    if (customId === LEVELS_UNLOCK_SELECT) {
      const result = await unlockElement(userId, guildId, value);
      const profile = await getLabProfile(userId, guildId);
      if (!result.ok) {
        const messages: Record<string, string> = {
          already: "❌ فاتح هذا العنصر بالفعل.",
          tokens: "❌ رموز المختبر ما تكفي.",
          unknown: "❌ عنصر غير معروف.",
        };
        await interaction.update({ ...buildLevelsView(profile), content: messages[result.reason] });
        return true;
      }
      await interaction.update({ ...buildLevelsView(profile), content: `🔓 فتحت ${ELEMENT_MAP[value]?.icon} ${ELEMENT_MAP[value]?.name}!` });
      return true;
    }
  } catch (err) {
    logger.error("خطأ في قائمة المختبر", err);
  }

  return false;
}
