// index.js
const { gamesCommands, handleGamesCommand } = require('./games');
const labCommand = require('./lab'); // استدعاء مباشر لملف lab.js من المجلد الرئيسي
const { colorCommandData, sendColorMenu, handleColorSelect } = require('./commands/colorMenu');

const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits 
} = require('discord.js');
const express = require('express');

// ==========================================
// 1. سيرفر Express لإبقاء البوت حياً على Render
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running'));

// ==========================================
// 2. إعداد البوت
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // التلقي المباشر للرسائل النصية
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// 3. تجميع وتسجيل الأوامر المائلة (Slash Commands)
// ==========================================
const commands = [
    ...(gamesCommands || []),
    labCommand.data, // إضافة أمر /lab المأخوذ من lab.js
    colorCommandData, // إضافة أمر /colors الخاص بالألوان
    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('حظر عضو من السيرفر')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString())
        .addUserOption(option => option.setName('العضو').setDescription('اختر العضو المراد حظره').setRequired(true))
        .addStringOption(option => option.setName('السبب').setDescription('سبب الحظر').setRequired(false)),
    new SlashCommandBuilder()
        .setName('kick')
        .setDescription('طرد عضو من السيرفر')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString())
        .addUserOption(option => option.setName('العضو').setDescription('اختر العضو المراد طرده').setRequired(true))
        .addStringOption(option => option.setName('السبب').setDescription('سبب الطرد').setRequired(false)),
    new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('إسكات عضو لفترة محددة (تايم أوت)')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
        .addUserOption(option => option.setName('العضو').setDescription('اختر العضو').setRequired(true))
        .addIntegerOption(option => option.setName('الدقائق').setDescription('مدة الإسكات بالدقائق').setRequired(true))
        .addStringOption(option => option.setName('السبب').setDescription('سبب التايم أوت').setRequired(false)),
    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('حذف مجموعة من الرسائل')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString())
        .addIntegerOption(option => 
            option.setName('amount')
                .setDescription('عدد الرسائل المراد حذفها من 1 الى 100')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option => 
            option.setName('target')
                .setDescription('منشن الشخص المراد حذف رسائله فقط')
                .setRequired(false)
        )
];

client.once('ready', async () => {
    console.log(`🚀 تم تسجيل الدخول باسم: ${client.user.tag}`);
    const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل جميع الأوامر المائلة بنجاح!');
    } catch (err) {
        console.error('❌ خطأ في تسجيل الأوامر:', err);
    }
});

// ==========================================
// 4. معالجة الرسائل العادية (بدون /)
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();
    
    // تشغيل لعبة المختبر عند كتابة "lab" أو "the lab" أو "مختبر"
    if (content === 'lab' || content === 'the lab' || content === 'مختبر') {
        try {
            await labCommand.execute(message);
        } catch (error) {
            console.error('❌ خطأ أثناء تشغيل أمر lab النصي:', error);
        }
    }

    // أمر نصي عادي لإرسال قائمة الألوان !colors
    if (content === '!colors' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await sendColorMenu(message.channel);
        await message.delete().catch(() => {});
    }
});

// ==========================================
// 5. معالجة التفاعلات (Slash Commands & Menus)
// ==========================================
client.on('interactionCreate', async interaction => {
    // معالجة اختيار الألوان من القائمة
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_name_color') {
        await handleColorSelect(interaction);
        return;
    }

    // أمر /lab
    if (interaction.isChatInputCommand() && interaction.commandName === 'lab') {
        try {
            await labCommand.execute(interaction);
        } catch (error) {
            console.error('❌ خطأ أثناء تشغيل /lab:', error);
        }
        return;
    }

    // أمر /colors المائل
    if (interaction.isChatInputCommand() && interaction.commandName === 'colors') {
        await sendColorMenu(interaction);
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    // أمر /العاب
    if (interaction.commandName === 'العاب') {
        await handleGamesCommand(interaction);
    }

    // أمر /clear
    if (interaction.commandName === 'clear') {
        const allowedRoleIds = ['1434264100556247040'];
        const hasRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));

        if (!hasRole) {
            return interaction.reply({ 
                content: 'عذراً، لا تملك الرتبة المحددة لاستخدام هذا الأمر.', 
                ephemeral: true 
            });
        }

        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('target');

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let messagesToDelete = Array.from(messages.values());

        if (targetUser) {
            messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
        }

        messagesToDelete = messagesToDelete.slice(0, amount);

        if (messagesToDelete.length === 0) {
            return interaction.reply({ content: 'لم يتم العثور على رسائل لحذفها.', ephemeral: true });
        }

        await interaction.channel.bulkDelete(messagesToDelete, true)
            .then(deleted => {
                interaction.reply({ content: `تم حذف ${deleted.size} رسالة بنجاح.`, ephemeral: true });
            })
            .catch(err => {
                console.error(err);
                interaction.reply({ content: 'حدث خطأ أثناء الحذف (قد تكون الرسائل أقدم من 14 يوماً).', ephemeral: true });
            });
    }

    // أمر /ban
    if (interaction.commandName === 'ban') {
        const user = interaction.options.getUser('العضو');
        const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', ephemeral: true });
        if (!member.bannable) return interaction.reply({ content: '❌ لا أملك صلاحيات لحظر هذا العضو!', ephemeral: true });

        await member.ban({ reason });
        await interaction.reply({ content: `🔨 تم حظر ${user.tag} بنجاح!\n**السبب:** ${reason}` });
    }

    // أمر /kick
    if (interaction.commandName === 'kick') {
        const user = interaction.options.getUser('العضو');
        const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', ephemeral: true });
        if (!member.kickable) return interaction.reply({ content: '❌ لا أملك صلاحيات لطرد هذا العضو!', ephemeral: true });

        await member.kick(reason);
        await interaction.reply({ content: `👞 تم طرد ${user.tag} بنجاح!\n**السبب:** ${reason}` });
    }

    // أمر /timeout
    if (interaction.commandName === 'timeout') {
        const user = interaction.options.getUser('العضو');
        const minutes = interaction.options.getInteger('الدقائق');
        const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', ephemeral: true });
        if (!member.moderatable) return interaction.reply({ content: '❌ لا أملك صلاحيات لإعطاء تايم أوت لهذا العضو!', ephemeral: true });

        const durationMs = minutes * 60 * 1000;
        await member.timeout(durationMs, reason);
        await interaction.reply({ content: `🔇 تم إعطاء تايم أوت لـ ${user.tag} لمدة **${minutes}** دقيقة.\n**السبب:** ${reason}` });
    }
});

// ==========================================
// 5. تشغيل البوت
// ==========================================
const token = process.env.TOKEN || "MTU0NDk2ODYwNzcxNTI5OTQwOA.GpjGOM.JitSinFN661-N30N5WnlbkIRsxeHFwBg8SEQEI";
client.login(token);
