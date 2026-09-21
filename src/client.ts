import { Client, Collection, GatewayIntentBits } from "discord.js";
import type { Command } from "./types";

export class BotClient extends Client {
  public commands = new Collection<string, Command>();

  constructor() {
    super({ intents: [GatewayIntentBits.Guilds] });
  }
}
