import { Schema, model } from "mongoose";

/** تخصيص بطاقة !ملفي (صورة الخلفية واللون) لكل عضو */
export interface IProfileStyle {
  guildId: string;
  userId: string;
  /** صورة الخلفية اللي رفعها العضو (JPEG مصغّر) */
  bgImage?: Buffer | null;
  color: string;
}

const schema = new Schema<IProfileStyle>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  bgImage: { type: Buffer, default: null },
  color: { type: String, default: "sky" },
});
schema.index({ guildId: 1, userId: 1 }, { unique: true });

export const ProfileStyle = model<IProfileStyle>("ProfileStyle", schema);
