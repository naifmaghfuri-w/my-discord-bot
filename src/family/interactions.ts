import { MessageFlags, type ButtonInteraction } from "discord.js";
import { CURRENCY, jenny } from "../constants";
import { adopt, marry } from "./service";
import { ADOPT_ACCEPT_PREFIX, ADOPT_DECLINE_PREFIX, MARRY_ACCEPT_PREFIX, MARRY_DECLINE_PREFIX } from "./ids";
import { logger } from "../utils/logger";

const REASON_TEXT: Record<string, string> = {
  self: "❌ ما تقدر تسوي هذا مع نفسك.",
  proposer_married: "❌ الطرف المقترح صار متزوج بالفعل.",
  target_married: "❌ صرت متزوج بالفعل قبل ما توافق.",
  insufficient_dowry: "❌ ما عاد يملك المهر الكافي.",
  already_parent: "❌ أنت والده بالفعل.",
  child_has_two_parents: "❌ عنده والدان مسجّلان بالفعل.",
  not_stepparent: "❌ لازم تكون متزوج من والده الحالي عشان تصير الوالد الثاني.",
};

export async function handleFamilyButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId } = interaction;
  if (!guildId) return false;

  if (customId.startsWith(MARRY_ACCEPT_PREFIX) || customId.startsWith(MARRY_DECLINE_PREFIX)) {
    const isAccept = customId.startsWith(MARRY_ACCEPT_PREFIX);
    const rest = customId.slice((isAccept ? MARRY_ACCEPT_PREFIX : MARRY_DECLINE_PREFIX).length);
    const [fromId, toId, dowryStr] = rest.split("_");
    const dowry = Number(dowryStr);

    if (interaction.user.id !== toId) {
      await interaction.reply({ content: "🔒 هذا الطلب موجّه لشخص ثاني.", flags: MessageFlags.Ephemeral });
      return true;
    }

    if (!isAccept) {
      await interaction.update({ content: `💔 <@${toId}> رفض عرض الزواج من <@${fromId}>.`, embeds: [], components: [] });
      return true;
    }

    const result = await marry(fromId, toId, guildId, dowry).catch((err) => {
      logger.error("فشل تنفيذ الزواج", err);
      return { ok: false as const, reason: "insufficient_dowry" as const };
    });

    if (!result.ok) {
      await interaction.update({
        content: REASON_TEXT[result.reason] ?? "❌ تعذّر إتمام الزواج.",
        embeds: [],
        components: [],
      });
      return true;
    }

    await interaction.update({
      content: `💍 مبروك! <@${fromId}> و<@${toId}> صاروا زوجين (مهر: ${jenny(dowry)}) ${CURRENCY.emoji}`,
      embeds: [],
      components: [],
    });
    return true;
  }

  if (customId.startsWith(ADOPT_ACCEPT_PREFIX) || customId.startsWith(ADOPT_DECLINE_PREFIX)) {
    const isAccept = customId.startsWith(ADOPT_ACCEPT_PREFIX);
    const rest = customId.slice((isAccept ? ADOPT_ACCEPT_PREFIX : ADOPT_DECLINE_PREFIX).length);
    const [parentId, childId] = rest.split("_");

    if (interaction.user.id !== childId) {
      await interaction.reply({ content: "🔒 هذا الطلب موجّه لشخص ثاني.", flags: MessageFlags.Ephemeral });
      return true;
    }

    if (!isAccept) {
      await interaction.update({ content: `❌ <@${childId}> رفض عرض التبني من <@${parentId}>.`, embeds: [], components: [] });
      return true;
    }

    const result = await adopt(parentId, childId, guildId).catch((err) => {
      logger.error("فشل تنفيذ التبني", err);
      return { ok: false as const, reason: "child_has_two_parents" as const };
    });

    if (!result.ok) {
      await interaction.update({
        content: REASON_TEXT[result.reason] ?? "❌ تعذّر إتمام التبني.",
        embeds: [],
        components: [],
      });
      return true;
    }

    await interaction.update({ content: `👶 تم! <@${parentId}> صار والد/والدة <@${childId}>.`, embeds: [], components: [] });
    return true;
  }

  return false;
}
