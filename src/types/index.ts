import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { BotClient } from "../client";

export interface Command {
  data: {
    name: string;
    toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  /** مدة الانتظار بالثواني بين كل استخدام (الافتراضي 3) */
  cooldown?: number;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  /** اقتراحات تلقائية لخيار فيه setAutocomplete(true) */
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute(client: BotClient, ...args: any[]): Promise<void> | void;
}
