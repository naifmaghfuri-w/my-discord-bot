import { Schema, model } from "mongoose";

export interface ITicketConfig {
  guildId: string;
  categoryId: string;
  supportRoleId: string;
  bannerUrl: string | null;
  /** عدّاد أرقام التذاكر */
  counter: number;
}

const schema = new Schema<ITicketConfig>({
  guildId: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true },
  supportRoleId: { type: String, required: true },
  bannerUrl: { type: String, default: null },
  counter: { type: Number, default: 0 },
});

export const TicketConfig = model<ITicketConfig>("TicketConfig", schema);
