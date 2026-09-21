# Discord Bot (TypeScript + discord.js v14 + MongoDB)

## الأوامر
| الفئة | الأوامر |
|---|---|
| عام | `/ping` |
| إدارة | `/kick` `/ban` `/timeout` `/clear` `/warn` `/warnings` |
| اقتصاد | `/balance` `/daily` `/top` |
| ألعاب | `/coinflip` `/rps` `/xo` |

## التشغيل محلياً
1. `npm install`
2. انسخ `.env.example` إلى `.env` واملأ القيم
3. `npm run deploy` ← ينشر الأوامر (كل ما تضيف/تعدل أمر)
4. `npm run dev`

## قاعدة البيانات (MongoDB Atlas المجاني)
1. أنشئ حساباً على mongodb.com/atlas ثم Cluster مجاني (M0)
2. Database Access ← أنشئ مستخدماً بكلمة مرور
3. Network Access ← أضف `0.0.0.0/0` (Render ما عنده IP ثابت في الخطة المجانية)
4. Connect ← Drivers ← انسخ الرابط `mongodb+srv://...` وضعه في `MONGODB_URI`

## النشر على Render
1. ارفع المشروع على GitHub (تأكد أن `.env` غير مرفوع)
2. Render ← New ← Blueprint ← اختر المستودع (يقرأ `render.yaml`)
3. أدخل `DISCORD_TOKEN` و `CLIENT_ID` و `MONGODB_URI`
4. شغّل `npm run deploy` من جهازك مرة واحدة لنشر الأوامر

### مهم: النوم على الخطة المجانية
خدمات الويب المجانية تتوقف بعد ~15 دقيقة بدون طلبات HTTP، وهذا يقطع البوت.
- **حل دائم:** خدمة Background Worker مدفوعة (غيّر في `render.yaml`)
- **حل مجاني غير مضمون:** خدمة مراقبة خارجية (UptimeRobot مثلاً) ترسل طلباً كل 5 دقائق لرابط الخدمة
- لا تستخدم SQLite على Render المجاني: القرص مؤقت ويُمسح مع كل نشر

## إضافة أمر جديد
أنشئ ملفاً داخل `src/commands/<فئة>/اسم.ts` وصدّر `export default command`، ثم `npm run deploy`.
