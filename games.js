// games/games.js
const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType 
} = require('discord.js');

// ==========================================
// 1. بيانات الألعاب
// ==========================================
const topicsOutOfLoop = {
    "أطعمة ومأكولات": ["كبسة", "بيتزا", "شاورما", "سوشي", "برجر", "فلافل", "ورق عنب", "مضغوط"],
    "ألعاب فيديو": ["ماينكرافت", "ببجي", "كول اوف ديوتي", "فيفا", "فورتنايت", "قنشين امباكت", "روكيت ليق"],
    "أنمي ومسلسلات": ["ون بيس", "هجوم العمالقة", "ناروتو", "قاتل الشياطين", "دراجون بول", "بليتش"],
    "دول وعواصم": ["السعودية", "الإمارات", "مصر", "اليابان", "تركيا", "باريس", "لندن"]
};

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
// 2. تعريف الأوامر المائلة
// ==========================================
const gamesCommands = [
    new SlashCommandBuilder()
        .setName('العاب')
        .setDescription('عرض قائمة الألعاب المتاحة واختيار لعبة لبدئها')
];

// ==========================================
// 3. معالجة أمر /العاب
// ==========================================
async function handleGamesCommand(interaction) {
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_game')
        .setPlaceholder('اختر لعبة للبدء 🎲')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('برا السالفة')
                .setDescription('لعبة معرفة من هو الشخص الذي برا السالفة')
                .setValue('out_of_loop')
                .setEmoji('🕵️‍♂️'),
            new StringSelectMenuOptionBuilder()
                .setLabel('المحققين')
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

// ==========================================
// 4. منطق اللعبة الأولى: برا السالفة (مُعدل بالكامل)
// ==========================================
async function startOutOfLoopGame(selectInteraction, initialInteraction) {
    const players = new Map(); // استخدام Map لتخزين بيانات اللاعبين والتفاعل
    players.set(selectInteraction.user.id, selectInteraction);

    const joinButton = new ButtonBuilder()
        .setCustomId('join_game')
        .setLabel('انضمام للعبة 🎮')
        .setStyle(ButtonStyle.Success);

    const leaveButton = new ButtonBuilder()
        .setCustomId('leave_game')
        .setLabel('خروج 🚪')
        .setStyle(ButtonStyle.Danger);

    const startButton = new ButtonBuilder()
        .setCustomId('start_game')
        .setLabel('بدء اللعبة 🚀')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton);

    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🎲 لعبة برا السالفة')
        .setDescription(`اللاعبون المنضمون حالياً:\n<@${selectInteraction.user.id}>\n\n**يلزم 3 لاعبين على الأقل لبدء اللعبة!**`);

    await selectInteraction.update({ embeds: [embed], components: [row] });

    const btnCollector = initialInteraction.channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    btnCollector.on('collect', async i => {
        if (i.customId === 'join_game') {
            if (players.has(i.user.id)) {
                return i.reply({ content: 'أنت منضم بالفعل للعبة!', ephemeral: true });
            }
            players.set(i.user.id, i);
            const updatedList = Array.from(players.keys()).map(id => `<@${id}>`).join('\n');
            embed.setDescription(`اللاعبون المنضمون حالياً:\n${updatedList}\n\n**يلزم 3 لاعبين على الأقل لبدء اللعبة!**`);
            await i.update({ embeds: [embed] });
        }
        
        if (i.customId === 'leave_game') {
            if (!players.has(i.user.id)) {
                return i.reply({ content: 'أنت لست منضماً في اللعبة لتخرج منها!', ephemeral: true });
            }
            
            players.delete(i.user.id);
            
            const updatedList = players.size > 0 
                ? Array.from(players.keys()).map(id => `<@${id}>`).join('\n')
                : 'لا يوجد لاعبين منضمين حالياً.';
                
            embed.setDescription(`اللاعبون المنضمون حالياً:\n${updatedList}\n\n`);
            await i.update({ embeds: [embed] });
        }

        if (i.customId === 'start_game') {
            if (i.user.id !== selectInteraction.user.id) {
                return i.reply({ content: 'صاحب الأمر فقط هو من يمكنه بدء اللعبة!', ephemeral: true });
            }

            if (players.size < 2) {
                return i.reply({ content: 'العدد غير كافي! يجب أن ينضم 3 لاعبين على الأقل.', ephemeral: true });
            }

            btnCollector.stop('started');

            const categoryNames = Object.keys(topicsOutOfLoop);
            const chosenCategory = categoryNames[Math.floor(Math.random() * categoryNames.length)];
            const wordList = topicsOutOfLoop[chosenCategory];
            const secretWord = wordList[Math.floor(Math.random() * wordList.length)];

            const playerArray = Array.from(players.keys());
            const imposterId = playerArray[Math.floor(Math.random() * playerArray.length)];

            const gameStartEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 بدأت لعبة برا السالفة!')
                .setDescription(`المجال العام: **${chosenCategory}**\n\n` +
                    `تم إرسال الدور والكلمة السرية لكل لاعب بشكل سرّي خاص به!\n` +
                    `⏱️ **أمامكم 90 ثانية للنقاش والتلميح!**\n` +
                    `💡 إذا كان الشخص الذي **برا السالفة** يعرف الكلمة، فيمكنه كتابتها مباشرة في الشات ليفوز!`);

            await i.update({ embeds: [gameStartEmbed], components: [] });

            // إرسال الكلمة لكل لاعب بناءً على تفاعله الشخصي لضمان ظهورها له فقط
            for (const [pId, pInteraction] of players.entries()) {
                if (pId === imposterId) {
                    await pInteraction.followUp({
                        content: `🤫 **أنت برا السالفة!**\nالمجال هو: **${chosenCategory}**\nحاول تخمين الكلمة من إجاباتهم واكتبها في الشات للحل!`,
                        ephemeral: true
                    }).catch(() => {});
                } else {
                    await pInteraction.followUp({
                        content: `💡 **السالفة هي:** **${secretWord}**\nالمجال: **${chosenCategory}**\nاسألوا بعضكم لكشف من هو برا السالفة!`,
                        ephemeral: true
                    }).catch(() => {});
                }
            }

            // مراقبة الرسائل للتحقق مما إذا كان الشخص الذي برا السالفة سيكتب الكلمة الصحيحة
            let gameEnded = false;
            const msgCollector = initialInteraction.channel.createMessageCollector({
                filter: m => m.author.id === imposterId,
                time: 90000 // 90 ثانية
            });

            msgCollector.on('collect', async m => {
                if (m.content.trim().toLowerCase() === secretWord.toLowerCase()) {
                    gameEnded = true;
                    msgCollector.stop('guessed');
                    const winEmbed = new EmbedBuilder()
                        .setColor('#f1c40f')
                        .setTitle('🎉 فاز الشخص الذي برا السالفة!')
                        .setDescription(`نجح <@${imposterId}> في تخمين الكلمة الصحيحة وهي: **${secretWord}**!`);
                    await initialInteraction.channel.send({ embeds: [winEmbed] });
                }
            });

            // انتظار انتهاء الـ 3 دقائق للنقاش إذا لم يتم تخمين الكلمة
            await new Promise(resolve => setTimeout(resolve, 90000));

            if (gameEnded) return;

            // بدء مرحلة التصويت بعد انتهاء الـ 3 دقائق
            const voteSelect = new StringSelectMenuBuilder()
                .setCustomId('vote_imposter')
                .setPlaceholder('صوّت على من تعتقد أنه برا السالفة 🕵️‍♂️')
                .addOptions(playerArray.map(pId => {
                    const member = initialInteraction.guild.members.cache.get(pId);
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(member ? member.displayName : pId)
                        .setValue(pId);
                }));

            const voteRow = new ActionRowBuilder().addComponents(voteSelect);

            const voteEmbed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle('🗳️ انتهى الوقت! حان وقت التصويت')
                .setDescription(`صوّتوا الآن لمعرفة من هو الشخص الذي **برا السالفة**! (أمامكم 40 ثانية)`);

            const voteMsg = await initialInteraction.channel.send({ embeds: [voteEmbed], components: [voteRow] });

            const votes = {};
            playerArray.forEach(id => votes[id] = 0);
            const votedUsers = new Set();

            const voteCollector = voteMsg.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 40000
            });

            voteCollector.on('collect', async vInt => {
                if (!players.has(vInt.user.id)) {
                    return vInt.reply({ content: 'أنت لست ضمن المشاركين في هذه اللعبة!', ephemeral: true });
                }
                if (votedUsers.has(vInt.user.id)) {
                    return vInt.reply({ content: 'لقد قمت بالتصويت بالفعل!', ephemeral: true });
                }

                votedUsers.add(vInt.user.id);
                const selected = vInt.values[0];
                votes[selected] = (votes[selected] || 0) + 1;

                await vInt.reply({ content: 'تم تسجيل تصويتك بنجاح!', ephemeral: true });

                if (votedUsers.size >= playerArray.length) {
                    voteCollector.stop();
                }
            });

            voteCollector.on('end', async () => {
                voteSelect.setDisabled(true);
                await voteMsg.edit({ components: [new ActionRowBuilder().addComponents(voteSelect)] }).catch(() => {});

                let maxVotes = 0;
                let mostVoted = null;
                let isTie = false;

                for (const [pId, count] of Object.entries(votes)) {
                    if (count > maxVotes) {
                        maxVotes = count;
                        mostVoted = pId;
                        isTie = false;
                    } else if (count === maxVotes && maxVotes > 0) {
                        isTie = true;
                    }
                }

                const resultEmbed = new EmbedBuilder().setTitle('📊 نتيجة لعبة برا السالفة');

                if (isTie || !mostVoted) {
                    resultEmbed.setColor('#e74c3c')
                        .setDescription(`⚖️ **تعادل التصويت!**\nفاز الشخص الذي برا السالفة (<@${imposterId}>) لأنه لم يتم الاتفاق عليه!\nالكلمة كانت: **${secretWord}**.`);
                } else if (mostVoted === imposterId) {
                    resultEmbed.setColor('#2ecc71')
                        .setDescription(`🎉 **مبروك! كشفتوه!**\nالشخص الذي برا السالفة كان بالفعل: <@${imposterId}>\nالكلمة كانت: **${secretWord}**.`);
                } else {
                    resultEmbed.setColor('#e74c3c')
                        .setDescription(`\nصوّتم بالخطأ ضد <@${mostVoted}>.\nالشخص الحقيقي الذي كان برا السالفة هو: <@${imposterId}>\nالكلمة كانت: **${secretWord}**.`);
                }

                await initialInteraction.channel.send({ embeds: [resultEmbed] });
            });
        }
    });
}

// ==========================================
// 5. لعبة المحقق والمجرم
// ==========================================
async function startDetectiveGame(selectInteraction, initialInteraction) {
    const players = new Map();
    players.set(selectInteraction.user.id, selectInteraction.user);

    const joinButton = new ButtonBuilder()
        .setCustomId('det_join')
        .setLabel('انضمام للعبة 🎮')
        .setStyle(ButtonStyle.Success);

    const leaveButton = new ButtonBuilder()
        .setCustomId('det_leave')
        .setLabel('خروج 🚪')
        .setStyle(ButtonStyle.Danger);

    const startButton = new ButtonBuilder()
        .setCustomId('det_start')
        .setLabel('بدء اللعبة 🚀')
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinButton, leaveButton, startButton);

    const embed = new EmbedBuilder()
        .setColor('#2c3e50')
        .setTitle('🕵️‍♂️ لعبة المحققين')
        .setDescription(`**اللاعبون المنضمون حالياً:**\n<@${selectInteraction.user.id}>\n\n⚠️ **يلزم 5 لاعبين على الأقل لبدء اللعبة!**`);

    await selectInteraction.update({ embeds: [embed], components: [row] });

    const lobbyCollector = initialInteraction.channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    lobbyCollector.on('collect', async i => {
        if (i.customId === 'det_join') {
            if (players.has(i.user.id)) {
                return i.reply({ content: 'أنت منضم بالفعل!', ephemeral: true });
            }
            players.set(i.user.id, i.user);
            const updatedList = Array.from(players.values()).map(u => `<@${u.id}>`).join('\n');
            embed.setDescription(`**اللاعبون المنضمون حالياً:**\n${updatedList}\n\n⚠️ **يلزم 5 لاعبين على الأقل لبدء اللعبة!**`);
            await i.update({ embeds: [embed] });
        }

        if (i.customId === 'det_leave') {
            if (!players.has(i.user.id)) {
                return i.reply({ content: 'أنت لست منضماً في اللعبة لتخرج منها!', ephemeral: true });
            }
            
            players.delete(i.user.id);
            
            const updatedList = players.size > 0 
                ? Array.from(players.values()).map(u => `<@${u.id}>`).join('\n')
                : 'لا يوجد لاعبين منضمين حالياً.';
                
            embed.setDescription(`**اللاعبون المنضمون حالياً:**\n${updatedList}\n\n⚠️ **يلزم 5 لاعبين على الأقل لبدء اللعبة!**`);
            await i.update({ embeds: [embed] });
        }

        if (i.customId === 'det_start') {
            if (i.user.id !== selectInteraction.user.id) {
                return i.reply({ content: 'صاحب الأمر فقط هو من يمكنه بدء اللعبة!', ephemeral: true });
            }

            if (players.size < 5) {
                return i.reply({ content: 'الحد الأدنى للبدء هو 5 لاعبين!', ephemeral: true });
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
        content: "🎭 بدأت الجولة! اضغطوا على الزر أدناه لمعرفة أدواركم \n⏳ *أمام الجميع 30 ثانية لمعرفة الأدوار.",
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

module.exports = { gamesCommands, handleGamesCommand };
