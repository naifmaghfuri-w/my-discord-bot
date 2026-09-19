import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder, 
    ComponentType,
    MessageFlags,
    User,
    Interaction,
    MessageComponentInteraction,
    StringSelectMenuInteraction,
    ButtonInteraction,
    Message
} from 'discord.js';

// تعريف أنواع البيانات
type CategoryMap = Record<string, string[]>;

// نظام ذاكرة بسيط لحفظ نقاط XP في السيرفر
const userXP: Map<string, number> = new Map();

function addXP(userId: string, amount: number): number {
    const current = userXP.get(userId) || 0;
    const updated = Math.max(0, current + amount); // منع الهبوط تحت الصفر
    userXP.set(userId, updated);
    return updated;
}

const topicsOutOfLoop: CategoryMap = {
    "أطعمة ومأكولات": ["كبسة", "بيتزا", "شاورما", "سوشي", "برجر", "فلافل", "ورق عنب"],
    "ألعاب فيديو": ["ماينكرافت", "ببجي", "كول اوف ديوتي", "فيفا", "فورتنايت", "قنشين امباكت", "روكيت ليق"],
    "أنمي ومسلسلات": ["ون بيس", "هجوم العمالقة", "ناروتو", "قاتل الشياطين", "دراجون بول", "بليتش"],
    "دول وعواصم": ["السعودية", "الإمارات", "مصر", "اليابان", "تركيا", "باريس", "لندن"],
    "ملابس وإكسسوارات": ["فستان", "كاب", "شنطة", "نظارة", "حذاء", "قميص", "ساعة"]
};

// دالة مساعدة للإرسال في القناة لتفادي أخطاء Type Safety
async function sendToChannel(channel: any, payload: any): Promise<Message | null> {
    try {
        if (channel && typeof channel.send === 'function') {
            return await channel.send(payload);
        }
    } catch (e) {
        console.error('❌ خطأ في الإرسال إلى القناة:', e);
    }
    return null;
}

export async function startOutOfLoopGame(
    selectInteraction: StringSelectMenuInteraction, 
    initialInteraction: Interaction
): Promise<void> {
    try {
        const players: Map<string, User> = new Map();
        players.set(selectInteraction.user.id, selectInteraction.user);

        let selectedCategory: string | null = null;
        const lobbyDurationMs: number = 60000;
        const startTimeUnix: number = Math.floor((Date.now() + lobbyDurationMs) / 1000);
        const maxPlayers: number = 20;

        const joinButton = new ButtonBuilder()
            .setCustomId('join_game')
            .setLabel('انضمام')
            .setEmoji('1547214733122478110')
            .setStyle(ButtonStyle.Success);

        const leaveButton = new ButtonBuilder()
            .setCustomId('leave_game')
            .setLabel('مغادرة')
            .setEmoji('1547653716725731438')
            .setStyle(ButtonStyle.Danger);

        const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton);

        const categorySelect = new StringSelectMenuBuilder()
            .setCustomId('select_category')
            .setPlaceholder('اختر التصنيف')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('🎮 ألعاب فيديو').setValue('ألعاب فيديو').setDescription('ماينكرافت، كول اوف ديوتي، ببجي، وغيرها'),
                new StringSelectMenuOptionBuilder().setLabel('🎬 أنمي ومسلسلات').setValue('أنمي ومسلسلات').setDescription('ون بيس، هجوم العمالقة، ناروتو، وغيرها'),
                new StringSelectMenuOptionBuilder().setLabel('🌍 دول وعواصم').setValue('دول وعواصم').setDescription('السعودية، اليابان، باريس، وغيرها'),
                new StringSelectMenuOptionBuilder().setLabel('🍕 أطعمة ومأكولات').setValue('أطعمة ومأكولات').setDescription('شاورما، بيتزا، وغيرها'),
                new StringSelectMenuOptionBuilder().setLabel('👔 ملابس وإكسسوارات').setValue('ملابس وإكسسوارات').setDescription('فستان، كاب، شنطة، وغيرها')
            ]);

        const categoryRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect);

        const buildLobbyEmbed = (): EmbedBuilder => {
            const playerListFormatted = players.size > 0 
                ? Array.from(players.keys()).map((id, index) => `${index + 1}- <@${id}> (XP: ${userXP.get(id) || 0})`).join('\n')
                : 'لا يوجد لاعبين مشاركين باللعبة';

            const categoryStatus = selectedCategory ? `**${selectedCategory}**` : 'عشوائي 🎲';

            return new EmbedBuilder()
                .setColor('#f39c12')
                .setTitle('🕵️‍♂️ برا السالفة - v1.2')
                .setDescription(
                    `**طريقة اللعب:**\n` +
                    `1- انضم للعب مع بقية اللاعبين.\n` +
                    `2- سيحصل الجميع على **الكلمة السرية** باستثناء لاعب واحد سيكون **"برا السالفة"**.\n` +
                    `3- يتناوب الجميع على توجيه الأسئلة بمهلة دقيقة واحدة لكل دور (أو التخطي فور الإجابة).\n` +
                    `4- بعد انتهاء الأدوار يتم التصويت لكشف الشخص المطلوب!\n\n` +
                    `📌 **التصنيف المختار:** ${categoryStatus}\n\n` +
                    `**أرقام اللاعبين: (${players.size}/${maxPlayers})**\n` +
                    `${playerListFormatted}\n\n` +
                    `⏳ **ستبدأ اللعبة تلقائياً:** <t:${startTimeUnix}:R>`
                );
        };

        if (selectInteraction.replied || selectInteraction.deferred) {
            await selectInteraction.editReply({ embeds: [buildLobbyEmbed()], components: [categoryRow, buttonRow] });
        } else {
            await selectInteraction.update({ embeds: [buildLobbyEmbed()], components: [categoryRow, buttonRow] });
        }

        const channel = (initialInteraction.channel || selectInteraction.channel) as any;
        if (!channel) return;

        const collector = channel.createMessageComponentCollector({ time: lobbyDurationMs });

        collector.on('collect', async (i: MessageComponentInteraction) => {
            try {
                if (i.customId === 'select_category' && i.isStringSelectMenu()) {
                    if (i.user.id !== selectInteraction.user.id) {
                        return i.reply({ content: '❌ صاحب الأمر فقط هو من يمكنه تحديد التصنيف!', flags: MessageFlags.Ephemeral });
                    }
                    selectedCategory = i.values[0];
                    await i.update({ embeds: [buildLobbyEmbed()] });
                    return;
                }

                if (i.customId === 'join_game') {
                    if (players.has(i.user.id)) {
                        return i.reply({ content: '⚠️ أنت منضم بالفعل للعبة!', flags: MessageFlags.Ephemeral });
                    }
                    if (players.size >= maxPlayers) {
                        return i.reply({ content: '❌ عذراً، اكتمل الحد الأقصى للاعبين!', flags: MessageFlags.Ephemeral });
                    }
                    players.set(i.user.id, i.user);
                    await i.update({ embeds: [buildLobbyEmbed()] });
                    return;
                }
                
                if (i.customId === 'leave_game') {
                    if (!players.has(i.user.id)) {
                        return i.reply({ content: '⚠️ أنت لست منضماً في اللعبة لتخرج منها!', flags: MessageFlags.Ephemeral });
                    }
                    players.delete(i.user.id);
                    await i.update({ embeds: [buildLobbyEmbed()] });
                    return;
                }
            } catch (err) {
                console.error('❌ خطأ أثناء جمع تفاعلات الانتظار:', err);
            }
        });

        collector.on('end', async () => {
            if (players.size < 2) {
                await sendToChannel(channel, {
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#e74c3c')
                            .setTitle('❌ إلغاء اللعبة')
                            .setDescription('انتهى الوقت ولم يكتمل الحد الأدنى المطلوب للاعبين (لاعبين على الأقل).')
                    ]
                });
                return;
            }

            const categoryNames = Object.keys(topicsOutOfLoop);
            const chosenCategory = selectedCategory || categoryNames[Math.floor(Math.random() * categoryNames.length)]!;
            const wordList = topicsOutOfLoop[chosenCategory]!;
            const secretWord = wordList[Math.floor(Math.random() * wordList.length)]!;

            const playerArray = Array.from(players.keys());
            const imposterId = playerArray[Math.floor(Math.random() * playerArray.length)]!;

            const gameStartEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🚀 بدأت لعبة برا السالفة!')
                .setDescription(
                    `التصنيف المختار: **${chosenCategory}**\n\n` +
                    `تم إرسال الكلمة السرية لكل لاعب في الخاص!\n` +
                    `⏱️ **سيبدأ الآن دور الأسئلة بين اللاعبين بالترتيب!**`
                );

            await sendToChannel(channel, { embeds: [gameStartEmbed] });

            // إرسال الكلمة السرية للخاص
            for (const pId of playerArray) {
                const user = players.get(pId);
                if (!user) continue;

                if (pId === imposterId) {
                    await user.send(`🤫 **أنت برا السالفة!**\nالتصنيف هو: **${chosenCategory}**\nحاول تخمين الكلمة من إجاباتهم واعرف السالفة!`).catch(() => {
                        sendToChannel(channel, { content: `⚠️ <@${pId}> الخاص لديك مغلق! لم نتمكن من إرسال حالتك في اللعبة.`, flags: MessageFlags.Ephemeral });
                    });
                } else {
                    await user.send(`💡 **السالفة هي:** **${secretWord}**\nالتصنيف: **${chosenCategory}**\nاسألوا بعضكم لكشف من هو برا السالفة!`).catch(() => {
                        sendToChannel(channel, { content: `⚠️ <@${pId}> الخاص لديك مغلق! لم نتمكن من إرسال الكلمة.`, flags: MessageFlags.Ephemeral });
                    });
                }
            }

            // --- دور الأسئلة ---
            const turnDurationMs = 60000; 
            
            for (let i = 0; i < playerArray.length; i++) {
                const p1 = playerArray[i]!; 
                const p2 = playerArray[(i + 1) % playerArray.length]!; 

                const skipButton = new ButtonBuilder()
                    .setCustomId(`skip_turn_${i}`)
                    .setLabel('التالي / تم السؤال والتنفيذ ⏭️')
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skipButton);

                const askEmbed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setTitle(`📢 دور الأسئلة [${i + 1}/${playerArray.length}]`)
                    .setDescription(`👉 <@${p1}> قم بتوجيه سؤال إلى <@${p2}> يتعلق بالسالفة!\n⏳ معك **دقيقة واحدة (60 ثانية)**، اضغط على الزر للتخطي فور الانتهاء.`);

                const roundMsg = await sendToChannel(channel, { embeds: [askEmbed], components: [row] });

                if (roundMsg) {
                    await new Promise<void>(resolve => {
                        const turnCollector = roundMsg.createMessageComponentCollector({
                            componentType: ComponentType.Button,
                            time: turnDurationMs
                        });

                        turnCollector.on('collect', async (bInt: ButtonInteraction) => {
                            if (bInt.user.id !== p1 && bInt.user.id !== p2) {
                                return bInt.reply({ content: '❌ فقط اللاعب المشارك في هذا الدور يمكنه تخطي الوقت!', flags: MessageFlags.Ephemeral });
                            }
                            await bInt.reply({ content: 'تم تخطي باقي الوقت والانتقال للدور التالي!', flags: MessageFlags.Ephemeral });
                            turnCollector.stop('skipped');
                        });

                        turnCollector.on('end', async () => {
                            skipButton.setDisabled(true);
                            await roundMsg.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(skipButton)] }).catch(() => {});
                            resolve();
                        });
                    });
                }
            }

            // --- مرحلة التصويت ---
            const voteSelect = new StringSelectMenuBuilder()
                .setCustomId('vote_imposter')
                .setPlaceholder('صوّت على من تعتقد أنه برا السالفة 🕵️‍♂️')
                .addOptions(playerArray.map(pId => {
                    const guild = 'guild' in channel ? channel.guild : null;
                    const member = guild?.members.cache.get(pId);
                    return new StringSelectMenuOptionBuilder()
                        .setLabel(member ? member.displayName : pId)
                        .setValue(pId);
                }));

            const voteRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(voteSelect);

            const voteEmbed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle('🗳️ انتهى وقت الأسئلة! حان وقت التصويت')
                .setDescription(`صوّتوا الآن لمعرفة من هو الشخص الذي **برا السالفة**! (أمامكم 60 ثانية)`);

            const voteMsg = await sendToChannel(channel, { embeds: [voteEmbed], components: [voteRow] });

            const votes: Record<string, number> = {};
            playerArray.forEach(id => votes[id] = 0);
            const playerVotes: Map<string, string> = new Map();

            if (!voteMsg) return;

            const voteCollector = voteMsg.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000
            });

            voteCollector.on('collect', async (vInt: StringSelectMenuInteraction) => {
                if (!players.has(vInt.user.id)) {
                    return vInt.reply({ content: '❌ أنت لست ضمن المشاركين في هذه اللعبة!', flags: MessageFlags.Ephemeral });
                }
                if (playerVotes.has(vInt.user.id)) {
                    return vInt.reply({ content: '⚠️ لقد قمت بالتصويت بالفعل!', flags: MessageFlags.Ephemeral });
                }

                const selected = vInt.values[0]!;
                playerVotes.set(vInt.user.id, selected);
                votes[selected] = (votes[selected] || 0) + 1;

                await vInt.reply({ content: '✅ تم تسجيل تصويتك بنجاح!', flags: MessageFlags.Ephemeral });

                if (playerVotes.size >= playerArray.length) {
                    voteCollector.stop();
                }
            });

            voteCollector.on('end', async () => {
                voteSelect.setDisabled(true);
                await voteMsg.edit({ components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(voteSelect)] }).catch(() => {});

                let maxVotes = 0;
                let mostVoted: string | null = null;
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

                const xpChanges: string[] = [];

                if (!isTie && mostVoted === imposterId) {
                    const lastChanceEmbed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('🚨 تم كشفك! فرصة التخمين الأخيرة')
                        .setDescription(`<@${imposterId}> لقد كشفك الجميع!\nأمامك **30 ثانية** لكتابة الكلمة السرية الصح في الشات العام لسرقة الفوز! (التصنيف: **${chosenCategory}**)`);

                    await sendToChannel(channel, { content: `<@${imposterId}>`, embeds: [lastChanceEmbed] });

                    let guessedSuccessfully = false;

                    await new Promise<void>(resolveGuess => {
                        if (typeof channel.createMessageCollector !== 'function') {
                            resolveGuess();
                            return;
                        }

                        const chatCollector = channel.createMessageCollector({
                            filter: (m: any) => m.author.id === imposterId,
                            time: 30000
                        });

                        chatCollector.on('collect', async (m: any) => {
                            if (m.content.trim().toLowerCase() === secretWord.toLowerCase()) {
                                guessedSuccessfully = true;
                                await m.react('🎉').catch(() => {});
                                chatCollector.stop();
                            }
                        });

                        chatCollector.on('end', () => {
                            resolveGuess();
                        });
                    });

                    if (guessedSuccessfully) {
                        const newXP = addXP(imposterId, 50);
                        xpChanges.push(`🎉 <@${imposterId}> (برا السالفة): +50 XP (المجموع: ${newXP}) [سرق الفوز بالتخمين!]`);

                        for (const [voterId] of playerVotes.entries()) {
                            const current = addXP(voterId, -10);
                            xpChanges.push(`❌ <@${voterId}>: -10 XP (المجموع: ${current})`);
                        }

                        return sendSummaryEmbed(channel, true, imposterId, secretWord, xpChanges, "سرق الشخص الذي برا السالفة الفوز بتخمين الكلمة في اللحظة الأخيرة!");
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

                        return sendSummaryEmbed(channel, false, imposterId, secretWord, xpChanges, "نجح الجميع في كشف الشخص الذي برا السالفة وفشل هو في التخمين!");
                    }
                } else {
                    const newXP = addXP(imposterId, 50);
                    xpChanges.push(`🎉 <@${imposterId}> (برا السالفة): +50 XP (المجموع: ${newXP}) [فاز بسبب التمويه]`);

                    for (const [voterId] of playerVotes.entries()) {
                        const current = addXP(voterId, -10);
                        xpChanges.push(`❌ <@${voterId}>: -10 XP (المجموع: ${current})`);
                    }

                    return sendSummaryEmbed(channel, true, imposterId, secretWord, xpChanges, "لم يتم الاتفاق على الشخص المطلوب وفاز برا السالفة!");
                }
            });
        });

    } catch (err) {
        console.error('❌ خطأ أثناء تشغيل لعبة برا السالفة:', err);
    }
}

async function sendSummaryEmbed(
    channel: any, 
    imposterWon: boolean, 
    imposterId: string, 
    secretWord: string, 
    xpChanges: string[], 
    details: string
): Promise<void> {
    const summaryEmbed = new EmbedBuilder()
        .setColor(imposterWon ? '#f1c40f' : '#2ecc71')
        .setTitle('📊 ملخص نتائج الجولة')
        .setDescription(
            `👤 **الشخص الذي كان برا السالفة:** <@${imposterId}>\n` +
            `💡 **الكلمة السرية:** **${secretWord}**\n` +
            `📝 **نتيجة الجولة:** ${details}\n\n` +
            `🏅 **نقاط الـ XP:**\n` +
            `${xpChanges.join('\n')}`
        )
        .setFooter({ text: 'برا السالفة v1.2 •' });

    await sendToChannel(channel, { embeds: [summaryEmbed] });
}
