import { MessageFlags, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { getGuild } from "./guild";

/**
 * يجلب العضو المستهدف (خيار "user") ويتحقق من الرتب.
 * لو فيه مشكلة يرد على المستخدم برسالة خاصة ويرجع null.
 */
export async function getModeratableTarget(
  interaction: ChatInputCommandInteraction,
): Promise<GuildMember | null> {
  const guild = getGuild(interaction);
  const user = interaction.options.getUser("user", true);

  const fail = async (msg: string) => {
    await interaction.reply({ content: `❌ ${msg}`, flags: MessageFlags.Ephemeral });
    return null;
  };

  const target = await guild.members.fetch(user.id).catch(() => null);
  if (!target) return fail("العضو غير موجود في السيرفر.");
  if (target.id === interaction.user.id) return fail("لا يمكنك تنفيذ هذا على نفسك.");
  if (target.id === guild.ownerId) return fail("لا يمكن تنفيذ هذا على مالك السيرفر.");

  const moderator = await guild.members.fetch(interaction.user.id);
  const me = guild.members.me ?? (await guild.members.fetchMe());

  if (interaction.user.id !== guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
    return fail("رتبة هذا العضو أعلى من رتبتك أو مساوية لها.");
  }
  if (target.roles.highest.position >= me.roles.highest.position) {
    return fail("رتبة هذا العضو أعلى من رتبة البوت. ارفع رتبة البوت من إعدادات السيرفر.");
  }
  return target;
}
