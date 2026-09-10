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

            if (players.size < 3) {
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

module.exports = { startOutOfLoopGame };