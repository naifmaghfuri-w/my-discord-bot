# Discord Bot (TypeScript + discord.js v14 + MongoDB)

## الأوامر
| الفئة | الأوامر |
|---|---|
| عام | `/ping` |
| إدارة | `/kick` `/ban` `/timeout` `/clear` `/warn` `/warnings` |
| اقتصاد | `/balance` `/daily` `/top` |
| ألعاب | `/coinflip` `/rps` `/xo` |
| مهام | `/quests` |

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

## المهام اليومية
10 مهام تتجدد كل يوم عند منتصف الليل (حسب `TIMEZONE`)، مكافآتها Jenny + XP، ومكافأة إضافية لإكمال الكل.
كل التعديلات (المبالغ، النصوص، العبارات) في `src/quests/definitions.ts`.

**مهم قبل التشغيل:** فعّل **Message Content Intent** من Discord Developer Portal ← Bot ← Privileged Gateway Intents،
وإلا يرفض ديسكورد تسجيل دخول البوت.

متغيرات اختيارية: `QUESTS_CHANNEL_ID` (قاعة الانجازات) و `COUNTING_CHANNEL_ID` (قناة العد).
صلاحيات البوت المطلوبة: View Channels, Send Messages, Embed Links, Read Message History, Use External Emojis.

## بطاقات إنجاز المهام (صور)
كل إنجاز مهمة يُرسل مع صورة بطاقة (920×260) فيها العنوان والوصف وأيقونة المهمة وشارتا Jenny وXP، بنفس فكرة
"اكتملت بنجاح". التوليد بالكامل بالكود (`src/quests/render/`)، بدون أي خدمة خارجية.

**قبل التشغيل، لازم تضيف خطاً عربياً** (الصور بدونه ما تُرسل، ويسجّل البوت تحذيراً فقط):
1. حمّل خط **Cairo** من https://fonts.google.com/specimen/Cairo (مجاني)
2. أعد تسمية `Cairo-Bold.ttf` إلى `Bold.ttf` و `Cairo-Regular.ttf` إلى `Regular.ttf`
3. ضعهما داخل `src/assets/fonts/`

**قبل الرفع لـ Render، جرّب البطاقات على جهازك:**
```
npm install
npm run cards:preview
```
يولّد 11 صورة (10 مهام + بطاقة المكافأة الكبرى) داخل مجلد `preview/`. افتحها وتأكد الخط العربي يظهر صحيحاً
قبل ما تنشر. ما قدرت أختبر شكل النص بنفسي (بيئة التطوير عندي ما فيها خط عربي ولا إنترنت)، فلو طلعت الحروف
متقطعة أو بشكل غلط، ابعت لي صورة وأضبطها.

لتغيير الألوان أو رسمة أي أيقونة: `src/quests/render/icons.ts`. لتعديل تخطيط البطاقة (الأحجام، الخط، الشارات):
`src/quests/render/card.ts`.
