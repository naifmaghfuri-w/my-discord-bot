import { Schema, model } from "mongoose";

/** تخصيص بطاقة !ملفي (الخلفية واللون) لكل عضو */
export interface IProfileStyle {
  guildId: string;
  userId: string;
  bg: string;
  color: string;
}

const schema = new Schema<IProfileStyle>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  bg: { type: String, default: "midnight" },
  color: { type: String, default: "sky" },
});
schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const ProfileStyle = model<IProfileStyle>("ProfileStyle", schema);
