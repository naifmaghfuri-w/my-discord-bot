const express = require('express');
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 🌐 خادم Express لمعالجة الطلبات والحفاظ على النشاط
app.get('/', (req, res) => res.send('Bot is online!'));

app.listen(port, () => {
    console.log(`🌐 Web server listening on port ${port}`);
    
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

// ==========================================
// 🔄 تحميل وتسجيل أوامر السلاش تلقائياً
// ==========================================
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if (Array.isArray(command)) {
            command.forEach(cmd => commands.push(cmd.data.toJSON()));
        } else if (command.data) {
            commands.push(command.data.toJSON());
        }
    }
}

// إضافة أوامر الملفات الخارجية الأخرى
const { gamesCommands } = require('./games');
const labCommand = require('./lab');
const { profileCommand, shopCommand } = require('./profileSystem');

if (gamesCommands) gamesCommands.forEach(cmd => commands.push(cmd));
if (labCommand?.data) commands.push(labCommand.data);
if (profileCommand?.data) commands.push(profileCommand.data);
if (shopCommand?.data) commands.push(shopCommand.data);

// ==========================================
// 📡 ربط الأحداث (Events)
// ==========================================
const messageCreateHandler = require('./events/messageCreate');
const interactionCreateHandler = require('./events/interactionCreate');

client.on('messageCreate', message => messageCreateHandler(client, message));
client.on('interactionCreate', interaction => interactionCreateHandler(client, interaction));

client.once('ready', async () => {
    console.log(`🚀 تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);
    const token = process.env.DISCORD_TOKEN || process.env.TOKEN;
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل جميع الأوامر المائلة بنجاح!');
    } catch (err) {
        console.error('❌ خطأ في تسجيل الأوامر:', err);
    }
});

// ==========================================
// 🔐 تسجيل الدخول ومعالجة الأخطاء
// ==========================================
const token = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!token) {
    console.error('❌ خطأ: لم يتم العثور على DISCORD_TOKEN في متغيرات البيئة!');
} else {
    client.login(token)
        .then(() => console.log("✅ تم إرسال التوكين بنجاح."))
        .catch(err => console.error('❌ فشل تسجيل الدخول إلى ديسكورد:', err));
}

process.on('unhandledRejection', error => console.error('❌ Unhandled Rejection:', error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error));
