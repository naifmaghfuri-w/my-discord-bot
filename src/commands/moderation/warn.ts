import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { logModAction } from "../../logs/logger";
import type { Command } from "../../types";
import { Warning } from "../../database/models/Warning";
import { getGuild } from "../../utils/guild";
import { getModeratableTarget } from "../../utils/moderation";

/** كل 3 تحذيرات = كتم تلقائي ساعة (عدّل الرقمين حسب رغبتك) */
const AUTO_TIMEOUT = { threshold: 3, minutes: 60 } as const;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("تحذير عضو (يُحفظ في قاعدة البيانات)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setContexts(InteractionContextType.Guild)
    .addUserOption((o) => o.setName("user").setDescription("العضو").setRequired(true))
    .addStringOption((o) => o.setName("reason").setDescription("السبب").setRequired(true).setMaxLength(200)),

  async execute(interaction) {
    const target = await getModeratableTarget(interaction);
    if (!target) return;

    const guild = getGuild(interaction);
    const reason = interaction.options.getString("reason", true);

    await Warning.create({
      guildId: guild.id,
      userId: target.id,
      moderatorId: interaction.user.id,
      reason,
    });
    const total = await Warning.countDocuments({ guildId: guild.id, userId: target.id });

    let extra = "";
    if (total % AUTO_TIMEOUT.threshold === 0) {
      await target.timeout(AUTO_TIMEOUT.minutes * 60_000, `تحذيرات متكررة (${total})`).catch(() => undefined);
      extra = `\n🔇 وصل لـ ${AUTO_TIMEOUT.threshold} تحذيرات، تم كتمه تلقائياً ${AUTO_TIMEOUT.minutes} دقيقة.`;
    }

    await interaction.reply(`⚠️ تم تحذير ${target} (إجمالي التحذيرات: **${total}**)\nالسبب: ${reason}${extra}`);
    await logModAction(interaction, "تحذير", target.user, { reason, extra: `**إجمالي التحذيرات:** ${total}${extra ? "\n🔇 كتم تلقائي" : ""}` });
  },
};

export default command;
