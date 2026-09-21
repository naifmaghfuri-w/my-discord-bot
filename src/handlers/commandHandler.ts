import { join } from "node:path";
import type { BotClient } from "../client";
import type { Command } from "../types";
import { walk } from "../utils/files";
import { logger } from "../utils/logger";

/** يقرأ كل الأوامر من مجلد commands (يُستخدم في التشغيل وفي النشر) */
export async function loadCommandModules(): Promise<Command[]> {
  const commands: Command[] = [];

  for (const file of walk(join(__dirname, "..", "commands"))) {
    const command: Command | undefined = (await import(file)).default;
    if (!command?.data || !command?.execute) {
      logger.warn(`تم تجاهل الملف (ينقصه data أو execute): ${file}`);
      continue;
    }
    commands.push(command);
  }
  return commands;
}

export async function loadCommands(client: BotClient): Promise<void> {
  const commands = await loadCommandModules();
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
  logger.info(`تم تحميل ${commands.length} أمر`);
}
