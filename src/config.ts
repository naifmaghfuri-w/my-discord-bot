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
  /** قاعة الانجازات: كل بطاقات إكمال المهام تنزل هنا فقط */
  questsChannelId: process.env.QUESTS_CHANNEL_ID || "1550924300939436062",
  /** قناة السجلات: رابط تعريفي بس في آخر رسالة الإنجاز (Hall of Deeds & Decrees)، مو مكان النشر الفعلي */
  recordsChannelId: process.env.RECORDS_CHANNEL_ID || "1551185659354419200",
  /** قناة العد لمهمة "عد في قناة العد" (اختياري) */
  countingChannelId: process.env.COUNTING_CHANNEL_ID || "1551168908545761310",
  /** المنطقة الزمنية لتجديد المهام اليومية عند منتصف الليل */
  timezone: process.env.TIMEZONE || "Asia/Riyadh",
  /** معرفك أنت (المالك): يُستخدم لتقييد أوامر حساسة مثل /leaveserver */
  ownerId: process.env.OWNER_ID || undefined,
  /** getter: لا يُطلب إلا عند تشغيل البوت (أمر deploy لا يحتاجه) */
  get mongoUri(): string {
    return required("MONGODB_URI");
  },
};
