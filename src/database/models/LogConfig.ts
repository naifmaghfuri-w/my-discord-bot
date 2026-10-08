import { Schema, model } from "mongoose";

export interface ILogConfig {
  guildId: string;
  channelId: string;
}

const schema = new Schema<ILogConfig>({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
});

export const LogConfig = model<ILogConfig>("LogConfig", schema);
