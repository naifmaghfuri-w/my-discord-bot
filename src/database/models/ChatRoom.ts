import { Schema, model } from "mongoose";

export interface IChatRoom {
  guildId: string;
  channelId: string;
  voiceChannelId: string | null;
  ownerId: string;
  /** الأعضاء المضافون (بدون المالك) */
  members: string[];
  /** الباب مغلق: ما يظهر في "طرق الباب" */
  closed: boolean;
  panelMessageId: string | null;
  lastActivityAt: Date;
  createdAt: Date;
}

const schema = new Schema<IChatRoom>(
  {
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true, unique: true },
    voiceChannelId: { type: String, default: null },
    ownerId: { type: String, required: true },
    members: { type: [String], default: [] },
    closed: { type: Boolean, default: false },
    panelMessageId: { type: String, default: null },
    lastActivityAt: { type: Date, default: () => new Date(), index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

schema.index({ guildId: 1, ownerId: 1 });

export const ChatRoom = model<IChatRoom>("ChatRoom", schema);
