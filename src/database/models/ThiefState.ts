import { Schema, model } from "mongoose";

/** آخر وقت لكل نوع سرقة (لكل نوع مهلة مستقلة) */
export interface IThiefState {
  guildId: string;
  userId: string;
  member: Date | null;
  company: Date | null;
  shop: Date | null;
}

const thiefSchema = new Schema<IThiefState>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  member: { type: Date, default: null },
  company: { type: Date, default: null },
  shop: { type: Date, default: null },
});
thiefSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const ThiefState = model<IThiefState>("ThiefState", thiefSchema);
