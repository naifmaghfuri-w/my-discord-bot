import type { GuildMember } from "discord.js";
import { config } from "../config";

export type Gender = "male" | "female" | null;

/** يحدد الجنس حسب رتبة العضو (MALE_ROLE_ID_1/2 و FEMALE_ROLE_ID_1/2 بالإعدادات، تدعم عدة سيرفرات) */
export function getGender(member: GuildMember): Gender {
  if (config.femaleRoleIds.some((id) => member.roles.cache.has(id))) return "female";
  if (config.maleRoleIds.some((id) => member.roles.cache.has(id))) return "male";
  return null;
}

export function genderLabel(gender: Gender, forms: { male: string; female: string; unknown: string }): string {
  if (gender === "male") return forms.male;
  if (gender === "female") return forms.female;
  return forms.unknown;
}
