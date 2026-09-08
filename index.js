const { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    PermissionFlagsBits,
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType 
} = require('discord.js');
const express = require('express');

// ==========================================
// 1. سيرفر Express لإبقاء البوت حياً على Render
// ==========================================
const app = express();
app.get('/', (req, res) => res.send('Bot is Alive!'));
app.listen(process.env.PORT || 3000, () => console.log('Web server running'));

// ==========================================
// 2. إعداد البوت والبيانات
// ==========================================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// بنك مواضيع لعبة "برا السالفة"
const topicsOutOfLoop = {
    "أطعمة ومأكولات": ["كبسة", "بيتزا", "شاورما", "سوشي", "برجر", "فلافل", "ورق عنب", "مضغوط"],
    "ألعاب فيديو": ["ماينكرافت", "ببجي", "كول اوف ديوتي", "فيفا", "فورتنايت", "قنشين امباكت", "روكيت ليق"],
    "أنمي ومسلسلات": ["ون بيس", "هجوم العمالقة", "ناروتو", "قاتل الشياطين", "دراجون بول", "بليتش"],
    "دول وعواصم": ["السعودية", "الإمارات", "مصر", "اليابان", "تركيا", "باريس", "لندن"]
};

// بيانات لعبة "المحقق والمجرم"
const LOCATIONS_DATA = {
    "فندق": {
        crime_scenes: ["الغرفة 303", "الجناح الملكي 501", "المطعم الرئيسي"],
        innocent_spots: ["دورات المياه بالدور الأرضي", "الاستقبال", "المسبح", "الغرفة 301", "المطبخ", "المصعد"]
    },
    "مستشفى": {
        crime_scenes: ["غرفة العمليات", "غرفة العناية المركزة", "المختبر"],
        innocent_spots: ["قسم الطوارئ", "الصيدلية", "الكافتيريا", "غرفة الانتظار", "مواقف السيارات", "الممر الرئيسي"]
    },
    "مطار": {
        crime_scenes: ["صالة كبار الشخصيات", "طائرة الرحلة 707", "منطقة استلام الحقائب"],
        innocent_spots: ["بوابة المغادرة 4", "السوق الحرة", "المقاهي", "المصلى", "منطقة التفتيش"]
    },
    "سفينة سياحية": {
        crime_scenes: ["جناح القبطان", "الصالة الرئيسية", "السطح العلوي للسفينة"],
        innocent_spots: ["غرفة المحركات", "المطعم الخلفي", "المسبح الداخلي", "الممر السفلي", "قارب النجاة"]
    }
};

const NIGHT_EVENTS = [
    "⚡ **انقطاع التيار الكهربائي:** تسبب العطل في انطفاء الأنوار لفترة وجيزة، مما جعل بعض التبريرات غامضة!",
    "📹 **تسجيل كاميرات المراقبة:** رصدت الكاميرات حركة مشبوهة لشخصين بالقرب من مسرح الجريمة!",
    "👣 **أثر قدم ملطخ:** تم العثور على آثار أقدام تتجه بعيداً عن موقع الجثة!",
    "🌧️ **أجواء عاصفة:** تعذر على البعض سماع الأصوات القريبة أثناء وقوع الجريمة."
];

// ==========================================
// 3. تسجيل الأوامر المائلة (Slash Commands)
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('العاب')
        .setDescription('عرض قائمة الألعاب المتاحة وااختيار لعبة لبدئها'),
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
    const rest = new REST({ version: '10' }).setToken("MTU0NDk2ODYwNzcxNTI5OTQwOA.GDJZME.1F_bc6xWmerD8K6a7UhMhZqCZFjF8D2XqaAmVI");
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل جميع الأوامر المائلة والإدارية بنجاح!');
    } catch (err) {
        console.error('❌ خطأ في تسجيل الأوامر:', err);
    }
});

// ==========================================
// 4. معالجة الأوامر المائلة (التنظيف، الألعاب، الإدارة)
// ==========================================
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

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

    // أمر /العاب
    if (interaction.commandName === 'العاب') {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_game')
            .setPlaceholder('اختر لعبة للبدء 🎲')
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel('برا السالفة')
                    .setDescription('لعبة الذكاء والتمويه لمعرفة من هو الشخص الذي برا السالفة')
                    .setValue('out_of_loop')
                    .setEmoji('🕵️‍♂️'),
                new StringSelectMenuOptionBuilder()
                    .setLabel('المحقق والمجرم')
                    .setDescription('لعبة التحقيق واستجواب المشاركين لكشف الجاني')
                    .setValue('detective_game')
                    .setEmoji('🔍')
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const gamesEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🎮 قائمة الألعاب المتاحة')
            .setDescription('اختر اللعبة التي تريد تشغيلها من القائمة بالأسفل:');

        const response = await interaction.reply({ embeds: [gamesEmbed], components: [row], fetchReply: true });

        const menuCollector = response.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

        menuCollector.on('collect', async selectInteraction => {
            if (selectInteraction.user.id !== interaction.user.id) {
                return selectInteraction.reply({ content: 'صاحب الأمر فقط هو من يمكنه اختيار اللعبة!', ephemeral: true });
            }

            if (selectInteraction.values[0] === 'out_of_loop') {
                menuCollector.stop();
                await startOutOfLoopGame(selectInteraction, interaction);
            } else if (selectInteraction.values[0] === 'detective_game') {
                menuCollector.stop();
                await startDetectiveGame(selectInteraction, interaction);
            }
        });
    }
});

// ==========================================
// 5. منطق اللعبة الأولى: برا السالفة
// ==========================================
async function startOutOfLoopGame(selectInteraction, initialInteraction) {
    const players = new Set();
    players.add(selectInteraction.user.id);

    const joinButton = new ButtonBuilder()
        .setCustomId('join_game')
        .setLabel('انضمام للعبة 🎮')
        .setStyle(ButtonStyle.Success);

    const startButton = new ButtonBuilder()
        .setCustomId('start_game')
        .setLabel('بدء اللعبة 🚀')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinButton, startButton);

    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎲 لعبة برا السالفة')
        .setDescription(`اللاعبون المنضمون حالياً:\n<@${selectInteraction.user.id}>\n\n**يلزم 3 لاعبين على الأقل لبدء اللعبة!**`);

    await selectInteraction.update({ embeds: [embed], components: [row] });

    const btnCollector = initialInteraction.channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    btnCollector.on('collect', async i => {
        if (i.customId === 'join_game') {
            players.add(i.user.id);
            const updatedList = Array.from(players).map(id => `<@${id}>`).join('\n');
            embed.setDescription(`اللاعبون المنضمون حالياً:\n${updatedList}\n\n**يلزم 3 لاعبين على الأقل!**`);
            await i.update({ embeds: [embed] });
        }

        if (i.customId === 'start_game') {
            if (i.user.id !== selectInteraction.user.id) {
                return i.reply({ content: 'صاحب الأمر فقط هو من يمكنه بدء اللعبة!', ephemeral: true });
            }

            if (players.size < 3) {
                return i.reply({ content: 'العدد غير كافي! يجب أن ينضم 3 لاعبين على الأقل.', ephemeral: true });
            }

            btnCollector.stop('started');

            const categoryNames = Object.keys(topicsOutOfLoop);
            const chosenCategory = categoryNames[Math.floor(Math.random() * categoryNames.length)];
            const wordList = topicsOutOfLoop[chosenCategory];
            const secretWord = wordList[Math.floor(Math.random() * wordList.length)];

            const playerArray = Array.from(players);
            const imposterId = playerArray[Math.floor(Math.random() * playerArray.length)];

            const gameStartEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 بدأت اللعبة!')
                .setDescription(`المجال العام: **${chosenCategory}**\n\nتم توزيع الأدوار والكلمة السرية تلقائياً لكل شخص في الشات! وهناك شخص واحد **برا السالفة** 🕵️‍♂️\n\nابدأوا طرح الأسئلة!`);

            await i.update({ embeds: [gameStartEmbed], components: [] });

            for (const playerId of playerArray) {
                if (playerId === imposterId) {
                    await initialInteraction.followUp({
                        content: `<@${playerId}> 🤫 **أنت برا السالفة!**\nالمجال هو: **${chosenCategory}**\nحاول تخمين الكلمة من إجاباتهم!`,
                        ephemeral: true
                    });
                } else {
                    await initialInteraction.followUp({
                        content: `<@${playerId}> 💡 **السالفة هي:** **${secretWord}**\nالمجال: **${chosenCategory}**\nاسألوا بعضكم لكشف من هو برا السالفة!`,
                        ephemeral: true
                    });
                }
            }
        }
    });
}

// ==========================================
// 6. منطق اللعبة الثانية: المحقق والمجرم
// ==========================================
async function startDetectiveGame(selectInteraction, initialInteraction) {
    const players = new Map();
    players.set(selectInteraction.user.id, selectInteraction.user);

    const joinButton = new ButtonBuilder()
        .setCustomId('det_join')
        .setLabel('انضمام للعبة 🎮')
        .setStyle(ButtonStyle.Success);

    const startButton = new ButtonBuilder()
        .setCustomId('det_start')
        .setLabel('بدء اللعبة 🚀')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinButton, startButton);

    const embed = new EmbedBuilder()
        .setColor('#2c3e50')
        .setTitle('🕵️‍♂️ لعبة المحقق والمجرم')
        .setDescription(`**اللاعبون المنضمون حالياً:**\n<@${selectInteraction.user.id}>\n\n⚠️ **يلزم 7 لاعبين على الأقل لبدء اللعبة!**`);

    await selectInteraction.update({ embeds: [embed], components: [row] });

    const lobbyCollector = initialInteraction.channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    lobbyCollector.on('collect', async i => {
        if (i.customId === 'det_join') {
            if (players.has(i.user.id)) {
                return i.reply({ content: 'أنت منضم بالفعل!', ephemeral: true });
            }
            players.set(i.user.id, i.user);
            const updatedList = Array.from(players.values()).map(u => `<@${u.id}>`).join('\n');
            embed.setDescription(`**اللاعبون المنضمون حالياً:**\n${updatedList}\n\n⚠️ **يلزم 7 لاعبين على الأقل لبدء اللعبة!**`);
            await i.update({ embeds: [embed] });
        }

        if (i.customId === 'det_start') {
            if (i.user.id !== selectInteraction.user.id) {
                return i.reply({ content: 'صاحب الأمر فقط هو من يمكنه بدء اللعبة!', ephemeral: true });
            }

            if (players.size < 7) {
                return i.reply({ content: 'الحد الأدنى للبدء هو 7 لاعبين (مجرم + طبيب + مخبر + 3 محققين + مواطن)!', ephemeral: true });
            }

            lobbyCollector.stop('started');

            await runDetectiveRound(initialInteraction.channel, Array.from(players.values()));
        }
    });
}

async function runDetectiveRound(channel, playerList) {
    const locationNames = Object.keys(LOCATIONS_DATA);
    const locationName = locationNames[Math.floor(Math.random() * locationNames.length)];
    const locationInfo = LOCATIONS_DATA[locationName];
    const crimeScene = locationInfo.crime_scenes[Math.floor(Math.random() * locationInfo.crime_scenes.length)];

    const shuffled = [...playerList].sort(() => Math.random() - 0.5);

    const killer = shuffled.pop();
    const doctor = shuffled.pop();
    const informant = shuffled.pop();
    const detectives = shuffled.splice(0, 3);
    const citizens = shuffled;

    const rolesData = {};
    const playerSpots = {};

    rolesData[killer.id] = { role: 'killer', spot: 'مكان الجريمة', extra: crimeScene };

    const docSpot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
    rolesData[doctor.id] = { role: 'doctor', spot: docSpot };
    playerSpots[doctor.id] = docSpot;

    const informantSpot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
    const hints = [
        `المجرم يتواجد في المكان العام (${locationName}).`,
        `المجرم ليس في نفس موقعك الحالي (${informantSpot}).`,
        `الجريمة تم التخطيط لها في مكان مغلق.`
    ];
    rolesData[informant.id] = { role: 'informant', spot: informantSpot, extra: hints[Math.floor(Math.random() * hints.length)] };
    playerSpots[informant.id] = informantSpot;

    detectives.forEach(det => {
        const spot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
        rolesData[det.id] = { role: 'detective', spot };
        playerSpots[det.id] = spot;
    });

    citizens.forEach(cit => {
        const spot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
        rolesData[cit.id] = { role: 'citizen', spot };
        playerSpots[cit.id] = spot;
    });

    let selectedKillTarget = null;
    let selectedProtectTarget = null;

    const roleBtn = new ButtonBuilder()
        .setCustomId('check_role_btn')
        .setLabel('📩 اضغط لمعرفة دورك وموقعك السرّي')
        .setStyle(ButtonStyle.Primary);

    const roleRow = new ActionRowBuilder().addComponents(roleBtn);

    const startMsg = await channel.send({
        content: "🎭 **بدأت الجولة!** اضغطوا على الزر أدناه لمعرفة أدواركم واتخاذ القرارات:\n⏳ *أمام الجميع 30 ثانية لمعرفة الأدوار.*",
        components: [roleRow]
    });

    const roleCollector = channel.createMessageComponentCollector({ time: 30000 });

    roleCollector.on('collect', async interaction => {
        if (!rolesData[interaction.user.id]) {
            return interaction.reply({ content: 'أنت لست ضمن المشاركين في هذه الجولة!', ephemeral: true });
        }

        const data = rolesData[interaction.user.id];
        const role = data.role;

        if (interaction.customId === 'check_role_btn') {
            if (role === 'killer') {
                const targets = playerList.filter(p => p.id !== killer.id);
                const menu = new StringSelectMenuBuilder()
                    .setCustomId('killer_select')
                    .setPlaceholder('اختر الضحية 🩸')
                    .addOptions(targets.map(p => new StringSelectMenuOptionBuilder().setLabel(p.displayName || p.username).setValue(p.id)));

                const row = new ActionRowBuilder().addComponents(menu);
                await interaction.reply({
                    content: `🕵️‍♂️ **دورك:** المجرم!\n📍 **موقعك:** مكان الجريمة\n📍 **مسرح الجريمة المقرر:** ${data.extra}\n🩸 **اختر ضحيتك:**`,
                    components: [row],
                    ephemeral: true
                });
            } else if (role === 'doctor') {
                const menu = new StringSelectMenuBuilder()
                    .setCustomId('doctor_select')
                    .setPlaceholder('اختر الشخص لحمايته 🛡️')
                    .addOptions(playerList.map(p => new StringSelectMenuOptionBuilder().setLabel(p.displayName || p.username).setValue(p.id)));

                const row = new ActionRowBuilder().addComponents(menu);
                await interaction.reply({
                    content: `🩺 **دورك:** الطبيب!\n📍 **موقعك:** ${data.spot}\n🛡️ **اختر من تريد حمايته:**`,
                    components: [row],
                    ephemeral: true
                });
            } else if (role === 'informant') {
                await interaction.reply({
                    content: `🔍 **دورك:** المخبر السري!\n📍 **موقعك:** ${data.spot}\n💡 **تلميح خاص لك:** ${data.extra}`,
                    ephemeral: true
                });
            } else if (role === 'detective') {
                await interaction.reply({
                    content: `🔎 **دورك:** محقق!\n📍 **موقعك:** ${data.spot}\n💡 *استجوب الجميع للوصول للجاني!*`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `👤 **دورك:** مواطن عادي\n📍 **موقعك:** ${data.spot}\n💡 *أثبت براءتك باختيار موقعك وساعد المحققين!*`,
                    ephemeral: true
                });
            }
        } else if (interaction.customId === 'killer_select') {
            selectedKillTarget = playerList.find(p => p.id === interaction.values[0]);
            await interaction.update({ content: `🎯 تم اختيار هدفك: **${selectedKillTarget.displayName || selectedKillTarget.username}** بنجاح!`, components: [] });
        } else if (interaction.customId === 'doctor_select') {
            selectedProtectTarget = playerList.find(p => p.id === interaction.values[0]);
            await interaction.update({ content: `🛡️ اخترت حماية: **${selectedProtectTarget.displayName || selectedProtectTarget.username}** لهذه الجولة!`, components: [] });
        }
    });

    await new Promise(resolve => setTimeout(resolve, 30000));

    roleBtn.setDisabled(true);
    await startMsg.edit({ components: [new ActionRowBuilder().addComponents(roleBtn)] }).catch(() => {});

    const targets = playerList.filter(p => p.id !== killer.id);
    if (!selectedKillTarget) {
        selectedKillTarget = targets[Math.floor(Math.random() * targets.length)];
    }

    const currentEvent = NIGHT_EVENTS[Math.floor(Math.random() * NIGHT_EVENTS.length)];
    let activePlayers = [];

    if (selectedProtectTarget && selectedKillTarget.id === selectedProtectTarget.id) {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🛡️ نجاح عملية الإنقاذ!')
            .setDescription(
                `**المكان العام:** ${locationName}\n\n` +
                `حاول المجرم ارتكاب جريمة الليلة، لكن **الطبيب** نجح في حماية الضحية!\nلم يمت أحد هذه الجولة.\n\n` +
                `✨ **حدث ليلة الجريمة:**\n${currentEvent}`
            );
        activePlayers = [...playerList];
        await channel.send({ embeds: [embed] });
    } else {
        const victimSpot = playerSpots[selectedKillTarget.id] || "مكان مجهول";
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🚨 تم العثور على جثة!')
            .setDescription(
                `**المكان العام:** ${locationName}\n` +
                `💀 **الضحية:** <@${selectedKillTarget.id}>\n` +
                `📍 **موقع الجثة:** ${victimSpot}\n\n` +
                `✨ **حدث ليلة الجريمة:**\n${currentEvent}\n\n` +
                `📢 **ابدأوا التحقيق واستجوبوا المشاركين للوصول للجاني!**`
            );
        activePlayers = playerList.filter(p => p.id !== selectedKillTarget.id);
        await channel.send({ embeds: [embed] });
    }

    await channel.send("⏳ **بدأ وقت التحقيق!** أمامكم **90 ثانية** لمناقشة الأماكن والتبريرات.");
    await new Promise(resolve => setTimeout(resolve, 90000));

    // مرحلة التصويت
    const voteMenu = new StringSelectMenuBuilder()
        .setCustomId('vote_select')
        .setPlaceholder('صوّت ضد المشتبه به 🗳️')
        .addOptions(activePlayers.map(p => new StringSelectMenuOptionBuilder().setLabel(p.displayName || p.username).setValue(p.id)));

    const voteRow = new ActionRowBuilder().addComponents(voteMenu);
    const voteMsg = await channel.send({
        content: "🗳️ **انتهى وقت التحقيق!** صوّتوا الآن على المشتبه به من القائمة أدناه (أمامكم 30 ثانية):",
        components: [voteRow]
    });

    const votes = {};
    activePlayers.forEach(p => votes[p.id] = 0);
    const votedUsers = new Set();

    const voteCollector = channel.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 30000 });

    voteCollector.on('collect', async vInteraction => {
        if (!activePlayers.some(p => p.id === vInteraction.user.id)) {
            return vInteraction.reply({ content: 'أنت لست ضمن المشاركين الأحياء!', ephemeral: true });
        }

        if (votedUsers.has(vInteraction.user.id)) {
            return vInteraction.reply({ content: 'لقد قمت بالتصويت بالفعل!', ephemeral: true });
        }

        votedUsers.add(vInteraction.user.id);
        const targetId = vInteraction.values[0];
        votes[targetId] = (votes[targetId] || 0) + 1;

        await vInteraction.reply({ content: 'تم تسجيل تصويتك بنجاح!', ephemeral: true });

        if (votedUsers.size >= activePlayers.length) {
            voteCollector.stop();
        }
    });

    await new Promise(resolve => setTimeout(resolve, 30000));

    voteMenu.setDisabled(true);
    await voteMsg.edit({ components: [new ActionRowBuilder().addComponents(voteMsg)] }).catch(() => {});

    let maxVotes = 0;
    let topCandidate = null;
    let isTie = false;

    for (const [pId, count] of Object.entries(votes)) {
        if (count > maxVotes) {
            maxVotes = count;
            topCandidate = pId;
            isTie = false;
        } else if (count === maxVotes && maxVotes > 0) {
            isTie = true;
        }
    }

    const resultEmbed = new EmbedBuilder().setColor('#f1c40f').setTitle('📊 نتيجة التحقيق النهائية');

    if (isTie || maxVotes === 0 || !topCandidate) {
        resultEmbed.setDescription(`⚖️ **انتهى التصويت بالتعادل أو عدم التصويت!**\nلم يتم الاتفاق على مشتبه به واحد، وبالتالي **نجا المجرم (<@${killer.id}>) بفعلته!**`);
    } else {
        if (topCandidate === killer.id) {
            resultEmbed.setDescription(`🎉 **فاز المحققون والمواطنون!**\nتم كشف المجرم الحقيقي وهو: <@${killer.id}>.`);
        } else {
            resultEmbed.setDescription(`😈 **فاز المجرم ونجا بفعلته!**\nتم اتهام <@${topCandidate}> بالخطأ.\nالمجرم الحقيقي كان: <@${killer.id}>!`);
        }
    }

    await channel.send({ embeds: [resultEmbed] });
}

// ==========================================
// 7. تشغيل البوت
// ==========================================
client.login("MTU0NDk2ODYwNzcxNTI5OTQwOA.GDJZME.1F_bc6xWmerD8K6a7UhMhZqCZFjF8D2XqaAmVI");
