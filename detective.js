const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType 
} = require('discord.js');

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
    },
    "مدرسة": {
        crime_scenes: ["المعمل الكيميائي", "غرفة المدير", "المكتبة"],
        innocent_spots: ["الملعب", "مقصف المدرسة", "الممر الشرقي", "غرفة المعلمين", "دورة المياه"]
    },
    "مركز شرطة": {
        crime_scenes: ["غرفة الأدلة", "غرفة التحقيق المغلقة", "مكتب المفتش"],
        innocent_spots: ["الاستقبال", "غرفة النظافة", "مواقف الدوريات", "السجن المؤقت", "السطح"]
    },
    "مول تجاري": {
        crime_scenes: ["محل الجواهر", "غرفة التحكم والصيانة", "المخزن الخلفي"],
        innocent_spots: ["مطاعم الفود كورت", "صالة السينما", "المصعد البانورامي", "المواقف B1", "سوبرماركت"]
    }
};

const NIGHT_EVENTS = [
    "⚡ **انقطاع التيار الكهربائي:** انطفأت الأنوار لفترة وجيزة، مما جعل بعض التبريرات غامضة!",
    "📹 **تسجيل كاميرات المراقبة:** رصدت الكاميرات حركة مشبوهة بالقرب من مسرح الجريمة!",
    "👣 **أثر قدم ملطخ:** تم العثور على آثار أقدام تتجه بعيداً عن موقع الجثة!",
    "🌧️ **أجواء عاصفة:** تعذر على البعض سماع الأصوات القريبة أثناء وقوع الجريمة."
];

const LOBBY_WAIT_TIME_SECONDS = 30;

function createChunkedButtons(buttons, maxPerRow = 5) {
    const rows = [];
    for (let i = 0; i < buttons.length; i += maxPerRow) {
        rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + maxPerRow)));
    }
    return rows;
}

async function startDetectiveGame(selectInteraction, initialInteraction) {
    const players = new Map();
    const playerInteractions = new Map();

    players.set(selectInteraction.user.id, selectInteraction.user);
    playerInteractions.set(selectInteraction.user.id, selectInteraction);

    const startTime = Math.floor((Date.now() + LOBBY_WAIT_TIME_SECONDS * 1000) / 1000);

    const joinButton = new ButtonBuilder()
        .setCustomId('det_join')
        .setLabel('انضمام للتحقيق 🕵️‍♂️')
        .setStyle(ButtonStyle.Success);

    const leaveButton = new ButtonBuilder()
        .setCustomId('det_leave')
        .setLabel('انسحاب 🚪')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

    function buildLobbyEmbed() {
        const playerList = Array.from(players.values());
        const count = playerList.length;

        let playersText = count > 0 
            ? playerList.map((u, index) => `**#${index + 1}** - <@${u.id}>`).join('\n')
            : 'لا يوجد مشتبه بهم مشاركين حالياً.';

        return new EmbedBuilder()
            .setColor('#2c3e50')
            .setTitle('🕵️‍♂️ لعبة المحققين')
            .setDescription(
                `**طريقة اللعب:**\n` +
                `**1-** انضم للقضية.\n` +
                `**2-** اضغط على زر (عرض بطاقتي السرية 📜) لرؤية دورك وموقعك بنفس الروم.\n` +
                `**3-** استجوب المشاركين واستخدم زر الطوارئ عند الحاجة.\n` +
                `**4-** صوّت ضد المشتبه به للذهاب لمرحلة الدفاع والمحاكمة!\n\n` +
                `📋 **المشاركون (${count}/20):**\n${playersText}\n\n` +
                `⏳ **ستبدأ القضية <t:${startTime}:R>**`
            );
    }

    const mainMessage = await selectInteraction.update({ 
        embeds: [buildLobbyEmbed()], 
        components: [row],
        fetchReply: true 
    });

    const lobbyCollector = initialInteraction.channel.createMessageComponentCollector({ 
        componentType: ComponentType.Button, 
        time: LOBBY_WAIT_TIME_SECONDS * 1000 
    });

    lobbyCollector.on('collect', async i => {
        if (i.customId === 'det_join') {
            if (players.has(i.user.id)) {
                return i.reply({ content: 'أنت منضم بالفعل في هذه القضية!', ephemeral: true });
            }
            if (players.size >= 20) {
                return i.reply({ content: 'اكتمل العدد الأقصى لللاعبين (20)!', ephemeral: true });
            }

            players.set(i.user.id, i.user);
            playerInteractions.set(i.user.id, i);

            await i.update({ embeds: [buildLobbyEmbed()] });
        }

        if (i.customId === 'det_leave') {
            if (!players.has(i.user.id)) {
                return i.reply({ content: 'أنت لست مسجلاً في القائمة لتنسحب!', ephemeral: true });
            }
            
            players.delete(i.user.id);
            playerInteractions.delete(i.user.id);
            await i.update({ embeds: [buildLobbyEmbed()] });
        }
    });

    lobbyCollector.on('end', async () => {
        joinButton.setDisabled(true);
        leaveButton.setDisabled(true);
        
        await mainMessage.edit({ components: [new ActionRowBuilder().addComponents(joinButton, leaveButton)] }).catch(() => {});

        if (players.size < 2) {
            return initialInteraction.channel.send({ 
                content: '❌ **تم إلغاء القضية!** لم ينضم عدد كافٍ من المشتبه بهم (يلزم 2 على الأقل).' 
            });
        }

        await runDetectiveRound(initialInteraction.channel, Array.from(players.values()));
    });
}

async function runDetectiveRound(channel, playerList) {
    const locationNames = Object.keys(LOCATIONS_DATA);
    const locationName = locationNames[Math.floor(Math.random() * locationNames.length)];
    const locationInfo = LOCATIONS_DATA[locationName];
    const crimeScene = locationInfo.crime_scenes[Math.floor(Math.random() * locationInfo.crime_scenes.length)];

    const shuffled = [...playerList].sort(() => Math.random() - 0.5);

    const killer = shuffled.pop();
    const doctor = shuffled.pop() || killer;
    const informant = shuffled.pop() || killer;
    const detectives = shuffled.splice(0, Math.min(3, shuffled.length));
    const citizens = shuffled;

    const rolesData = {};
    const playerSpots = {};

    rolesData[killer.id] = { role: 'killer', spot: 'مسرح الجريمة', extra: crimeScene, name: 'المجرم 🩸' };

    if (doctor.id !== killer.id) {
        const docSpot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
        rolesData[doctor.id] = { role: 'doctor', spot: docSpot, name: 'الطبيب 🩺' };
        playerSpots[doctor.id] = docSpot;
    }

    if (informant.id !== killer.id) {
        const informantSpot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
        const hints = [
            `المجرم يتواجد في المكان العام (${locationName}).`,
            `المجرم ليس في نفس موقعك الحالي (${informantSpot}).`,
            `الجريمة تم التخطيط لها بالقرب من: ${crimeScene}.`
        ];
        rolesData[informant.id] = { role: 'informant', spot: informantSpot, extra: hints[Math.floor(Math.random() * hints.length)], name: 'المخبر السري 🔍' };
        playerSpots[informant.id] = informantSpot;
    }

    detectives.forEach(det => {
        const spot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
        rolesData[det.id] = { role: 'detective', spot, name: 'محقق 🔎' };
        playerSpots[det.id] = spot;
    });

    citizens.forEach(cit => {
        const spot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)];
        rolesData[cit.id] = { role: 'citizen', spot, name: 'مواطن عادي 👤' };
        playerSpots[cit.id] = spot;
    });

    let selectedKillTarget = null;
    let selectedProtectTarget = null;

    // زر في الروم يستعرض البطاقة السرية لكل لاعب بصورة Ephemeral مخفية
    const cardsBtn = new ButtonBuilder()
        .setCustomId('view_my_card')
        .setLabel('عرض بطاقتي السرية 📜')
        .setStyle(ButtonStyle.Primary);

    const nightRow = new ActionRowBuilder().addComponents(cardsBtn);

    const nightMsg = await channel.send({
        content: "🎭 **بدأت القضية!** اضغط على الزر أدناه لمعرفة دورك وموقعك السرّي (يظهر لك وحدك في الروم):",
        components: [nightRow]
    });

    const nightCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 25000 });

    nightCollector.on('collect', async i => {
        if (!playerList.some(p => p.id === i.user.id)) {
            return i.reply({ content: 'أنت لست مشاركاً في هذه الجولة!', ephemeral: true });
        }

        if (i.customId === 'view_my_card') {
            const data = rolesData[i.user.id];
            let infoText = "";
            let extraComponents = [];

            if (data.role === 'killer') {
                infoText = `🕵️‍♂️ **دورك:** المجرم!\n📍 **موقعك:** مسرح الجريمة\n📍 **مسرح الجريمة المقرر:** ${data.extra}`;
                
                // إضافة أزرار القتل مباشرة في القائمة المخفية للمجرم
                const targets = playerList.filter(p => p.id !== killer.id);
                const buttons = targets.map(p => 
                    new ButtonBuilder()
                        .setCustomId(`kill_target_${p.id}`)
                        .setLabel(p.displayName || p.username)
                        .setStyle(ButtonStyle.Danger)
                );
                extraComponents = createChunkedButtons(buttons);

            } else if (data.role === 'doctor') {
                infoText = `🩺 **دورك:** الطبيب الشرعي!\n📍 **موقعك:** ${data.spot}`;

                // إضافة أزرار الحماية للطبيب
                const buttons = playerList.map(p => 
                    new ButtonBuilder()
                        .setCustomId(`protect_target_${p.id}`)
                        .setLabel(p.displayName || p.username)
                        .setStyle(ButtonStyle.Success)
                );
                extraComponents = createChunkedButtons(buttons);

            } else if (data.role === 'informant') {
                infoText = `🔍 **دورك:** المخبر السري!\n📍 **موقعك:** ${data.spot}\n💡 **تلميح خاص لك:** ${data.extra}`;
            } else if (data.role === 'detective') {
                infoText = `🔎 **دورك:** محقق جنائي!\n📍 **موقعك:** ${data.spot}\n💡 *استجوب المشتبه بهم للوصول للجاني!*`;
            } else {
                infoText = `👤 **دورك:** مواطن عادي\n📍 **موقعك:** ${data.spot}\n💡 *أثبت براءتك باختيار موقعك وساعد المحققين!*`;
            }

            return i.reply({
                content: `📌 **بطاقة أوراقك السرية:**\n${infoText}`,
                components: extraComponents,
                ephemeral: true
            });
        }

        // تفاعل المجرم
        if (i.customId.startsWith('kill_target_')) {
            if (i.user.id !== killer.id) return i.reply({ content: 'هذا الخيار خاص بالمجرم فقط!', ephemeral: true });
            const targetId = i.customId.replace('kill_target_', '');
            selectedKillTarget = playerList.find(p => p.id === targetId);
            return i.update({ content: `🎯 تم اختيار هدفك: **${selectedKillTarget.displayName || selectedKillTarget.username}** بنجاح!`, components: [] });
        }

        // تفاعل الطبيب
        if (i.customId.startsWith('protect_target_')) {
            if (i.user.id !== doctor.id) return i.reply({ content: 'هذا الخيار خاص بالطبيب فقط!', ephemeral: true });
            const targetId = i.customId.replace('protect_target_', '');
            selectedProtectTarget = playerList.find(p => p.id === targetId);
            return i.update({ content: `🛡️ اخترت حماية: **${selectedProtectTarget.displayName || selectedProtectTarget.username}** بنجاح!`, components: [] });
        }
    });

    await new Promise(resolve => nightCollector.on('end', () => resolve()));

    cardsBtn.setDisabled(true);
    await nightMsg.edit({ components: [new ActionRowBuilder().addComponents(cardsBtn)] }).catch(() => {});

    // معالجة عدم الاختيار الآلي
    const targets = playerList.filter(p => p.id !== killer.id);
    if (!selectedKillTarget && targets.length > 0) {
        selectedKillTarget = targets[Math.floor(Math.random() * targets.length)];
    }

    const currentEvent = NIGHT_EVENTS[Math.floor(Math.random() * NIGHT_EVENTS.length)];
    let activePlayers = [];

    if (selectedProtectTarget && selectedKillTarget && selectedKillTarget.id === selectedProtectTarget.id) {
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
    } else if (selectedKillTarget) {
        const victimSpot = playerSpots[selectedKillTarget.id] || "مكان مجهول";
        const witnessHint = `👁️ **دليل الشاهد:** لوحظ تحرك مشبوه يبتعد عن (${victimSpot}).`;

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('🚨 تم العثور على جثة!')
            .setDescription(
                `**المكان العام:** ${locationName}\n` +
                `💀 **الضحية:** <@${selectedKillTarget.id}>\n` +
                `📍 **موقع الجثة:** ${victimSpot}\n\n` +
                `✨ **حدث ليلة الجريمة:**\n${currentEvent}\n` +
                `${witnessHint}\n\n` +
                `📢 **ابدأوا التحقيق واستجوبوا المشاركين للوصول للجاني!**`
            );
        activePlayers = playerList.filter(p => p.id !== selectedKillTarget.id);
        await channel.send({ embeds: [embed] });
    } else {
        activePlayers = [...playerList];
    }

    // فترة التحقيق
    const skipVotes = new Set();
    const usedEmergency = new Set();
    let SKIP_REQUIRED = Math.ceil(activePlayers.length / 2);
    const investEndTime = Math.floor((Date.now() + 90000) / 1000);

    const skipButton = new ButtonBuilder()
        .setCustomId('skip_investigation')
        .setLabel(`تخطي التحقيق ⏩ (0/${SKIP_REQUIRED})`)
        .setStyle(ButtonStyle.Secondary);

    const emergencyButton = new ButtonBuilder()
        .setCustomId('emergency_meeting')
        .setLabel(`استدعى طارئ 🚨`)
        .setStyle(ButtonStyle.Danger);

    const investRow = new ActionRowBuilder().addComponents(skipButton, emergencyButton);

    const investMsg = await channel.send({
        content: `⏳ **بدأ وقت التحقيق!** ينتهي التحقيق <t:${investEndTime}:R>\nأمامكم وقت لمناقشة الأماكن والتبريرات.`,
        components: [investRow]
    });

    let skipEarly = false;
    let emergencyCalledBy = null;

    const investCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 90000 });

    investCollector.on('collect', async i => {
        if (!activePlayers.some(p => p.id === i.user.id)) {
            return i.reply({ content: 'يمكن للاعبين الأحياء فقط التفاعل أثناء التحقيق!', ephemeral: true });
        }

        if (i.customId === 'skip_investigation') {
            if (skipVotes.has(i.user.id)) {
                skipVotes.delete(i.user.id);
                await i.reply({ content: 'تم إلغاء تصويتك بالتخطي.', ephemeral: true });
            } else {
                skipVotes.add(i.user.id);
                await i.reply({ content: 'تم تسجيل تصويتك للتخطي!', ephemeral: true });
            }

            skipButton.setLabel(`تخطي التحقيق ⏩ (${skipVotes.size}/${SKIP_REQUIRED})`);
            await investMsg.edit({ components: [new ActionRowBuilder().addComponents(skipButton, emergencyButton)] }).catch(() => {});

            if (skipVotes.size >= SKIP_REQUIRED) {
                skipEarly = true;
                investCollector.stop('skipped');
            }
        }

        if (i.customId === 'emergency_meeting') {
            if (usedEmergency.has(i.user.id)) {
                return i.reply({ content: 'لقد استخدمت زر الاستدعاء الطارئ سابقاً!', ephemeral: true });
            }

            usedEmergency.add(i.user.id);
            emergencyCalledBy = i.user;
            await i.reply({ content: '🚨 قمت بطلب اجتماع طارئ قطعاً للتحقيق!', ephemeral: false });
            investCollector.stop('emergency');
        }
    });

    await new Promise(resolve => investCollector.on('end', () => resolve()));

    skipButton.setDisabled(true);
    emergencyButton.setDisabled(true);
    await investMsg.edit({ components: [new ActionRowBuilder().addComponents(skipButton, emergencyButton)] }).catch(() => {});

    if (emergencyCalledBy) {
        await channel.send(`🚨 **اجتماع طارئ!** قام <@${emergencyCalledBy.id}> بقطع وقت التحقيق للذهاب للتصويت فوراً!`);
    } else if (skipEarly) {
        await channel.send("⏩ **اكتمل نصاب التخطي! الانتقال للتصويت فوراً.**");
    }

    // مرحلة التصويت
    const userVotesMap = new Map(); 
    const voteCounts = {};
    activePlayers.forEach(p => voteCounts[p.id] = 0);
    let skipVoteCount = 0;
    const voteEndTime = Math.floor((Date.now() + 30000) / 1000);

    function buildVoteRows(isDisabled = false) {
        const buttons = [];

        activePlayers.forEach(player => {
            const count = voteCounts[player.id] || 0;
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`vote_${player.id}`)
                    .setLabel(`${count}  ${player.displayName || player.username}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(isDisabled)
            );
        });

        buttons.push(
            new ButtonBuilder()
                .setCustomId('vote_skip')
                .setLabel(`${skipVoteCount}  تخطي ⏩`)
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(isDisabled)
        );

        return createChunkedButtons(buttons);
    }

    const voteMsg = await channel.send({
        content: `🗳️ **مرحلة التصويت!** ينتهي التصويت <t:${voteEndTime}:R>\nاختر المشتبه به لنقله لمرحلة المحاكمة:`,
        components: buildVoteRows(false)
    });

    const voteCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    voteCollector.on('collect', async vInteraction => {
        if (!vInteraction.customId.startsWith('vote_')) return;

        if (!activePlayers.some(p => p.id === vInteraction.user.id)) {
            return vInteraction.reply({ content: 'أنت لست ضمن المشاركين الأحياء!', ephemeral: true });
        }

        const userId = vInteraction.user.id;
        const previousVote = userVotesMap.get(userId);

        if (previousVote) {
            if (previousVote === 'skip') {
                skipVoteCount--;
            } else {
                voteCounts[previousVote] = Math.max(0, (voteCounts[previousVote] || 0) - 1);
            }
        }

        if (vInteraction.customId === 'vote_skip') {
            skipVoteCount++;
            userVotesMap.set(userId, 'skip');
            await vInteraction.reply({ content: 'اخترت التخطي!', ephemeral: true });
        } else {
            const targetId = vInteraction.customId.replace('vote_', '');

            if (targetId === userId) {
                return vInteraction.reply({ content: '❌ لا يمكنك التصويت ضد نفسك!', ephemeral: true });
            }

            voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
            userVotesMap.set(userId, targetId);
            
            const targetUser = activePlayers.find(p => p.id === targetId);
            await vInteraction.reply({ content: `تم تصويتك ضد **${targetUser ? targetUser.displayName || targetUser.username : 'المشتبه به'}**!`, ephemeral: true });
        }

        await voteMsg.edit({ components: buildVoteRows(false) }).catch(() => {});

        if (userVotesMap.size >= activePlayers.length) {
            voteCollector.stop();
        }
    });

    await new Promise(resolve => voteCollector.on('end', () => resolve()));
    await voteMsg.edit({ components: buildVoteRows(true) }).catch(() => {});

    let maxVotes = 0;
    let topCandidate = null;
    let isTie = false;

    for (const [pId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
            maxVotes = count;
            topCandidate = pId;
            isTie = false;
        } else if (count === maxVotes && maxVotes > 0) {
            isTie = true;
        }
    }

    if (skipVoteCount > maxVotes) {
        topCandidate = null;
    } else if (skipVoteCount === maxVotes && maxVotes > 0) {
        isTie = true;
    }

    // مرحلة الدفاع والمحاكمة
    let finalConvictedCandidate = null;

    if (topCandidate && !isTie) {
        const accusedUser = activePlayers.find(p => p.id === topCandidate);
        const defenseEndTime = Math.floor((Date.now() + 50000) / 1000);

        const defenseEmbed = new EmbedBuilder()
            .setColor('#e67e22')
            .setTitle('🏛️ قاعة المحكمة - مرحلة الدفاع')
            .setDescription(
                `📣 **المتهم الحالي:** <@${accusedUser.id}>\n\n` +
                `أمام المتهم **50 ثانية** للدفاع عن نفسه وتبرير موقفه بشتى الطرق!\n` +
                `تنتهي فترة الدفاع <t:${defenseEndTime}:R>\n\n` +
                `بقية اللاعبين يستعدون للتصويت التأكيدي: (تأكيد الطرد ❌ / العفو 🕊️)`
            );

        await channel.send({ embeds: [defenseEmbed] });

        await new Promise(resolve => setTimeout(resolve, 50000));

        const confirmVotes = { execute: 0, pardon: 0 };
        const confirmedVoters = new Set();

        const executeBtn = new ButtonBuilder()
            .setCustomId('confirm_execute')
            .setLabel('طرد المتهم ❌')
            .setStyle(ButtonStyle.Danger);

        const pardonBtn = new ButtonBuilder()
            .setCustomId('confirm_pardon')
            .setLabel('منح العفو 🕊️')
            .setStyle(ButtonStyle.Success);

        const trialRow = new ActionRowBuilder().addComponents(executeBtn, pardonBtn);

        const trialMsg = await channel.send({
            content: `⚖️ **انتهى وقت الدفاع!** صوّتوا الآن على مصير <@${accusedUser.id}>:`,
            components: [trialRow]
        });

        const trialCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

        trialCollector.on('collect', async tInt => {
            if (!activePlayers.some(p => p.id === tInt.user.id)) {
                return tInt.reply({ content: 'يمكن للاعبين الأحياء فقط المشاركة في الحكم!', ephemeral: true });
            }

            if (tInt.user.id === accusedUser.id) {
                return tInt.reply({ content: 'لا يمكنك التصويت في محاكمتك الخاصة!', ephemeral: true });
            }

            if (confirmedVoters.has(tInt.user.id)) {
                return tInt.reply({ content: 'لقد أصدرت حكمك بالفعل!', ephemeral: true });
            }

            confirmedVoters.add(tInt.user.id);

            if (tInt.customId === 'confirm_execute') {
                confirmVotes.execute++;
                await tInt.reply({ content: 'صوّت لـ **طرد المتهم**.', ephemeral: true });
            } else {
                confirmVotes.pardon++;
                await tInt.reply({ content: 'صوّت لـ **منح العفو**.', ephemeral: true });
            }
        });

        await new Promise(resolve => trialCollector.on('end', () => resolve()));

        executeBtn.setDisabled(true);
        pardonBtn.setDisabled(true);
        await trialMsg.edit({ components: [new ActionRowBuilder().addComponents(executeBtn, pardonBtn)] }).catch(() => {});

        if (confirmVotes.execute > confirmVotes.pardon) {
            finalConvictedCandidate = topCandidate;
            await channel.send(`⚖️ **أصدرت المحكمة حكمها!** تم تأكيد طرد <@${accusedUser.id}> بأغلبية الأصوات.`);
        } else {
            await channel.send(`🕊️ **تم منح العفو!** قررت الأغلبية قبول دفاع <@${accusedUser.id}> ولم يتم طرده.`);
        }
    }

    // النتيجة الختامية
    let rolesSummary = playerList.map(p => {
        const data = rolesData[p.id];
        const spotInfo = data.spot ? `(الموقع: ${data.spot})` : '';
        return `• <@${p.id}> ➔ **${data.name}** ${spotInfo}`;
    }).join('\n');

    const resultEmbed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('📊 نتيجة القضية وكشف الأوراق النهائي');

    let resultText = "";
    if (finalConvictedCandidate === killer.id) {
        resultText = `🎉 **فاز المحققون والمواطنون!**\nنجحتم في كشف وطرد المجرم الحقيقي: <@${killer.id}>.`;
    } else if (finalConvictedCandidate) {
        resultText = `😈 **فاز المجرم ونجا بفعلته!**\nتم طرد <@${finalConvictedCandidate}> بالخطأ.\nالمجرم الحقيقي كان: <@${killer.id}>!`;
    } else {
        resultText = `😈 **فاز المجرم ونجا بفعلته!**\nلم يتم طرد أحد في هذه الجولة، ونجا المجرم الحقيقي: <@${killer.id}>!`;
    }

    resultEmbed.setDescription(
        `${resultText}\n\n` +
        `📜 **كشف أدوار ومواقع جميع المشاركين:**\n${rolesSummary}`
    );

    await channel.send({ embeds: [resultEmbed] });
}

module.exports = { startDetectiveGame };
