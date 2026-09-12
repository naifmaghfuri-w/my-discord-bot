const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
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
    }
};

const NIGHT_EVENTS = [
    "⚡ **انقطاع التيار الكهربائي:** تسبب العطل في انطفاء الأنوار لفترة وجيزة، مما جعل بعض التبريرات غامضة!",
    "📹 **تسجيل كاميرات المراقبة:** رصدت الكاميرات حركة مشبوهة لشخصين بالقرب من مسرح الجريمة!",
    "👣 **أثر قدم ملطخ:** تم العثور على آثار أقدام تتجه بعيداً عن موقع الجثة!",
    "🌧️ **أجواء عاصفة:** تعذر على البعض سماع الأصوات القريبة أثناء وقوع الجريمة."
];

const LOBBY_WAIT_TIME_SECONDS = 30;

async function startDetectiveGame(selectInteraction, initialInteraction) {
    const players = new Map();
    const playerInteractions = new Map(); // لحفظ التفاعلات وإرسال الرسائل المخفية تلقائياً

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
                `**2-** عند اكتمال الوقت ستصلك رسالة مخفية بـ(دورك وموقعك) تلقائياً.\n` +
                `**3-** استجوب المشاركين لمعرفة القاتل الحقيقي.\n` +
                `**4-** صوّت ضد المشتبه به لإغلاق القضية!\n\n` +
                `📋 **اللاعبين (${count}/20):**\n${playersText}\n\n` +
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

        await runDetectiveRound(initialInteraction.channel, Array.from(players.values()), playerInteractions);
    });
}

async function runDetectiveRound(channel, playerList, playerInteractions) {
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

    rolesData[killer.id] = { role: 'killer', spot: 'مكان الجريمة', extra: crimeScene, name: 'المجرم 🩸' };

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
            `الجريمة تم التخطيط لها في مكان مغلق.`
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

    await channel.send("🎭 **بدأت القضية!** يتم إرسال الأدوار والمواقع السرية للجميع الآن...");

    // إرسال الأدوار تلقائياً للجميع بدون أزرار باستغلال تفاعلات الانضمام
    for (const player of playerList) {
        const data = rolesData[player.id];
        const interaction = playerInteractions.get(player.id);
        if (!interaction) continue;

        if (data.role === 'killer') {
            const targets = playerList.filter(p => p.id !== killer.id);
            const menu = new StringSelectMenuBuilder()
                .setCustomId('killer_select')
                .setPlaceholder('اختر الضحية 🩸')
                .addOptions(targets.map(p => new StringSelectMenuOptionBuilder().setLabel(p.displayName || p.username).setValue(p.id)));

            const row = new ActionRowBuilder().addComponents(menu);
            await interaction.followUp({
                content: `🕵️‍♂️ **دورك:** المجرم!\n📍 **موقعك:** مكان الجريمة\n📍 **مسرح الجريمة المقرر:** ${data.extra}\n🩸 **اختر ضحيتك من القائمة أدناه:**`,
                components: [row],
                ephemeral: true
            }).catch(() => {});
        } else if (data.role === 'doctor') {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('doctor_select')
                .setPlaceholder('اختر الشخص لحمايته 🛡️')
                .addOptions(playerList.map(p => new StringSelectMenuOptionBuilder().setLabel(p.displayName || p.username).setValue(p.id)));

            const row = new ActionRowBuilder().addComponents(menu);
            await interaction.followUp({
                content: `🩺 **دورك:** الطبيب الشرعي!\n📍 **موقعك:** ${data.spot}\n🛡️ **اختر من تريد حمايته:**`,
                components: [row],
                ephemeral: true
            }).catch(() => {});
        } else if (data.role === 'informant') {
            await interaction.followUp({
                content: `🔍 **دورك:** المخبر السري!\n📍 **موقعك:** ${data.spot}\n💡 **تلميح خاص لك:** ${data.extra}`,
                ephemeral: true
            }).catch(() => {});
        } else if (data.role === 'detective') {
            await interaction.followUp({
                content: `🔎 **دورك:** محقق جنائي!\n📍 **موقعك:** ${data.spot}\n💡 *استجوب المشتبه بهم للوصول للجاني!*`,
                ephemeral: true
            }).catch(() => {});
        } else {
            await interaction.followUp({
                content: `👤 **دورك:** مواطن عادي\n📍 **موقعك:** ${data.spot}\n💡 *أثبت براءتك باختيار موقعك وساعد المحققين!*`,
                ephemeral: true
            }).catch(() => {});
        }
    }

    // استقبال اختيارات المجرم والطبيب من الرسائل المخفية
    const actionCollector = channel.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 25000 });

    actionCollector.on('collect', async i => {
        if (i.customId === 'killer_select' && i.user.id === killer.id) {
            selectedKillTarget = playerList.find(p => p.id === i.values[0]);
            await i.update({ content: `🎯 تم اختيار هدفك: **${selectedKillTarget.displayName || selectedKillTarget.username}** بنجاح!`, components: [] });
        } else if (i.customId === 'doctor_select' && doctor && i.user.id === doctor.id) {
            selectedProtectTarget = playerList.find(p => p.id === i.values[0]);
            await i.update({ content: `🛡️ اخترت حماية: **${selectedProtectTarget.displayName || selectedProtectTarget.username}** لهذه الجولة!`, components: [] });
        }
    });

    await new Promise(resolve => setTimeout(resolve, 25000));

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
    } else {
        activePlayers = [...playerList];
    }

    // --- فترة التحقيق وزر التخطي ---
    const skipVotes = new Set();
    const SKIP_REQUIRED = 4;

    const skipButton = new ButtonBuilder()
        .setCustomId('skip_investigation')
        .setLabel(`تخطي التحقيق ⏩ (0/${SKIP_REQUIRED})`)
        .setStyle(ButtonStyle.Secondary);

    const skipRow = new ActionRowBuilder().addComponents(skipButton);

    const investMsg = await channel.send({
        content: "⏳ **بدأ وقت التحقيق!** أمامكم **90 ثانية** لمناقشة الأماكن والتبريرات.",
        components: [skipRow]
    });

    let skipEarly = false;

    const skipCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 90000 });

    skipCollector.on('collect', async i => {
        if (i.customId === 'skip_investigation') {
            if (!activePlayers.some(p => p.id === i.user.id)) {
                return i.reply({ content: 'يمكن للأصلين الأحياء فقط التصويت بالتخطي!', ephemeral: true });
            }

            if (skipVotes.has(i.user.id)) {
                skipVotes.delete(i.user.id);
                await i.reply({ content: 'تم إلغاء تصويتك بالتخطي.', ephemeral: true });
            } else {
                skipVotes.add(i.user.id);
                await i.reply({ content: 'تم تسجيل تصويتك للتخطي!', ephemeral: true });
            }

            skipButton.setLabel(`تخطي التحقيق ⏩ (${skipVotes.size}/${SKIP_REQUIRED})`);
            await investMsg.edit({ components: [new ActionRowBuilder().addComponents(skipButton)] }).catch(() => {});

            if (skipVotes.size >= SKIP_REQUIRED) {
                skipEarly = true;
                skipCollector.stop('skipped');
            }
        }
    });

    await new Promise(resolve => {
        skipCollector.on('end', () => resolve());
    });

    skipButton.setDisabled(true);
    await investMsg.edit({ components: [new ActionRowBuilder().addComponents(skipButton)] }).catch(() => {});

    if (skipEarly) {
        await channel.send("⏩ **تم اكتمل نصاب التخطي! الانتقال للتصويت فوراً.**");
    }

    // --- مرحلة التصويت ---
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

    voteCollector.on('end', async () => {
        voteMenu.setDisabled(true);
        await voteMsg.edit({ components: [new ActionRowBuilder().addComponents(voteMenu)] }).catch(() => {});

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

        // بناء كشف الحساب الشامل لجميع اللاعبين وأدوارهم
        let rolesSummary = playerList.map(p => {
            const data = rolesData[p.id];
            const spotInfo = data.spot ? `(الموقع: ${data.spot})` : '';
            return `• <@${p.id}> ➔ **${data.name}** ${spotInfo}`;
        }).join('\n');

        const resultEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('📊 نتيجة التحقيق وكشف أوراق القضية');

        let resultText = "";
        if (isTie || maxVotes === 0 || !topCandidate) {
            resultText = `⚖️ **انتهى التصويت بالتعادل أو عدم التصويت!**\nلم يتم الاتفاق على مشتبه به واحد، وبالتالي **نجا المجرم (<@${killer.id}>) بفعلته!**`;
        } else {
            if (topCandidate === killer.id) {
                resultText = `🎉 **فاز المحققون والمواطنون!**\nتم كشف المجرم الحقيقي وهو: <@${killer.id}>.`;
            } else {
                resultText = `😈 **فاز المجرم ونجا بفعلته!**\nتم اتهام <@${topCandidate}> بالخطأ.\nالمجرم الحقيقي كان: <@${killer.id}>!`;
            }
        }

        resultEmbed.setDescription(
            `${resultText}\n\n` +
            `📜 **كشف أدوار ومواقع جميع المشتبه بهم:**\n${rolesSummary}`
        );

        await channel.send({ embeds: [resultEmbed] });
    });
}

module.exports = { startDetectiveGame };
