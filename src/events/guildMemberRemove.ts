import { EmbedBuilder, Events, type GuildMember, type PartialGuildMember } from "discord.js";
import type { BotClient } from "../client";
import { LOG_COLORS, sendLog } from "../logs/logger";
import type { BotEvent } from "../types";

const event: BotEvent = {
  name: Events.GuildMemberRemove,
  async execute(_client: BotClient, member: GuildMember | PartialGuildMember) {
    const joined = member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "غير معروف";
    await sendLog(
      member.guild,
      new EmbedBuilder()
        .setColor(LOG_COLORS.leave)
        .setTitle("📤 عضو غادر")
        .setThumbnail(member.user.displayAvatarURL())
        .setDescription(`<@${member.id}> (${member.user.tag})\n**انضم:** ${joined}\n**عدد الأعضاء الآن:** ${member.guild.memberCount}`),
    );
  },
};

export default event;
