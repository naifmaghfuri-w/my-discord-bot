import { Events, type Channel } from "discord.js";
import type { BotClient } from "../client";
import { ChatRoom } from "../database/models/ChatRoom";
import { isRoomChannel, loadRoomCache } from "../chat/service";
import { Ticket } from "../database/models/Ticket";
import { isTicketChannel, loadTicketCache } from "../tickets/service";
import type { BotEvent } from "../types";

/** لو انحذفت قناة دردشة خاصة (يدوياً أو من الإدارة) ننظف سجلها ونحذف الصوتي المرتبط */
const event: BotEvent = {
  name: Events.ChannelDelete,
  async execute(client: BotClient, channel: Channel) {
    if (!("guild" in channel)) return;

    if (isTicketChannel(channel.id)) {
      await Ticket.updateOne({ channelId: channel.id }, { $set: { status: "closed", closedAt: new Date() } });
      await loadTicketCache();
      return;
    }

    if (isRoomChannel(channel.id)) {
      const room = await ChatRoom.findOneAndDelete({ channelId: channel.id });
      if (room?.voiceChannelId) await channel.guild.channels.delete(room.voiceChannelId, "الدردشة انحذفت").catch(() => undefined);
      await loadRoomCache();
      return;
    }

    // لو انحذف الصوتي فقط
    await ChatRoom.updateOne({ voiceChannelId: channel.id }, { $set: { voiceChannelId: null } });
  },
};

export default event;
