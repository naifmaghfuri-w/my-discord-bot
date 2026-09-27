import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type { Command } from "./types";

export class BotClient extends Client {
  public commands = new Collection<string, Command>();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // مميز: لازم يتفعل من Developer Portal (نحتاجه لتغيير الألقاب في نظام AFK)
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // مميز: لازم يتفعل من Developer Portal
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
    });
  }
}
