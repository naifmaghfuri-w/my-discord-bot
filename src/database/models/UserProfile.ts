import { Schema, model } from "mongoose";

export interface IUserProfile {
  userId: string;
  guildId: string;
  coins: number;
  wins: number;
  lastDaily?: Date;
}

const schema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    coins: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    lastDaily: { type: Date },
  },
  { timestamps: true },
);

// ملف واحد لكل عضو في كل سيرفر
schema.index({ userId: 1, guildId: 1 }, { unique: true });
// لسرعة أمر /top
schema.index({ guildId: 1, coins: -1 });

export const UserProfile = model<IUserProfile>("UserProfile", schema);
