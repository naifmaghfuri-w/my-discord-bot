import { EmbedBuilder } from "discord.js";

/** !العاب → قائمة أوامر الألعاب (نص) */
export const GAMES_TRIGGER = /^!\s*[اأ]لعاب$/;

const COLOR = 0x8b5cf6;

/** عدّل الأسماء هنا لو غيّرت أمر لعبة أو أضفت لعبة جديدة */
const GROUPS: { title: string; icon: string; games: string[] }[] = [
  { title: "الجماعية", icon: "👥", games: ["!كود نايمز", "!سالفة"] },
  { title: "الثنائية", icon: "⚔️", games: ["!اكس-او", "!عملة", "!حجرة"] },
  { title: "الفردية", icon: "👤", games: ["!اسرع"] },
];

export function buildGamesList() {
  const lines: string[] = [];
  for (const g of GROUPS) lines.push(`**${g.icon} ${g.title}**`, ...g.games.map((x) => `\`${x}\``), "");
  lines.push("ℹ️ شرح الألعاب الجماعية يظهر بزر **الشرح** داخل اللعبة.");
  return { embeds: [new EmbedBuilder().setColor(COLOR).setTitle("👥 Games Commands").setDescription(lines.join("\n"))] };
}
