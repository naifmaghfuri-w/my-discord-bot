import { Schema, model } from "mongoose";

export interface IGuildDailyStats {
  guildId: string;
  dateKey: string;
  messageCount: number;
  activeUserIds: string[];
  createdAt: Date;
}

const schema = new Schema<IGuildDailyStats>(
  {
    guildId: { type: String, required: true },
    dateKey: { type: String, required: true },
    messageCount: { type: Number, default: 0 },
    activeUserIds: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ guildId: 1, dateKey: 1 }, { unique: true });
schema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export const GuildDailyStats = model<IGuildDailyStats>("GuildDailyStats", schema);
