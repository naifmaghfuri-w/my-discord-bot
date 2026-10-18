import { CommandToggle } from "../database/models/CommandToggle";

/** الأوامر الإدارية اللي تنتحكم فيها من "!إعدادات المسؤول" (الاسم = الكلمة بعد "!") */
export const ADMIN_COMMANDS = ["تحذير", "تحذيرات", "ميوت", "نو ميوت", "بان", "نو بان", "طرد", "حذف"] as const;
export type AdminCommand = (typeof ADMIN_COMMANDS)[number];

const cache = new Map<string, Set<string>>();

async function load(guildId: string): Promise<Set<string>> {
  const hit = cache.get(guildId);
  if (hit) return hit;
  const doc = await CommandToggle.findOne({ guildId }).lean().catch(() => null);
  const set = new Set<string>(doc?.disabled ?? []);
  cache.set(guildId, set);
  return set;
}

export async function isCommandDisabled(guildId: string, command: string): Promise<boolean> {
  return (await load(guildId)).has(command);
}

export async function getDisabled(guildId: string): Promise<Set<string>> {
  return new Set(await load(guildId));
}

/** يعكس حالة الأمر. يرجع true لو صار موقوفاً */
export async function toggleCommand(guildId: string, command: string): Promise<boolean> {
  const set = await load(guildId);
  const nowDisabled = !set.has(command);
  if (nowDisabled) set.add(command);
  else set.delete(command);
  await CommandToggle.updateOne({ guildId }, { $set: { disabled: [...set] } }, { upsert: true });
  return nowDisabled;
}
