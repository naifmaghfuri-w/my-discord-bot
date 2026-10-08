import { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, type ButtonInteraction } from "discord.js";
import { CURRENCY, jenny } from "../constants";
import { getGender } from "./gender";
import {
  ADOPT_ACCEPT_PREFIX,
  ADOPT_DECLINE_PREFIX,
  MARRY_ACCEPT_PREFIX,
  MARRY_DECLINE_PREFIX,
  MARRY_FATHER_ACCEPT_PREFIX,
  MARRY_FATHER_DECLINE_PREFIX,
} from "./ids";
import { adopt, getParents, marry } from "./service";
import { logger } from "../utils/logger";

const MARRY_REASON_TEXT: Record<string, string> = {
  self: "❌ ما تقدر تتزوج نفسك.",
  gender_unknown: "❌ ما قدرت أتأكد من جنس أحد الطرفين (محتاج رتبة ذكر/أنثى).",
  same_gender: "❌ الزواج لازم يكون بين ذكر وأنثى.",
  proposer_full: "❌ الطرف المرسل وصل للحد الأقصى من الزوجات/الأزواج.",
  target_full: "❌ الطرف الثاني وصل للحد الأقصى من الزوجات/الأزواج.",
  already_married_each_other: "❌ أنتما متزوجان من بعض بالفعل.",
  insufficient_dowry: "❌ ما عاد يملك المهر الكافي.",
};

const ADOPT_REASON_TEXT: Record<string, string> = {
  self: "❌ ما تقدر تسوي هذا مع نفسك.",
  gender_unknown: "❌ ما قدرت أتأكد من جنسك (محتاج رتبة ذكر/أنثى).",
  already_parent: "❌ أنت والده بالفعل.",
  same_gender_parent: "❌ عنده والد من نفس جنسك مسجّل بالفعل.",
  child_has_two_parents: "❌ عنده والدان مسجّلان بالفعل.",
  not_stepparent: "❌ لازم تكون متزوج من والده الحالي عشان تصير الوالد الثاني.",
};

/** يلاقي أب الشخص (الوالد اللي عنده رتبة ذكر) إن وجد، يحتاج Guild عشان يفحص الرتب */
async function findFather(childId: string, guild: NonNullable<ButtonInteraction["guild"]>): Promise<string | null> {
  const parents = await getParents(childId, guild.id);
  for (const parent of parents) {
    const member = await guild.members.fetch(parent.userId).catch(() => null);
    if (member && getGender(member) === "male") return parent.userId;
  }
  return null;
}

async function finalizeMarriage(interaction: ButtonInteraction, fromId: string, toId: string, dowry: number): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const [fromMember, toMember] = await Promise.all([
    guild.members.fetch(fromId).catch(() => null),
    guild.members.fetch(toId).catch(() => null),
  ]);
  const fromGender = fromMember ? getGender(fromMember) : null;
  const toGender = toMember ? getGender(toMember) : null;

  const result = await marry(fromId, toId, guild.id, dowry, fromGender, toGender).catch((err) => {
    logger.error("فشل تنفيذ الزواج", err);
    return { ok: false as const, reason: "insufficient_dowry" as const };
  });

  if (!result.ok) {
    await interaction.update({ content: MARRY_REASON_TEXT[result.reason] ?? "❌ تعذّر إتمام الزواج.", embeds: [], components: [] });
    return;
  }

  await interaction.update({
    content: `💍 مبروك! <@${fromId}> و<@${toId}> صاروا زوجين (${dowry > 0 ? `مهر: ${jenny(dowry)} ${CURRENCY.emoji}` : "بدون مهر"})`,
    embeds: [],
    components: [],
  });
}

export async function handleFamilyButton(interaction: ButtonInteraction): Promise<boolean> {
  const { customId, guildId, guild } = interaction;
  if (!guildId || !guild) return false;

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

    // نحدد مين البنت بين الطرفين (لو فيه) ونشوف إذا عندها أب مسجّل
    const [fromMember, toMember] = await Promise.all([
      guild.members.fetch(fromId).catch(() => null),
      guild.members.fetch(toId).catch(() => null),
    ]);
    const fromGender = fromMember ? getGender(fromMember) : null;
    const toGender = toMember ? getGender(toMember) : null;
    const femaleId = fromGender === "female" ? fromId : toGender === "female" ? toId : null;

    const fatherId = femaleId ? await findFather(femaleId, guild) : null;

    if (!fatherId) {
      await finalizeMarriage(interaction, fromId, toId, dowry);
      return true;
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${MARRY_FATHER_ACCEPT_PREFIX}${fromId}_${toId}_${dowry}_${fatherId}`)
        .setLabel("أوافق")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${MARRY_FATHER_DECLINE_PREFIX}${fromId}_${toId}_${dowry}_${fatherId}`)
        .setLabel("أرفض")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.update({
      content: `✅ <@${toId}> وافقت. بقي موافقة والدها <@${fatherId}> لإتمام الزواج من <@${fromId}>.`,
      embeds: [],
      components: [row],
    });
    return true;
  }

  if (customId.startsWith(MARRY_FATHER_ACCEPT_PREFIX) || customId.startsWith(MARRY_FATHER_DECLINE_PREFIX)) {
    const isAccept = customId.startsWith(MARRY_FATHER_ACCEPT_PREFIX);
    const rest = customId.slice((isAccept ? MARRY_FATHER_ACCEPT_PREFIX : MARRY_FATHER_DECLINE_PREFIX).length);
    const [fromId, toId, dowryStr, fatherId] = rest.split("_");
    const dowry = Number(dowryStr);

    if (interaction.user.id !== fatherId) {
      await interaction.reply({ content: "🔒 هذا القرار بيد والدها بس.", flags: MessageFlags.Ephemeral });
      return true;
    }

    if (!isAccept) {
      await interaction.update({ content: `🚫 والدها <@${fatherId}> رفض الزواج بين <@${fromId}> و<@${toId}>.`, embeds: [], components: [] });
      return true;
    }

    await finalizeMarriage(interaction, fromId, toId, dowry);
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

    const parentMember = await guild.members.fetch(parentId).catch(() => null);
    const parentGender = parentMember ? getGender(parentMember) : null;

    const existingParents = await getParents(childId, guildId);
    const existingGenders = await Promise.all(
      existingParents.map(async (p) => {
        const m = await guild.members.fetch(p.userId).catch(() => null);
        return m ? getGender(m) : null;
      }),
    );

    const result = await adopt(parentId, childId, guildId, parentGender, existingGenders).catch((err) => {
      logger.error("فشل تنفيذ التبني", err);
      return { ok: false as const, reason: "child_has_two_parents" as const };
    });

    if (!result.ok) {
      await interaction.update({ content: ADOPT_REASON_TEXT[result.reason] ?? "❌ تعذّر إتمام التبني.", embeds: [], components: [] });
      return true;
    }

    const label = parentGender === "female" ? "والدة" : "والد";
    await interaction.update({ content: `👶 تم! <@${parentId}> صار ${label} <@${childId}>.`, embeds: [], components: [] });
    return true;
  }

  return false;
}
