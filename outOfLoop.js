const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType 
} = require('discord.js');

const topicsOutOfLoop = {
    "أطعمة ومأكولات": ["كبسة", "بيتزا", "شاورما", "سوشي", "برجر", "فلافل", "ورق عنب", "مضغوط"],
    "ألعاب فيديو": ["ماينكرافت", "ببجي", "كول اوف ديوتي", "فيفا", "فورتنايت", "قنشين امباكت", "روكيت ليق"],
    "أنمي ومسلسلات": ["ون بيس", "هجوم العمالقة", "ناروتو", "قاتل الشياطين", "دراجون بول", "بليتش"],
    "دول وعواصم": ["السعودية", "الإمارات", "مصر", "اليابان", "تركيا", "باريس", "لندن"]
};

async function startOutOfLoopGame(selectInteraction, initialInteraction) {
    const players = new Map();
    players.set(selectInteraction.user.id, selectInteraction);

    let selectedCategory = null;
    const lobbyDurationMs = 60000; // وقت التجميع التلقائي (60 ثانية)
    const startTimeUnix = Math.floor((Date.now() + lobbyDurationMs) / 1000);
    const maxPlayers = 20;

    // أزرار الانضمام والخروج
    const joinButton = new ButtonBuilder()
        .setCustomId('join_game')
        .setLabel('انضمام للعبة 🎮')
        .setStyle(ButtonStyle.Success);

    const leaveButton = new ButtonBuilder()
        .setCustomId('leave_game')
        .setLabel('خروج 🚪')
        .setStyle(ButtonStyle.Danger);

    const buttonRow = new ActionRowBuilder().addComponents(joinButton, leaveButton);

    // قائمة خيارات التصنيف (ألعاب، مسلسلات، دول، أطعمة)
    const categorySelect = new StringSelectMenuBuilder()
        .setCustomId('select_category')
        .setPlaceholder('🎯 اختر التصنيف المطلوب (ألعاب / مسلسلات / دول ...)')
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
                .setDescription('كبسة، شاورما، بيتزا، وغيرها')
        ]);

    const categoryRow = new ActionRowBuilder().addComponents(categorySelect);

    // دالة بناء Embed اللوبي
    const buildLobbyEmbed = () => {
        const playerListFormatted = players.size > 0 
            ? Array.from(players.keys()).map((id, index) => `${index + 1}- <@${id}>`).join('\n')
            : 'لا يوجد لاعبين مشاركين باللعبة';

        const categoryStatus = selectedCategory ? `**${selectedCategory}**` : 'عشوائي 🎲';

        return new EmbedBuilder()
            .setColor('#f39c12')
            .setTitle('🕵️‍♂️ برا السالفة - v1.1')
            .setDescription(
                `**طريقة اللعب:**\n` +
                `1- انضم للعبة واشترك مع بقية اللاعبين.\n` +
                `2- سيحصل الجميع على **الكلمة السرية** باستثناء لاعب واحد سيكون **"برا السالفة"**.\n` +
                `3- يتناقش الجميع بالتلميح والأسئلة، وعلى الشخص الذي برا السالفة التمويه وتخمين الكلمة.\n` +
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
        // تحديد التصنيف من قائمة الخيارات
        if (i.customId === 'select_category') {
            if (i.user.id !== selectInteraction.user.id) {
                return i.reply({ content: 'صاحب الأمر فقط هو من يمكنه تحديد التصنيف!', ephemeral: true });
            }
            selectedCategory = i.values[0];
            await i.update({ embeds: [buildLobbyEmbed()] });
            return;
        }

        // انضمام
        if (i.customId === 'join_game') {
            if (players.has(i.user.id)) {
                return i.reply({ content: 'أنت منضم بالفعل للعبة!', ephemeral: true });
            }
            if (players.size >= maxPlayers) {
                return i.reply({ content: 'عذراً، اكتمل الحد الأقصى للاعبين!', ephemeral: true });
            }
            players.set(i.user.id, i);
            await i.update({ embeds: [buildLobbyEmbed()] });
            return;
        }
        
        // خروج
        if (i.customId === 'leave_game') {
            if (!players.has(i.user.id)) {
                return i.reply({ content: 'أنت لست منضماً في اللعبة لتخرج منها!', ephemeral: true });
            }
            players.delete(i.user.id);
            await i.update({ embeds: [buildLobbyEmbed()] });
            return;
        }
    });

    // البدء التلقائي عند انتهاء المؤقت
    collector.on('end', async () => {
        if (players.size < 3) {
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
            .setTitle('🚀 بدأت لعبة برا السالفة!')
            .setDescription(
                `التصنيف المختار: **${chosenCategory}**\n\n` +
                `تم إرسال الكلمة السرية والدور لكل لاعب سرّاً!\n` +
                `⏱️ **أمامكم 90 ثانية للنقاش والتلميح!**\n` +
                `💡 إذا كان الشخص الذي **برا السالفة** يعرف الكلمة، فيمكنه كتابتها مباشرة في الشات ليفوز!`
            );

        await initialInteraction.channel.send({ embeds: [gameStartEmbed] });

        // إرسال الكلمات بالرسائل الخاصة المخفية (Ephemeral)
        for (const [pId, pInteraction] of players.entries()) {
            if (pId === imposterId) {
                await pInteraction.followUp({
                    content: `🤫 **أنت برا السالفة!**\nالتصنيف هو: **${chosenCategory}**\nحاول تخمين الكلمة من إجاباتهم واكتبها في الشات لكي تفوز!`,
                    ephemeral: true
                }).catch(() => {});
            } else {
                await pInteraction.followUp({
                    content: `💡 **السالفة هي:** **${secretWord}**\nالتصنيف: **${chosenCategory}**\nاسألوا بعضكم لكشف من هو برا السالفة!`,
                    ephemeral: true
                }).catch(() => {});
            }
        }

        let gameEnded = false;
        const msgCollector = initialInteraction.channel.createMessageCollector({
            filter: m => m.author.id === imposterId,
            time: 90000
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

        await new Promise(resolve => setTimeout(resolve, 90000));

        if (gameEnded) return;

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
    });
}

module.exports = { startOutOfLoopGame };
