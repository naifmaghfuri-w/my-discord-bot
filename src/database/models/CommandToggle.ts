import { Schema, model } from "mongoose";

/** الأوامر الإدارية الموقوفة لكل سيرفر */
export interface ICommandToggle {
  guildId: string;
  disabled: string[];
}

const schema = new Schema<ICommandToggle>({
  guildId: { type: String, required: true, unique: true },
  disabled: { type: [String], default: [] },
});

export const CommandToggle = model<ICommandToggle>("CommandToggle", schema);
