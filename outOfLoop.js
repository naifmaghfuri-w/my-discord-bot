const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType,
    MessageFlags 
} = require('discord.js');

// نظام ذاكرة بسيط لحفظ نقاط XP في السيرفر
const userXP = new Map();

function addXP(userId, amount) {
    const current = userXP.get(userId) || 0;
    const updated = Math.max(0, current + amount);
    userXP.set(userId, updated);
    return updated;
}

// إضافة تصنيف الملابس والإكسسوارات (الإضافة رقم 1)
const topicsOutOfLoop = {
    "أطعمة ومأكولات": ["كبسة", "بيتزا", "شاورما", "سوشي", "برجر", "فلافل", "ورق عنب", "مضغوط"],
    "ألعاب فيديو": ["ماينكرافت", "ببجي", "كول اوف ديوتي", "فيفا", "فورتنايت", "قنشين امباكت", "روكيت ليق"],
    "أنمي ومسلسلات": ["ون بيس", "هجوم العمالقة", "ناروتو", "قاتل الشياطين", "دراجون بول", "بليتش"],
    "دول وعواصم": ["السعودية", "الإمارات", "مصر", "اليابان", "تركيا", "باريس", "لندن"],
    "ملابس وإكسسوارات": ["فستان", "كاب", "شنطة", "نظارة", "حذاء", "قميص", "ساعة"]
};

async function startOutOfLoopGame(selectInteraction, initialInteraction) {
    const players = new Map();
    players.set(selectInteraction.user.id, selectInteraction);

    let selectedCategory = null;
    const lobbyDurationMs = 60000;
    const startTimeUnix = Math.floor((Date.now() + lobbyDurationMs) / 1000);
    const maxPlayers = 20;

    const joinButton = new ButtonBuilder()
        .setCustomId('join_game')
        .setLabel('Join')
        .setEmoji('1547214733122478110')
        .setStyle(ButtonStyle.Secondary);

    const leaveButton = new ButtonBuilder()
        .setCustomId('leave_game')
        .setLabel('Leave')
        .setEmoji('1547653716725731438')
        .setStyle(ButtonStyle.Secondary);

    const buttonRow = new ActionRowBuilder().addComponents(joinButton, leaveButton);

    const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('select_category')
        .setPlaceholder('اختر التصنيف')
        .addOptions([
            new StringSelectMenuOptionBuilder()
                .setLabel('🎮 ألعاب فيديو')
                .setValue('ألعاب فيديو')
                .setDescription('ماينكرافت، كول اوف ديوتي، ببجي، وغيرها'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🎬 أنمي ومسلسلات')
                .setValue('أنمي ومسلسلات')
                .setDescription('ون بيس، هجوم العمالقة، ناروتو، وغيرها'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🌍 دول وعواصم')
                .setValue('دول وعواصم')
                .setDescription('السعودية، اليابان، باريس، وغيرها'),
            new StringSelectMenuOptionBuilder()
                .setLabel('🍕 أطعمة ومأكولات')
                .setValue('أطعمة ومأكولات')
                .setDescription('شاورما، بيتزا، وغيرها'),
            new StringSelectMenuOptionBuilder()
                .setLabel('👔 ملابس وإكسسوارات')
                .setValue('ملابس وإكسسوارات')
                .setDescription('فستان، كاب، شنطة، وغيرها')
        ]);

    const categoryRow = new ActionRowBuilder().addComponents(categorySelect);

    const buildLobbyEmbed = () => {
        const playerListFormatted = players.size > 0 
            ? Array.from(players.keys()).map((id, index) => `${index + 1}- <@${id}> (XP: ${userXP.get(id) || 0})`).join('\n')
            : 'لا يوجد لاعبين مشاركين باللعبة';

        const categoryStatus = selectedCategory ? `**${selectedCategory}**` : 'عشوائي ';

        return new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle(' برا السالفة - v1.2')
            .setDescription(
                `**طريقة اللعب:**\n` +
                `1- انضم للعب مع بقية اللاعبين.\n` +
                `2- سيحصل الجميع على **الكلمة السرية** باستثناء لاعب واحد سيكون **"برا السالفة"**.\n` +
                `3- سيوجه البوت أسئلة تلقائية بين اللاعبين كل 60 ثانية.\n` +
                `4- بعد انتهاء وقت النقاش يتم التصويت لكشف الشخص المطلوب!\n\n` +
                `📌 **التصنيف المختار:** ${categoryStatus}\n\n` +
                `**أرقام اللاعبين: (${players.size}/${maxPlayers})**\n` +
                `${playerListFormatted}\n\n` +
                `⏳ **ستبدأ اللعبة تلقائياً:** <t:${startTimeUnix}:R>`
            );
    };

    await selectInteraction.update({ 
        embeds: [buildLobbyEmbed()], 
        components: [categoryRow, buttonRow] 
    });

    const collector = initialInteraction.channel.createMessageComponentCollector({ time: lobbyDurationMs });

    collector.on('collect', async i => {
        if (i.customId === 'select_category') {
            if (i.user.id !== selectInteraction.user.id) {
                return i.reply({ content: 'صاحب الأمر فقط هو من يمكنه تحديد التصنيف!', flags: MessageFlags.Ephemeral });
            }
            selectedCategory = i.values[0];
            await i.update({ embeds: [buildLobbyEmbed()] });
            return;
        }

        if (i.customId === 'join_game') {
            if (players.has(i.user.id)) {
                return i.reply({ content: 'أنت منضم بالفعل للعبة!', flags: MessageFlags.Ephemeral });
            }
            if (players.size >= maxPlayers) {
                return i.reply({ content: 'عذراً، اكتمل الحد الأقصى للاعبين!', flags: MessageFlags.Ephemeral });
            }
            players.set(i.user.id, i);
            await i.update({ embeds: [buildLobbyEmbed()] });
            return;
        }
        
        if (i.customId === 'leave_game') {
            if (!players.has(i.user.id)) {
                return i.reply({ content: 'أنت لست منضماً في اللعبة لتخرج منها!', flags: MessageFlags.Ephemeral });
            }
            players.delete(i.user.id);
            await i.update({ embeds: [buildLobbyEmbed()] });
            return;
        }
    });

    collector.on('end', async () => {
        if (players.size < 2) {
            return initialInteraction.channel.send({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('❌ إلغاء اللعبة')
                        .setDescription('انتهى الوقت ولم يكتمل الحد الأدنى المطلوب للاعبين (3 لاعبين على الأقل).')
                ]
            });
        }

        const categoryNames = Object.keys(topicsOutOfLoop);
        const chosenCategory = selectedCategory || categoryNames[Math.floor(Math.random() * categoryNames.length)];
        const wordList = topicsOutOfLoop[chosenCategory];
        const secretWord = wordList[Math.floor(Math.random() * wordList.length)];

        const playerArray = Array.from(players.keys());
        const imposterId = playerArray[Math.floor(Math.random() * playerArray.length)];

        const gameStartEmbed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🚀 بدأت لعبة برا السالفة v1.2!')
            .setDescription(
                `التصنيف المختار: **${chosenCategory}**\n\n` +
                `تم إرسال الكلمة السرية والدور لكل لاعب سرّاً!\n` +
                `⏱️ **سيبدأ البوت بتوجيه الأسئلة تلقائياً كل 60 ثانية!**`
            );

        await initialInteraction.channel.send({ embeds: [gameStartEmbed] });

        for (const [pId, pInteraction] of players.entries()) {
            if (pId === imposterId) {
                await pInteraction.followUp({
                    content: `🤫 **أنت برا السالفة!**\nالتصنيف هو: **${chosenCategory}**\nحاول تخمين الكلمة من إجاباتهم واعرف السالفة!`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            } else {
                await pInteraction.followUp({
                    content: `💡 **السالفة هي:** **${secretWord}**\nالتصنيف: **${chosenCategory}**\nاسألوا بعضكم لكشف من هو برا السالفة!`,
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
        }

        // الإضافة رقم 2: نظام الأسئلة التلقائية كل 60 ثانية
        let questionRounds = 0;
        const totalQuestionRounds = 4; 
        
        const questionInterval = setInterval(async () => {
            if (questionRounds >= totalQuestionRounds) {
                clearInterval(questionInterval);
                return;
            }
            
            questionRounds++;
            const p1 = playerArray[Math.floor(Math.random() * playerArray.length)];
            let p2 = playerArray[Math.floor(Math.random() * playerArray.length)];
            while (p1 === p2) {
                p2 = playerArray[Math.floor(Math.random() * playerArray.length)];
            }

            const askEmbed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`📢 دور الأسئلة التلقائي [${questionRounds}/${totalQuestionRounds}]`)
                .setDescription(`👉 <@${p1}> قم بتوجيه سؤال إلى <@${p2}> يتعلق بالسالفة!\n⏳ معك **60 ثانية** قبل الانتقال للدور التالي.`);

            await initialInteraction.channel.send({ embeds: [askEmbed] });
        }, 60000);

        await new Promise(resolve => setTimeout(resolve, (totalQuestionRounds * 15000) + 2000));

        // التصويت
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
            .setTitle('🗳️ انتهى وقت الأسئلة! حان وقت التصويت')
            .setDescription(`صوّتوا الآن لمعرفة من هو الشخص الذي **برا السالفة**! (أمامكم 60 ثانية)`);

        const voteMsg = await initialInteraction.channel.send({ embeds: [voteEmbed], components: [voteRow] });

        const votes = {};
        playerArray.forEach(id => votes[id] = 0);
        const playerVotes = new Map();

        const voteCollector = voteMsg.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000
        });

        voteCollector.on('collect', async vInt => {
            if (!players.has(vInt.user.id)) {
                return vInt.reply({ content: 'أنت لست ضمن المشاركين في هذه اللعبة!', flags: MessageFlags.Ephemeral });
            }
            if (playerVotes.has(vInt.user.id)) {
                return vInt.reply({ content: 'لقد قمت بالتصويت بالفعل!', flags: MessageFlags.Ephemeral });
            }

            const selected = vInt.values[0];
            playerVotes.set(vInt.user.id, selected);
            votes[selected] = (votes[selected] || 0) + 1;

            await vInt.reply({ content: 'تم تسجيل تصويتك بنجاح!', flags: MessageFlags.Ephemeral });

            if (playerVotes.size >= playerArray.length) {
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

            const xpChanges = [];

            // إذا كُشف الشخص الذي برا السالفة: الإضافة رقم 4 (Last Chance Guess)
            if (!isTie && mostVoted === imposterId) {
                const guessButton = new ButtonBuilder()
                    .setCustomId('last_chance_guess')
                    .setLabel('تخمين الكلمة (40 ثانيه)')
                    .setStyle(ButtonStyle.Danger);

                const guessRow = new ActionRowBuilder().addComponents(guessButton);

                const lastChanceEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('🚨 تم كشفك! فرصة التخمين الأخيرة')
                    .setDescription(`<@${imposterId}> لقد كشفك الجميع! لديك **40 ثانية** للضغط على الزر وتخمين الكلمة لاستعادة الفوز!`);

                const lastChanceMsg = await initialInteraction.channel.send({ 
                    content: `<@${imposterId}>`,
                    embeds: [lastChanceEmbed], 
                    components: [guessRow] 
                });

                let guessedSuccessfully = false;

                const guessCollector = lastChanceMsg.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 40000
                });

                guessCollector.on('collect', async gInt => {
                    if (gInt.user.id !== imposterId) {
                        return gInt.reply({ content: 'هذا الخيار للشخص الذي برا السالفة فقط!', flags: MessageFlags.Ephemeral });
                    }

                    await gInt.reply({
                        content: `الكلمة كانت ضمن تصنيف **${chosenCategory}**. اكتب تخمينك الآن في القناة العامة مباشرة!`,
                        flags: MessageFlags.Ephemeral
                    });

                    const chatCollector = initialInteraction.channel.createMessageCollector({
                        filter: m => m.author.id === imposterId,
                        time: 10000
                    });

                    chatCollector.on('collect', async m => {
                        if (m.content.trim().toLowerCase() === secretWord.toLowerCase()) {
                            guessedSuccessfully = true;
                            chatCollector.stop();
                            guessCollector.stop();
                        }
                    });
                });

                await new Promise(resolve => setTimeout(resolve, 11000));

                if (guessedSuccessfully) {
                    const newXP = addXP(imposterId, 50);
                    xpChanges.push(`🎉 <@${imposterId}> (برا السالفة): +50 XP (المجموع: ${newXP}) [سرق الفوز بالفرصة الأخيرة!]`);

                    for (const [voterId, targetId] of playerVotes.entries()) {
                        const current = addXP(voterId, -10);
                        xpChanges.push(`❌ <@${voterId}>: -10 XP (المجموع: ${current})`);
                    }

                    return sendSummaryEmbed(initialInteraction, true, imposterId, secretWord, xpChanges, "سرق الشخص الذي برا السالفة الفوز بتخمين الكلمة في اللحظة الأخيرة!");
                } else {
                    const newXP = addXP(imposterId, -10);
                    xpChanges.push(`❌ <@${imposterId}> (برا السالفة): -10 XP (المجموع: ${newXP})`);

                    for (const [voterId, targetId] of playerVotes.entries()) {
                        if (targetId === imposterId) {
                            const current = addXP(voterId, 30);
                            xpChanges.push(`✅ <@${voterId}>: +30 XP (المجموع: ${current})`);
                        } else {
                            const current = addXP(voterId, -10);
                            xpChanges.push(`❌ <@${voterId}>: -10 XP (المجموع: ${current})`);
                        }
                    }

                    return sendSummaryEmbed(initialInteraction, false, imposterId, secretWord, xpChanges, "نجح الجميع في كشف الشخص الذي برا السالفة وفشل في التخمين!");
                }
            } else {
                // في حال التعادل أو التصويت الخاطئ
                const newXP = addXP(imposterId, 50);
                xpChanges.push(`🎉 <@${imposterId}> (برا السالفة): +50 XP (المجموع: ${newXP}) [فاز بسبب التمويه]`);

                for (const [voterId, targetId] of playerVotes.entries()) {
                    const current = addXP(voterId, -10);
                    xpChanges.push(`❌ <@${voterId}>: -10 XP (المجموع: ${current})`);
                }

                return sendSummaryEmbed(initialInteraction, true, imposterId, secretWord, xpChanges, "لم يتم الاتفاق على الشخص المطلوب وفاز برا السالفة!");
            }
        });
    });
}

// الإضافة رقم 5: ملخص نهاية الجولة (Round Summary Embed)
async function sendSummaryEmbed(interaction, imposterWon, imposterId, secretWord, xpChanges, details) {
    const summaryEmbed = new EmbedBuilder()
        .setColor(imposterWon ? '#f1c40f' : '#2ecc71')
        .setTitle(' ملخص نتائج الجولة ')
        .setDescription(
            ` **الشخص الذي كان برا السالفة:** <@${imposterId}>\n` +
            ` **الكلمة السرية:** **${secretWord}**\n` +
            ` **نتيجة الجولة:** ${details}\n\n` +
            ` **(Risk & Reward):**\n` +
            `${xpChanges.join('\n')}`
        )
        .setFooter({ text: 'برا السالفة v1.2 •' });

    await interaction.channel.send({ embeds: [summaryEmbed] });
}

module.exports = { startOutOfLoopGame };
