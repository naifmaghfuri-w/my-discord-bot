import type { GuildMember } from "discord.js";
import { config } from "../config";

export type Gender = "male" | "female" | null;

/** يحدد الجنس حسب رتبة العضو (MALE_ROLE_ID / FEMALE_ROLE_ID بالإعدادات) */
export function getGender(member: GuildMember): Gender {
  if (config.femaleRoleId && member.roles.cache.has(config.femaleRoleId)) return "female";
  if (config.maleRoleId && member.roles.cache.has(config.maleRoleId)) return "male";
  return null;
}

export function genderLabel(gender: Gender, forms: { male: string; female: string; unknown: string }): string {
  if (gender === "male") return forms.male;
  if (gender === "female") return forms.female;
  return forms.unknown;
}
