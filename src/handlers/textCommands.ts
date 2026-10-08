import {
  ApplicationCommandOptionType,
  ChannelType,
  type ChatInputCommandInteraction,
  type GuildBasedChannel,
  type GuildMember,
  type Message,
  type Role,
  type User,
} from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";
import type { Command } from "../types";
import { logger } from "../utils/logger";

/** أوامر ما يقدر يستعملها غير مالك البوت (غيره يتجاهله البوت بصمت) */
const OWNER_ONLY = new Set(["backup", "leaveserver"]);
const EPHEMERAL_TTL_MS = 15_000;
const EPHEMERAL_FLAG = 1 << 6;

const cooldowns = new Map<string, number>();

// ---------- تحليل الخيارات من النص ----------

interface OptionDef {
  name: string;
  type: number;
  required?: boolean;
  min_value?: number;
  max_value?: number;
  max_length?: number;
  choices?: { name: string; value: string | number }[];
}

type Parsed = Record<string, string | number | boolean>;

const ID = /^\d{17,20}$/;
const BOOL_TRUE = new Set(["true", "yes", "y", "on", "1", "نعم", "ايوه", "أيوه", "اي"]);
const BOOL_FALSE = new Set(["false", "no", "n", "off", "0", "لا"]);
const CHOICE_ALIASES: Record<string, string> = {
  head: "heads", heads: "heads", h: "heads",
  tail: "tails", tails: "tails", t: "tails",
};

function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** يرجع القيمة الخام لو التوكن يناسب نوع الخيار، وإلا undefined */
function accept(opt: OptionDef, token: string): string | number | boolean | undefined {
  const t = normalizeDigits(token);
  switch (opt.type) {
    case ApplicationCommandOptionType.User:
      return /^<@!?(\d+)>$/.exec(t)?.[1] ?? (ID.test(t) ? t : undefined);
    case ApplicationCommandOptionType.Channel:
      return /^<#(\d+)>$/.exec(t)?.[1] ?? (ID.test(t) ? t : undefined);
    case ApplicationCommandOptionType.Role:
      return /^<@&(\d+)>$/.exec(t)?.[1] ?? (ID.test(t) ? t : undefined);
    case ApplicationCommandOptionType.Integer:
      return /^-?\d{1,9}$/.test(t) ? Number(t) : undefined;
    case ApplicationCommandOptionType.Number:
      return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : undefined;
    case ApplicationCommandOptionType.Boolean: {
      const l = t.toLowerCase();
      return BOOL_TRUE.has(l) ? true : BOOL_FALSE.has(l) ? false : undefined;
    }
    case ApplicationCommandOptionType.String: {
      if (!opt.choices) return undefined; // النص الحر يُعالج بشكل منفصل (ياخذ باقي الرسالة)
      const l = t.toLowerCase();
      const hit = opt.choices.find((c) => String(c.value).toLowerCase() === l || c.name.toLowerCase() === l);
      if (hit) return hit.value as string;
      const alias = CHOICE_ALIASES[l];
      return alias && opt.choices.some((c) => c.value === alias) ? alias : undefined;
    }
    default:
      return undefined;
  }
}

function parseArgs(defs: OptionDef[], text: string): Parsed | { error: string } {
  const values: Parsed = {};
  const tokens = text.split(/\s+/).filter(Boolean);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const strict = defs.find((d) => !(d.name in values) && accept(d, token) !== undefined);
    if (strict) {
      values[strict.name] = accept(strict, token)!;
      continue;
    }
    const free = defs.find(
      (d) => !(d.name in values) && d.type === ApplicationCommandOptionType.String && !d.choices,
    );
    if (free) {
      values[free.name] = tokens.slice(i).join(" "); // النص الحر ياخذ كل الباقي
      break;
    }
    return { error: `ما فهمت \`${token}\`` };
  }

  for (const d of defs) {
    const v = values[d.name];
    if (typeof v === "number") {
      if (d.min_value !== undefined && v < d.min_value) return { error: `\`${d.name}\` لازم يكون ${d.min_value} أو أكثر` };
      if (d.max_value !== undefined && v > d.max_value) return { error: `\`${d.name}\` لازم يكون ${d.max_value} أو أقل` };
    }
    if (typeof v === "string" && d.max_length !== undefined && v.length > d.max_length) {
      return { error: `\`${d.name}\` أطول من ${d.max_length} حرف` };
    }
  }
  const missing = defs.find((d) => d.required && !(d.name in values));
  if (missing) return { error: `ناقص: \`${missing.name}\`` };
  return values;
}

const TYPE_HINT: Partial<Record<number, string>> = {
  [ApplicationCommandOptionType.User]: "@شخص",
  [ApplicationCommandOptionType.Channel]: "#قناة",
  [ApplicationCommandOptionType.Role]: "@رتبة",
  [ApplicationCommandOptionType.Integer]: "رقم",
  [ApplicationCommandOptionType.Number]: "رقم",
  [ApplicationCommandOptionType.Boolean]: "true/false",
  [ApplicationCommandOptionType.String]: "نص",
};

function usage(name: string, defs: OptionDef[]): string {
  const parts = defs.map((d) => {
    const hint = d.choices ? d.choices.map((c) => c.value).join("|") : `${d.name}:${TYPE_HINT[d.type] ?? "?"}`;
    return d.required ? `<${hint}>` : `[${hint}]`;
  });
  return `${name} ${parts.join(" ")}`.trim();
}

// ---------- محوّل Message ← Interaction ----------

class OptionsAdapter {
  constructor(
    private values: Parsed,
    private resolved: Record<string, unknown>,
  ) {}
  private get<T>(name: string, required?: boolean): T | null {
    const v = (name in this.resolved ? this.resolved[name] : this.values[name]) as T | undefined;
    if (v === undefined) {
      if (required) throw new Error(`خيار مطلوب ناقص: ${name}`);
      return null;
    }
    return v;
  }
  getString = (n: string, r?: boolean) => this.get<string>(n, r);
  getInteger = (n: string, r?: boolean) => this.get<number>(n, r);
  getNumber = (n: string, r?: boolean) => this.get<number>(n, r);
  getBoolean = (n: string, r?: boolean) => this.get<boolean>(n, r);
  getUser = (n: string, r?: boolean) => this.get<User>(n, r);
  getChannel = (n: string, r?: boolean) => this.get<GuildBasedChannel>(n, r);
  getRole = (n: string, r?: boolean) => this.get<Role>(n, r);
  getMember = (n: string) => this.get<GuildMember>(`${n}:member`);
  getAttachment = () => null;
  getFocused = () => "";
  getSubcommand = () => null;
}

function stripPayload(payload: unknown): { options: Record<string, unknown>; ephemeral: boolean } {
  const base: Record<string, unknown> = typeof payload === "string" ? { content: payload } : { ...(payload as object) };
  const flags = Number(base.flags ?? 0);
  const ephemeral = base.ephemeral === true || (flags & EPHEMERAL_FLAG) !== 0;
  delete base.ephemeral;
  delete base.fetchReply;
  delete base.withResponse;
  if (base.flags !== undefined) {
    const rest = flags & ~EPHEMERAL_FLAG;
    if (rest) base.flags = rest;
    else delete base.flags;
  }
  base.allowedMentions ??= { parse: [] }; // ما نمنشن أحد بدون قصد
  return { options: base, ephemeral };
}

function createInteraction(
  message: Message<true>,
  command: Command,
  values: Parsed,
  resolved: Record<string, unknown>,
): ChatInputCommandInteraction {
  let sent: Message | null = null;
  let deferredEphemeral = false;
  const state = { replied: false, deferred: false };

  const scheduleDelete = (m: Message) => setTimeout(() => m.delete().catch(() => undefined), EPHEMERAL_TTL_MS);

  const send = async (payload: unknown, forceEphemeral = false): Promise<Message> => {
    const { options, ephemeral } = stripPayload(payload);
    const m = await message.channel.send(options as never);
    if (ephemeral || forceEphemeral) scheduleDelete(m);
    return m;
  };

  const fake = {
    commandName: command.data.name,
    client: message.client,
    guild: message.guild,
    guildId: message.guildId,
    channel: message.channel,
    channelId: message.channelId,
    user: message.author,
    member: message.member,
    memberPermissions: message.member?.permissions ?? null,
    createdTimestamp: message.createdTimestamp,
    options: new OptionsAdapter(values, resolved),
    get replied() {
      return state.replied;
    },
    get deferred() {
      return state.deferred;
    },
    inGuild: () => true,
    isChatInputCommand: () => true,
    async deferReply(payload?: unknown) {
      state.deferred = true;
      deferredEphemeral = payload ? stripPayload(payload).ephemeral : false;
      await message.channel.sendTyping().catch(() => undefined);
    },
    async reply(payload: unknown) {
      state.replied = true;
      sent = await send(payload);
      return sent;
    },
    async editReply(payload: unknown) {
      state.replied = true;
      if (!sent) {
        sent = await send(payload, deferredEphemeral);
        return sent;
      }
      const { options } = stripPayload(payload);
      sent = await sent.edit(options as never);
      return sent;
    },
    async followUp(payload: unknown) {
      return send(payload);
    },
    async fetchReply() {
      if (!sent) throw new Error("لا يوجد رد");
      return sent;
    },
    async deleteReply() {
      await sent?.delete().catch(() => undefined);
    },
  };
  return fake as unknown as ChatInputCommandInteraction;
}

// ---------- نقطة الدخول من messageCreate ----------

function hasPermission(message: Message<true>, command: Command): boolean {
  const name = command.data.name;
  const isOwner = !!config.ownerId && message.author.id === config.ownerId;
  if (OWNER_ONLY.has(name)) return isOwner;
  const perms = command.data.toJSON().default_member_permissions;
  if (!perms) return true;
  if (isOwner) return true;
  return !!message.member?.permissions.has(BigInt(perms));
}

async function resolveOptions(
  message: Message<true>,
  defs: OptionDef[],
  values: Parsed,
): Promise<Record<string, unknown> | { error: string }> {
  const resolved: Record<string, unknown> = {};
  for (const d of defs) {
    const raw = values[d.name];
    if (raw === undefined) continue;
    const id = String(raw);
    if (d.type === ApplicationCommandOptionType.User) {
      const user = await message.client.users.fetch(id).catch(() => null);
      if (!user) return { error: "ما لقيت هذا العضو" };
      resolved[d.name] = user;
      const member = await message.guild.members.fetch(id).catch(() => null);
      if (member) resolved[`${d.name}:member`] = member;
    } else if (d.type === ApplicationCommandOptionType.Channel) {
      const ch = await message.guild.channels.fetch(id).catch(() => null);
      if (!ch) return { error: "ما لقيت هذي القناة في هذا السيرفر" };
      resolved[d.name] = ch;
    } else if (d.type === ApplicationCommandOptionType.Role) {
      const role = await message.guild.roles.fetch(id).catch(() => null);
      if (!role) return { error: "ما لقيت هذي الرتبة في هذا السيرفر" };
      resolved[d.name] = role;
    }
  }
  return resolved;
}

function notice(message: Message<true>, content: string, ttl = 10_000): void {
  message.channel
    .send({ content, allowedMentions: { parse: [] } })
    .then((m) => setTimeout(() => m.delete().catch(() => undefined), ttl))
    .catch(() => undefined);
}

/** يحوّل رسالة مثل "ban @شخص سبب" لتنفيذ أمر ban. يرجع true لو الرسالة كانت أمراً (تم التعامل معها) */
export async function handleTextCommand(client: BotClient, message: Message<true>): Promise<boolean> {
  const content = message.content.trim();
  if (!content || content.length > 1500) return false;

  const space = content.search(/\s/);
  const name = (space === -1 ? content : content.slice(0, space)).toLowerCase();
  const command = client.commands.get(name);
  if (!command) return false;

  // من ما عنده صلاحية: نتجاهل بصمت (الكلمة ممكن تكون كلام عادي)
  if (!hasPermission(message, command)) return false;

  const defs = ((command.data.toJSON().options ?? []) as OptionDef[]).filter((o) => o.type > 2);
  const argText = space === -1 ? "" : content.slice(space + 1);

  const parsed = parseArgs(defs, argText);
  if ("error" in parsed) {
    // أمر بلا خيارات مطلوبة ما يفشل، أما غيره فنوضح الصيغة
    notice(message, `❌ ${parsed.error}\nالصيغة: \`${usage(name, defs)}\``);
    return true;
  }

  const resolved = await resolveOptions(message, defs, parsed);
  if ("error" in resolved) {
    notice(message, `❌ ${resolved.error}`);
    return true;
  }

  // كولداون
  const key = `${name}:${message.author.id}`;
  const now = Date.now();
  const expires = cooldowns.get(key);
  if (expires && now < expires) {
    notice(message, `⏳ انتظر ${Math.ceil((expires - now) / 1000)} ثانية قبل استخدام الأمر مرة ثانية.`, 5000);
    return true;
  }
  cooldowns.set(key, now + (command.cooldown ?? 3) * 1000);

  const channelOk = message.channel.type !== ChannelType.DM;
  if (!channelOk) return false;

  const interaction = createInteraction(message, command, parsed, resolved);
  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error(`خطأ في الأمر ${name}`, err);
    notice(message, "❌ حدث خطأ أثناء تنفيذ الأمر.");
  }
  return true;
}
