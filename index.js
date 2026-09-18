const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 🌐 خادم Express لمعالجة الطلبات والحفاظ على النشاط على Render
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
            command.forEach(cmd => {
                if (cmd.data?.toJSON) commands.push(cmd.data.toJSON());
                else if (cmd.toJSON) commands.push(cmd.toJSON());
            });
        } else if (command.data) {
            commands.push(command.data.toJSON ? command.data.toJSON() : command.data);
        }
    }
}

// إضافة أوامر الملفات الخارجية من داخل مجلد commands
const { gamesCommands } = require('./commands/games');
const { profileCommand, shopCommand } = require('./commands/profileSystem');

if (gamesCommands) gamesCommands.forEach(cmd => commands.push(cmd));
if (profileCommand?.data) commands.push(profileCommand.data.toJSON ? profileCommand.data.toJSON() : profileCommand.data);
if (shopCommand?.data) commands.push(shopCommand.data.toJSON ? shopCommand.data.toJSON() : shopCommand.data);

// ==========================================
// 📡 ربط الأحداث (Events)
// ==========================================
const messageCreateHandler = require('./events/messageCreate');
const interactionCreateHandler = require('./events/interactionCreate');

client.on('messageCreate', message => messageCreateHandler(client, message));
client.on('interactionCreate', interaction => interactionCreateHandler(client, interaction));

client.once('ready', async () => {
    console.log(`🚀 تم تسجيل الدخول بنجاح باسم: ${client.user.tag}`);

    client.user.setPresence({
        activities: [
            {
                name: 'custom',
                state: 'gg/SR',
                type: ActivityType.Custom,
            },
        ],
        status: 'online',
    });

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
