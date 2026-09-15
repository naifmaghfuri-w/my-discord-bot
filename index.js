const express = require('express');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
const port = process.env.PORT || 3000;

// 🌐 خادم Express لمعالجة الطلبات والحفاظ على النشاط
app.get('/', (req, res) => res.send('Bot is online!'));

app.listen(port, () => {
    console.log(`🌐 Web server listening on port ${port}`);
    
    // Ping تلقائي للخدمة كل 5 دقائق
    setInterval(() => {
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        if (renderUrl) {
            fetch(renderUrl)
                .then(() => console.log('🔄 Keep-alive ping sent.'))
                .catch(err => console.error('⚠️ Keep-alive ping failed:', err.message));
        }
    }, 5 * 60 * 1000);
});

// 🤖 إعداد ديسكورد
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// استدعاء الموديلات والأحداث
require('./handlers/eventHandler')(client);

// تشغيل البوت
const token = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!token) {
    console.error('❌ خطأ: لم يتم العثور على DISCORD_TOKEN!');
} else {
    client.login(token)
        .then(() => console.log("✅ تم تسجيل الدخول بنجاح."))
        .catch(err => console.error('❌ فشل تسجيل الدخول:', err));
}

// معالجة الأخطاء الشاملة
process.on('unhandledRejection', error => console.error('❌ Unhandled Rejection:', error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error));
