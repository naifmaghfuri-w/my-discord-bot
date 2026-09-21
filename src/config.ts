import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`متغير البيئة ${name} غير موجود في ملف .env`);
  return value;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  guildId: process.env.GUILD_ID || undefined,
  /** Render يمرر المنفذ تلقائياً عبر PORT */
  port: process.env.PORT ? Number(process.env.PORT) : undefined,
  /** getter: لا يُطلب إلا عند تشغيل البوت (أمر deploy لا يحتاجه) */
  get mongoUri(): string {
    return required("MONGODB_URI");
  },
};
