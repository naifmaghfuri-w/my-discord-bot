const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, ActivityType, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 🌐 خادم Express لمعالجة الطلبات والحفاظ على النشاط على Render
app.get('/', (req, res) => res.status(200).send('Bot is online!'));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Web server listening on port ${PORT}`);
    
    setInterval(async () => {
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        if (renderUrl) {
            try {
                if (typeof fetch !== 'undefined') {
                    await fetch(renderUrl);
                } else {
                    require('https').get(renderUrl, () => {});
                }
                console.log('🔄 Keep-alive ping sent.');
            } catch (err) {
                console.error('⚠️ Keep-alive ping failed:', err.message);
            }
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
// 🔄 تحميل وتسجيل أوامر السلاش تلقائياً
// ==========================================
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

function loadCommands(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const files = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dirPath, file.name);

        if (file.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.name.endsWith('.js')) {
            try {
                const command = require(fullPath);

                if (Array.isArray(command.gamesCommands)) {
                    command.gamesCommands.forEach(cmd => {
                        const cmdData = cmd?.data?.toJSON ? cmd.data.toJSON() : (cmd?.toJSON ? cmd.toJSON() : cmd);
                        if (cmdData?.name) {
                            commands.push(cmdData);
                            client.commands.set(cmdData.name, cmd);
                        }
                    });
                } else if (command.data) {
                    const cmdData = command.data.toJSON ? command.data.toJSON() : command.data;
                    if (cmdData?.name) {
                        commands.push(cmdData);
                        client.commands.set(cmdData.name, command);
                    }
                } else if (typeof command === 'object') {
                    Object.values(command).forEach(cmd => {
                        if (cmd?.data?.toJSON) {
                            const cData = cmd.data.toJSON();
                            if (cData?.name) {
                                commands.push(cData);
                                client.commands.set(cData.name, cmd);
                            }
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
let messageCreateHandler, interactionCreateHandler;

try { messageCreateHandler = require('./events/messageCreate'); } catch (e) { console.error('⚠️ تعذر تحميل حدث الرسائل:', e.message); }
try { interactionCreateHandler = require('./events/interactionCreate'); } catch (e) { console.error('⚠️ تعذر تحميل حدث التفاعلات:', e.message); }

client.on('messageCreate', async message => {
    try {
        if (typeof messageCreateHandler === 'function') {
            await messageCreateHandler(client, message);
        } else if (messageCreateHandler?.execute) {
            await messageCreateHandler.execute(client, message);
        }
    } catch (err) {
        console.error('❌ خطأ أثناء معالجة الرسالة:', err);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        if (typeof interactionCreateHandler === 'function') {
            // توجيه التفاعل بصيغة متوافقة (سواء كان يستقبل مرجعين أو مرجع واحد)
            if (interactionCreateHandler.length === 1) {
                await interactionCreateHandler(interaction);
            } else {
                await interactionCreateHandler(client, interaction);
            }
        } else if (interactionCreateHandler?.execute) {
            await interactionCreateHandler.execute(client, interaction);
        }
    } catch (err) {
        console.error('❌ خطأ أثناء معالجة التفاعل:', err);
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
        .then(() => console.log("✅ تم الاتصال بديسكورد بنجاح."))
        .catch(err => console.error('❌ فشل تسجيل الدخول إلى ديسكورد:', err));
}

process.on('unhandledRejection', error => console.error('❌ Unhandled Rejection:', error));
process.on('uncaughtException', error => console.error('❌ Uncaught Exception:', error));
