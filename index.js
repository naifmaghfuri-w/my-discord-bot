const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is online!'));
app.listen(port, () => console.log(`Web server listening on port ${port}`));

require('dotenv').config();
const { gamesCommands, handleGamesCommand } = require('./games');
const labCommand = require('./lab');
const { profileCommand, shopCommand, handleProfileEvents } = require('./profileSystem');

const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags
} = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// ==========================================
// 🤖 إعداد الذكاء الاصطناعي (Google Gemini)
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "مارش" تتحدثين في سيرفر ديسكورد كإنسان طبيعي بلهجة عامية السورية ومختصرة.

قواعد التفاعل الذكي:
1. **تحليل الجنس تلقائياً**: حليلي اسم العرض الخاص بالمستخدم (Display Name) والزخارف المرافقة له (مثل وجود اسم أنثوي "Valentine/إيما / سارة"، أو ألقاب أنثوية مثل "هيلدا /Valentine/ عيدالحب/ اسيل/Aseel").
   - إذا كان الاسم يدل على أنثى: خاطبيها بصيغة المؤنث فوريًا (مثال: "هلا إيما، وش فيك ساكته؟ ").
   - إذا كان الاسم يدل على مذكر أو غير واضح: خاطبه بصيغة المذكر (مثال: "هلا أحمد، وش فيك ساكت؟ اسمائي اولاد زي ساي و sae و فلورد و ماجد").
2. **  شخصية العضو**: ذكيه تفهم وبأسلوب عفوي وطبيعي وبدون تكلف.
3. **الإيموجيات**: استخدمي إيموجيات تعبيرية مناسبة للسياق جداً (مثل: <:emoji_35:1548377823100674058>,<:emoji_37:1548377953942110348>,1549131519648604303 ,<:emoji_38:1548378007339794472>, <:emoji_33:1548343801683378176>,<:emoji_39:1548378179566174348>,<:emoji_36:1548377886917001338>, <:emoji_34:1548377780100796646> ).
4. **الاختصار**: اجعلي الردود قصيرة ومباشرة كأنك عضوة حقيقية تفاعلية داخل السيرفر.`
});

// ==========================================
// 🎨 إعدادات نظام الألوان للسيرفرات المتعددة
// ==========================================
const COLOR_ROLES = {
    '1398466078346317914': { 
        'red': '1547536586487365683',
        'blue': 'ID_رتبة_الأزرق_سيرفر_1',
        'green': 'ID_رتبة_الأخضر_سيرفر_1',
        'yellow': 'ID_رتبة_الأصفر_سيرفر_1',
        'purple': 'ID_رتبة_البنفسجي_سيرفر_1',
        'grey': 'ID_رتبة_الرمادي_سيرفر_1',
        'black': 'ID_رتبة_الأسود_سيرفر_1'
    },
    '1519745057505153186': { 
        'red': 'ID_رتبة_الأحمر_سيرفر_2',
        'blue': 'ID_رتبة_الأزرق_سيرفر_2',
        'green': 'ID_رتبة_الأخضر_سيرفر_2',
        'yellow': 'ID_رتبة_الأصفر_سيرفر_2',
        'purple': 'ID_رتبة_البنفسجي_سيرفر_2',
        'grey': 'ID_رتبة_الرمادي_سيرفر_2',
        'black': 'ID_رتبة_الأسود_سيرفر_2'
    }
};

const colorCommandData = new SlashCommandBuilder()
    .setName('colors')
    .setDescription('إرسال قائمة اختيار لون الاسم (للإدارة)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator.toString());

async function sendColorMenu(target) {
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🎨 قائمة تخصيص لون الاسم')
        .setDescription('اختر اللون الذي تفضله من القائمة أدناه لتغيير لون اسمك في السيرفر!\n\n*(يمكنك إزالة اللون بالضغط على إزالة اللون)*');

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_name_color')
        .setPlaceholder('🎨 اضغط هنا لاختيار لون اسمك...')
        .addOptions([
            new StringSelectMenuOptionBuilder().setLabel('أحمر 🔴').setValue('red'),
            new StringSelectMenuOptionBuilder().setLabel('أزرق 🔵').setValue('blue'),
            new StringSelectMenuOptionBuilder().setLabel('أخضر 🟢').setValue('green'),
            new StringSelectMenuOptionBuilder().setLabel('أصفر 🟡').setValue('yellow'),
            new StringSelectMenuOptionBuilder().setLabel('بنفسجي 🟣').setValue('purple'),
            new StringSelectMenuOptionBuilder().setLabel('رمادي 🩶').setValue('grey'),
            new StringSelectMenuOptionBuilder().setLabel('أسود 🖤').setValue('black'),
            new StringSelectMenuOptionBuilder().setLabel('إزالة اللون الحالي ⚪').setValue('remove_color')
        ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    if (target.send) {
        await target.send({ embeds: [embed], components: [row] });
    } else if (target.reply) {
        await target.reply({ embeds: [embed], components: [row] });
    }
}

async function handleColorSelect(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'select_name_color') return;

    const guildId = interaction.guildId;
    const serverColors = COLOR_ROLES[guildId];

    if (!serverColors) {
        return interaction.reply({ 
            content: '⚠️ هذا السيرفر غير مسجل في إعدادات الألوان للبوت!', 
            flags: MessageFlags.Ephemeral 
        });
    }

    const selectedValue = interaction.values[0];
    const member = interaction.member;
    const allColorRoleIds = Object.values(serverColors);

    try {
        await member.roles.remove(allColorRoleIds.filter(id => id && !id.startsWith('ID_')));

        if (selectedValue === 'remove_color') {
            return interaction.reply({ 
                content: '✅ تم إزالة لون الاسم وتعيين اللون الافتراضي بنجاح.', 
                flags: MessageFlags.Ephemeral 
            });
        }

        const targetRoleId = serverColors[selectedValue];
        if (targetRoleId && !targetRoleId.startsWith('ID_')) {
            await member.roles.add(targetRoleId);
            return interaction.reply({ 
                content: '🎉 تم تغيير لون اسمك بنجاح!', 
                flags: MessageFlags.Ephemeral 
            });
        } else {
            return interaction.reply({ 
                content: '⚠️ لم يتم وضع ID الرتبة الخاص بهذا اللون في الكود بعد!', 
                flags: MessageFlags.Ephemeral 
            });
        }
    } catch (error) {
        console.error('حدث خطأ أثناء تغيير رتبة اللون:', error);
        return interaction.reply({ 
            content: '❌ حدث خطأ، تأكد من أن رتبة البوت أعلى من رتب الألوان في إعدادات السيرفر.', 
            flags: MessageFlags.Ephemeral 
        });
    }
}

// ==========================================
// 1. إعداد البوت
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// 2. تسجيل الأوامر
// ==========================================
const commands = [
    ...(gamesCommands || []),
    labCommand.data,
    colorCommandData,
    profileCommand.data,
    shopCommand.data,
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
// 3. معالجة الرسائل النصية الشات
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();
    
    // تشغيل البروفايل نصياً
    if (content === 'بروفايل' || content === 'بروفايلي' || content === 'profile') {
        try {
            await profileCommand.executeText(message);
            return;
        } catch (error) {
            console.error('❌ خطأ أثناء تشغيل أمر البروفايل النصي:', error);
        }
    }

    if (content === 'lab' || content === 'the lab' || content === 'مختبر') {
        try {
            await labCommand.handleLabSession(message, message.author);
            return;
        } catch (error) {
            console.error('❌ خطأ أثناء تشغيل أمر lab النصي:', error);
        }
    }

    if (content === 'العاب' || content === 'ألعاب' || content === 'games') {
        try {
            await handleGamesCommand(message);
            return;
        } catch (error) {
            console.error('❌ خطأ أثناء تشغيل أمر الألعاب النصي:', error);
        }
    }

    if (content === '!colors' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await sendColorMenu(message.channel);
        await message.delete().catch(() => {});
        return;
    }

    // ==========================================
    // 🤖 نظام الذكاء الاصطناعي (مارش)
    // ==========================================
    const isMentioned = message.mentions.has(client.user);
    const isDots = content === '..' || content === '...';
    const isCalledByName = content.includes('مارش') || content.includes('marsh');

    if (isMentioned || isDots || isCalledByName) {
        try {
            await message.channel.sendTyping();

            const userDisplayName = message.member?.displayName || message.author.username;
            const userPrompt = `اسم العرض (Display Name) للطرف الآخر: "${userDisplayName}". الرسالة التي كتبها: "${message.content}"`;

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            const reply = response.text();

            await message.reply(reply.slice(0, 2000));
        } catch (error) {
            console.error('❌ خطأ في الاستجابة الذكية من Gemini:', error);
        }
    }
});

// ==========================================
// 4. معالجة التفاعلات (أوامر السلاش والمكونات)
// ==========================================
client.on('interactionCreate', async interaction => {
    // معالجة تفاعلات متجر ومستودع البروفايل أولاً
    if (interaction.isStringSelectMenu()) {
        const handled = await handleProfileEvents(interaction);
        if (handled) return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'select_name_color') {
        await handleColorSelect(interaction);
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'profile') {
        await profileCommand.execute(interaction);
        return;
    }

    if (interaction.commandName === 'shop') {
        await shopCommand.execute(interaction);
        return;
    }

    if (interaction.commandName === 'lab') {
        try {
            await labCommand.execute(interaction);
        } catch (error) {
            console.error('❌ خطأ أثناء تشغيل /lab:', error);
        }
        return;
    }

    if (interaction.commandName === 'colors') {
        await sendColorMenu(interaction);
        return;
    }

    if (interaction.commandName === 'games') {
        await handleGamesCommand(interaction);
    }

    if (interaction.commandName === 'clear') {
        const allowedRoleIds = ['1434264100556247040'];
        const hasRole = interaction.member.roles.cache.some(role => allowedRoleIds.includes(role.id));

        if (!hasRole) {
            return interaction.reply({ 
                content: 'عذراً، لا تملك الرتبة المحددة لاستخدام هذا الأمر.', 
                flags: MessageFlags.Ephemeral 
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
            return interaction.reply({ content: 'لم يتم العثور على رسائل لحذفها.', flags: MessageFlags.Ephemeral });
        }

        await interaction.channel.bulkDelete(messagesToDelete, true)
            .then(deleted => {
                interaction.reply({ content: `تم حذف ${deleted.size} رسالة بنجاح.`, flags: MessageFlags.Ephemeral });
            })
            .catch(err => {
                console.error(err);
                interaction.reply({ content: 'حدث خطأ أثناء الحذف (قد تكون الرسائل أقدم من 14 يوماً).', flags: MessageFlags.Ephemeral });
            });
    }

    if (interaction.commandName === 'ban') {
        const user = interaction.options.getUser('العضو');
        const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
        if (!member.bannable) return interaction.reply({ content: '❌ لا أملك صلاحيات لحظر هذا العضو!', flags: MessageFlags.Ephemeral });

        await member.ban({ reason });
        await interaction.reply({ content: `🔨 تم حظر ${user.tag} بنجاح!\n**السبب:** ${reason}` });
    }

    if (interaction.commandName === 'kick') {
        const user = interaction.options.getUser('العضو');
        const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
        if (!member.kickable) return interaction.reply({ content: '❌ لا أملك صلاحيات لطرد هذا العضو!', flags: MessageFlags.Ephemeral });

        await member.kick(reason);
        await interaction.reply({ content: `👞 تم طرد ${user.tag} بنجاح!\n**السبب:** ${reason}` });
    }

    if (interaction.commandName === 'timeout') {
        const user = interaction.options.getUser('العضو');
        const minutes = interaction.options.getInteger('الدقائق');
        const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
        if (!member.moderatable) return interaction.reply({ content: '❌ لا أملك صلاحيات لإعطاء تايم أوت لهذا العضو!', flags: MessageFlags.Ephemeral });

        const durationMs = minutes * 60 * 1000;
        await member.timeout(durationMs, reason);
        await interaction.reply({ content: `🔇 تم إعطاء تايم أوت لـ ${user.tag} لمدة **${minutes}** دقيقة.\n**السبب:** ${reason}` });
    }
});

// ==========================================
// 5. تشغيل البوت
// ==========================================
const token = process.env.DISCORD_TOKEN || process.env.TOKEN;

if (!token) {
    console.error('❌ خطأ: لم يتم العثور على توكين البوت في متغيرات البيئة (DISCORD_TOKEN)!');
} else {
    client.login(token).catch(err => {
        console.error('❌ فشل تسجيل الدخول إلى ديسكورد:', err);
    });
}
