const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, ActivityType, Collection } = require('discord.js');
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

client.commands = new Collection();

// ==========================================
// 🔄 تحميل وتسجيل أوامر السلاش تلقائياً (بما فيها المجلدات الفرعية)
// ==========================================
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

function loadCommands(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dirPath, file.name);

        // إذا كان المجلد فرعياً (مثل commands/lab)، اقرأ ما دافخله
        if (file.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.name.endsWith('.js')) {
            try {
                const command = require(fullPath);

                if (Array.isArray(command.gamesCommands)) {
                    command.gamesCommands.forEach(cmd => {
                        if (cmd?.toJSON) commands.push(cmd.toJSON());
                        else if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
                    });
                } else if (command.data) {
                    const cmdData = command.data.toJSON ? command.data.toJSON() : command.data;
                    commands.push(cmdData);
                    if (cmdData.name) client.commands.set(cmdData.name, command);
                } else if (typeof command === 'object') {
                    Object.values(command).forEach(cmd => {
                        if (cmd?.data?.toJSON) {
                            const cData = cmd.data.toJSON();
                            commands.push(cData);
                            if (cData.name) client.commands.set(cData.name, cmd);
                        }
                    });
                }
            } catch (err) {
                console.error(`⚠️ تعذر تحميل الملف ${file.name}:`, err.message);
            }
        }
    }
}

loadCommands(commandsPath);

// ==========================================
// 📡 ربط الأحداث (Events)
// ==========================================
const messageCreateHandler = require('./events/messageCreate');
const interactionCreateHandler = require('./events/interactionCreate');

// التأكد من دعم كلاً من صيغة الموديول التصديري كـ function أو كـ object بـ execute
client.on('messageCreate', message => {
    if (typeof messageCreateHandler === 'function') {
        messageCreateHandler(client, message);
    } else if (messageCreateHandler?.execute) {
        messageCreateHandler.execute(client, message);
    }
});

client.on('interactionCreate', interaction => {
    if (typeof interactionCreateHandler === 'function') {
        interactionCreateHandler(client, interaction);
    } else if (interactionCreateHandler?.execute) {
        interactionCreateHandler.execute(client, interaction);
    }
});

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
        console.log(`✅ تم تسجيل (${commands.length}) أمر مائل بنجاح!`);
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
