import { AttachmentBuilder, type Guild, type Message, type Role } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger";
import { PALETTE } from "./palette";

/** "!لون" لعرض اللوحة، "!لون 25" لاختيار لون، "!لون ازالة" لإزالته */
export const COLOR_TRIGGER = /^!\s*لون(?:\s+(\S+))?$/;

const FILE = "colors.png";
const ROLE_RE = /^لون \d+$/;
const DIRS = [
  path.join(process.cwd(), "src", "assets"),
  path.join(process.cwd(), "assets"),
  path.join(__dirname, "..", "assets"),
  path.join(__dirname, "..", "..", "src", "assets"),
];

function findPalette(): string | null {
  for (const dir of DIRS) {
    const full = path.join(dir, FILE);
    if (fs.existsSync(full)) return full;
  }
  return null;
}

const pending = new Map<string, Promise<Role>>();

/** يرجّع رتبة اللون (ينشئها أول مرة بس) */
async function getColorRole(guild: Guild, n: number): Promise<Role> {
  const name = `لون ${n}`;
  const existing = guild.roles.cache.find((r) => r.name === name);
  if (existing) return existing;

  const key = `${guild.id}:${n}`;
  let p = pending.get(key);
  if (!p) {
    p = guild.roles
      .create({ name, color: PALETTE[n - 1], permissions: [], mentionable: false, reason: "رتبة لون" })
      .finally(() => pending.delete(key));
    pending.set(key, p);
  }
  return p;
}

async function showPalette(message: Message<true>): Promise<void> {
  const file = findPalette();
  if (!file) {
    await message.reply({ content: "❌ صورة لوحة الألوان غير موجودة.", allowedMentions: { repliedUser: false } }).catch(() => undefined);
    return;
  }
  await message
    .reply({
      content: "✥ لـ اختيار اي لون اكتب الامر التالي:\n`!لون رقم اللون`\nولإزالة لونك: `!لون ازالة`",
      files: [new AttachmentBuilder(file, { name: FILE })],
      allowedMentions: { repliedUser: false },
    })
    .catch(() => undefined);
}

export async function handleColorMessage(message: Message<true>): Promise<boolean> {
  const m = COLOR_TRIGGER.exec(message.content.trim());
  if (!m) return false;

  const arg = m[1]?.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!arg) {
    await showPalette(message);
    return true;
  }

  const reply = (content: string) =>
    message.reply({ content, allowedMentions: { repliedUser: false } }).catch(() => undefined);

  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return true;

  const remove = /^(ازالة|إزالة|ازاله|حذف|0)$/.test(arg);
  const n = Number(arg);
  if (!remove && !(Number.isInteger(n) && n >= 1 && n <= PALETTE.length)) {
    await reply(`❌ اختر رقم من 1 إلى ${PALETTE.length}. اكتب \`!لون\` لعرض اللوحة.`);
    return true;
  }

  try {
    const old = member.roles.cache.filter((r) => ROLE_RE.test(r.name));
    if (remove) {
      if (old.size === 0) {
        await reply("❌ ما عندك لون.");
        return true;
      }
      await member.roles.remove(old, "إزالة اللون");
      await reply("✅ تمت إزالة لونك.");
      return true;
    }

    const role = await getColorRole(message.guild, n);
    const toRemove = old.filter((r) => r.id !== role.id);
    if (toRemove.size > 0) await member.roles.remove(toRemove, "تغيير اللون");
    if (!member.roles.cache.has(role.id)) await member.roles.add(role, "اختيار لون");
    await reply(`✅ تم تغيير لونك إلى **${n}**.`);
  } catch (err) {
    logger.error("فشل تغيير اللون", err);
    await reply("❌ ما قدرت أغيّر اللون. تأكد أن البوت عنده صلاحية إدارة الرتب ورتبته أعلى من رتب الألوان.");
  }
  return true;
}
