import { EmbedBuilder, Events, type GuildMember } from "discord.js";
import type { BotClient } from "../client";
import { LOG_COLORS, sendLog } from "../logs/logger";
import type { BotEvent } from "../types";

const event: BotEvent = {
  name: Events.GuildMemberAdd,
  async execute(_client: BotClient, member: GuildMember) {
    const created = Math.floor(member.user.createdTimestamp / 1000);
    await sendLog(
      member.guild,
      new EmbedBuilder()
        .setColor(LOG_COLORS.join)
        .setTitle("📥 عضو جديد")
        .setThumbnail(member.user.displayAvatarURL())
        .setDescription(`<@${member.id}> (${member.user.tag})\n**الحساب أُنشئ:** <t:${created}:R>\n**عدد الأعضاء الآن:** ${member.guild.memberCount}`),
    );
  },
};

export default event;
