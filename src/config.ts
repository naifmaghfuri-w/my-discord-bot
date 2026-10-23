import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`متغير البيئة ${name} غير موجود في ملف .env`);
  return value;
}

/** يحوّل قائمة IDs مفصولة بفاصلة إلى مصفوفة */
const parseIds = (v?: string): string[] =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  guildId: process.env.GUILD_ID || undefined,
  /** Render يمرر المنفذ تلقائياً عبر PORT */
  port: process.env.PORT ? Number(process.env.PORT) : undefined,
  /** قاعة الانجازات: كل بطاقات إكمال المهام تنزل هنا فقط */
  /** قناة السجلات: رابط تعريفي بس في آخر رسالة الإنجاز (Hall of Deeds & Decrees)، مو مكان النشر الفعلي */
  recordsChannelId: process.env.RECORDS_CHANNEL_ID || "1551185659354419200",
  /** قناة العد (رقم صحيح = ☑️، رقم غلط = يُمسح) ومنها مهمة "عد في قناة العد" */
  countingChannelId: process.env.COUNTING_CHANNEL_ID || "1551168908545761310",
  /** المنطقة الزمنية لتجديد المهام اليومية عند منتصف الليل */
  timezone: process.env.TIMEZONE || "Asia/Riyadh",
  /** معرفك أنت (المالك): يُستخدم لتقييد أوامر حساسة مثل /leaveserver */
  ownerId: process.env.OWNER_ID || undefined,
  /** رتبة "عيد ميلاد" تُعطى تلقائياً 24 ساعة (اختياري، بدونها ميزة الرتبة التلقائية معطّلة) */
  birthdayRoleId: process.env.BIRTHDAY_ROLE_ID || undefined,
  /** قناة الاحتفال بعيد الميلاد (اختياري، بدونها ما فيه إعلان علني) */
  birthdayChannelId: process.env.BIRTHDAY_CHANNEL_ID || undefined,
  /** بانر اختياري يظهر في بطاقة تهنئة عيد الميلاد */
  birthdayBannerUrl: process.env.BIRTHDAY_BANNER_URL || undefined,
  /**
   * رتب تحديد الجنس (لنظام العائلة: تبني، زواج، مواريث اللقب).
   * تدعم عدة سيرفرات: MALE_ROLE_ID_1 و MALE_ROLE_ID_2 (وكذلك FEMALE_ROLE_ID_1 و FEMALE_ROLE_ID_2).
   * ويمكن أيضاً وضع عدة IDs مفصولة بفاصلة في MALE_ROLE_ID / FEMALE_ROLE_ID.
   */
  maleRoleIds: parseIds(
    [process.env.MALE_ROLE_ID, process.env.MALE_ROLE_ID_1, process.env.MALE_ROLE_ID_2].filter(Boolean).join(","),
  ),
  femaleRoleIds: parseIds(
    [process.env.FEMALE_ROLE_ID, process.env.FEMALE_ROLE_ID_1, process.env.FEMALE_ROLE_ID_2].filter(Boolean).join(","),
  ),
  /** صورة بانر لوحات الدردشة الخاصة (اختياري، ويمكن تحديدها من أمر !لوحة دردشة) */
  chatBannerUrl: process.env.CHAT_BANNER_URL || undefined,
  /** قناة سجلات الإدارة الافتراضية (يمكن تغييرها لكل سيرفر بأمر /setlog) */
  logChannelId: process.env.LOG_CHANNEL_ID || undefined,
  /** قناة النسخ الاحتياطي التلقائي لقاعدة البيانات (بدونها يُرسل للمالك بالخاص إن وُجد OWNER_ID) */
  backupChannelId: process.env.BACKUP_CHANNEL_ID || undefined,
  /** getter: لا يُطلب إلا عند تشغيل البوت (أمر deploy لا يحتاجه) */
  get mongoUri(): string {
    return required("MONGODB_URI");
  },
};
