import { Schema, model } from "mongoose";

/** أخوة بالطلب (!اخ / !اخت) بدون أب مشترك. يخزن الزوج مرتّبًا (aId < bId) */
export interface ISibling {
  guildId: string;
  aId: string;
  bId: string;
  createdAt: Date;
}

const siblingSchema = new Schema<ISibling>({
  guildId: { type: String, required: true },
  aId: { type: String, required: true },
  bId: { type: String, required: true },
  createdAt: { type: Date, default: () => new Date() },
});
siblingSchema.index({ guildId: 1, aId: 1, bId: 1 }, { unique: true });
siblingSchema.index({ guildId: 1, bId: 1 });

export const Sibling = model<ISibling>("Sibling", siblingSchema);
