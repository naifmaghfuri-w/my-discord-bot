import { 
    Message, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType,
    Interaction,
    ButtonInteraction,
    StringSelectMenuInteraction,
    User
} from 'discord.js';

export interface LocationDetails {
    crime_scenes: string[];
    innocent_spots: string[];
}

export type LocationsData = Record<string, LocationDetails>;

export type RoleType = 'killer' | 'doctor' | 'informant' | 'detective' | 'citizen';

export interface PlayerRoleData {
    role: RoleType;
    spot: string;
    name: string;
    extra?: string;
}

const LOCATIONS_DATA: LocationsData = {
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

const NIGHT_EVENTS: string[] = [
    "⚡ **انقطاع التيار الكهربائي:** انطفأت الأنوار لفترة وجيزة، مما جعل بعض التبريرات غامضة!",
    "📹 **تسجيل كاميرات المراقبة:** رصدت الكاميرات حركة مشبوهة بالقرب من مسرح الجريمة!",
    "👣 **أثر قدم ملطخ:** تم العثور على آثار أقدام تتجه بعيداً عن موقع الجثة!",
    "🌧️ **أجواء عاصفة:** تعذر على البعض سماع الأصوات القريبة أثناء وقوع الجريمة."
];

const LOBBY_WAIT_TIME_SECONDS = 30;

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

function createChunkedButtons(buttons: ButtonBuilder[], maxPerRow = 5): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += maxPerRow) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + maxPerRow)));
    }
    return rows;
}

export async function startDetectiveGame(
    selectInteraction: StringSelectMenuInteraction | ButtonInteraction, 
    initialInteraction: Interaction
): Promise<void> {
    try {
        const playerInteractions = new Map<string, StringSelectMenuInteraction | ButtonInteraction>();
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

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton);

        function buildLobbyEmbed(): EmbedBuilder {
            const count = playerInteractions.size;
            const playersList = Array.from(playerInteractions.keys());

            const playersText = count > 0 
                ? playersList.map((id, index) => `**#${index + 1}** - <@${id}>`).join('\n')
                : 'لا يوجد مشتبه بهم مشاركين حالياً.';

            return new EmbedBuilder()
                .setColor('#2c3e50')
                .setTitle('🕵️‍♂️ لعبة المحققين')
                .setDescription(
                    `**طريقة اللعب:**\n` +
                    `**1-** انضم للقضية عبر الأزرار أدناه.\n` +
                    `**2-** عند انتهاء الوقت، سيصلك دورك وموقعك تلقائياً برسالة خاصة داخل الروم.\n` +
                    `**3-** تنفيذ المهام للمجرم والطبيب سيكون في مرحلة الأهداف المخصصة.\n\n` +
                    `📋 **المشاركون (${count}/20):**\n${playersText}\n\n` +
                    `⏳ **ستبدأ القضية <t:${startTime}:R>**`
                );
        }

        let mainMessage: Message | null = null;
        if (selectInteraction.replied || selectInteraction.deferred) {
            mainMessage = await selectInteraction.editReply({ 
                embeds: [buildLobbyEmbed()], 
                components: [row] 
            });
        } else {
            mainMessage = await selectInteraction.update({ 
                embeds: [buildLobbyEmbed()], 
                components: [row],
                fetchReply: true 
            });
        }

        const channel = initialInteraction.channel || selectInteraction.channel;

        if (!channel) {
            console.error('❌ تعذر العثور على القناة لبدء اللعبة.');
            return;
        }

        const lobbyCollector = (channel as any).createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: LOBBY_WAIT_TIME_SECONDS * 1000 
        });

        lobbyCollector.on('collect', async (i: ButtonInteraction) => {
            try {
                if (i.customId === 'det_join') {
                    if (playerInteractions.has(i.user.id)) {
                        await i.reply({ content: '❌ أنت منضم بالفعل في هذه القضية!', ephemeral: true });
                        return;
                    }
                    if (playerInteractions.size >= 20) {
                        await i.reply({ content: '❌ اكتمل العدد الأقصى للاعبين (20)!', ephemeral: true });
                        return;
                    }

                    playerInteractions.set(i.user.id, i);
                    await i.update({ embeds: [buildLobbyEmbed()] });
                }

                if (i.customId === 'det_leave') {
                    if (!playerInteractions.has(i.user.id)) {
                        await i.reply({ content: '❌ أنت لست مسجلاً في القائمة لتنسحب!', ephemeral: true });
                        return;
                    }
                    
                    playerInteractions.delete(i.user.id);
                    await i.update({ embeds: [buildLobbyEmbed()] });
                }
            } catch (err: unknown) {
                console.error('❌ خطأ في أزرار الانتظار بلعبة المحققين:', err);
            }
        });

        lobbyCollector.on('end', async () => {
            joinButton.setDisabled(true);
            leaveButton.setDisabled(true);
            
            if (mainMessage) {
                await mainMessage.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton, leaveButton)] }).catch(() => {});
            }

            if (playerInteractions.size < 2) {
                await sendToChannel(channel, { 
                    content: '❌ **تم إلغاء القضية!** لم ينضم عدد كافٍ من المشتبه بهم (يلزم 2 على الأقل).' 
                });
                return;
            }

            await runDetectiveRound(channel, playerInteractions);
        });

    } catch (err: unknown) {
        console.error('❌ خطأ أثناء بدء لعبة المحققين:', err);
    }
}

async function runDetectiveRound(
    channel: any, 
    playerInteractions: Map<string, StringSelectMenuInteraction | ButtonInteraction>
): Promise<void> {
    try {
        const playerList: User[] = Array.from(playerInteractions.keys()).map(id => playerInteractions.get(id)!.user);

        const locationNames = Object.keys(LOCATIONS_DATA);
        const locationName = locationNames[Math.floor(Math.random() * locationNames.length)]!;
        const locationInfo = LOCATIONS_DATA[locationName]!;
        const crimeScene = locationInfo.crime_scenes[Math.floor(Math.random() * locationInfo.crime_scenes.length)]!;

        const shuffled: User[] = [...playerList].sort(() => Math.random() - 0.5);

        const killer = shuffled.pop()!;
        const doctor = shuffled.pop() || killer;
        const informant = shuffled.pop() || killer;
        const detectives: User[] = shuffled.splice(0, Math.min(3, shuffled.length));
        const citizens: User[] = shuffled;

        const rolesData: Record<string, PlayerRoleData> = {};
        const playerSpots: Record<string, string> = {};

        rolesData[killer.id] = { role: 'killer', spot: 'مسرح الجريمة', extra: crimeScene, name: 'المجرم 🩸' };

        if (doctor.id !== killer.id) {
            const docSpot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)]!;
            rolesData[doctor.id] = { role: 'doctor', spot: docSpot, name: 'الطبيب 🩺' };
            playerSpots[doctor.id] = docSpot;
        }

        if (informant.id !== killer.id) {
            const informantSpot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)]!;
            const hints = [
                `المجرم يتواجد في المكان العام (${locationName}).`,
                `المجرم ليس في نفس موقعك الحالي (${informantSpot}).`,
                `الجريمة تم التخطيط لها بالقرب من: ${crimeScene}.`
            ];
            const extraHint = hints[Math.floor(Math.random() * hints.length)]!;
            rolesData[informant.id] = { role: 'informant', spot: informantSpot, extra: extraHint, name: 'المخبر السري 🔍' };
            playerSpots[informant.id] = informantSpot;
        }

        detectives.forEach(det => {
            const spot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)]!;
            rolesData[det.id] = { role: 'detective', spot, name: 'محقق 🔎' };
            playerSpots[det.id] = spot;
        });

        citizens.forEach(cit => {
            const spot = locationInfo.innocent_spots[Math.floor(Math.random() * locationInfo.innocent_spots.length)]!;
            rolesData[cit.id] = { role: 'citizen', spot, name: 'مواطن عادي 👤' };
            playerSpots[cit.id] = spot;
        });

        await sendToChannel(channel, `🎭 **انتهى وقت الانضمام! تم توزيع الأوراق والأماكن تلقائيًا لكل لاعب.**`);

        for (const [userId, interaction] of playerInteractions.entries()) {
            const data = rolesData[userId]!;
            let infoText = "";

            if (data.role === 'killer') {
                infoText = `🕵️‍♂️ **دورك:** المجرم!\n📍 **موقعك:** مسرح الجريمة\n📍 **مسرح الجريمة المقرر:** ${data.extra}`;
            } else if (data.role === 'doctor') {
                infoText = `🩺 **دورك:** الطبيب الشرعي!\n📍 **موقعك:** ${data.spot}`;
            } else if (data.role === 'informant') {
                infoText = `🔍 **دورك:** المخبر السري!\n📍 **موقعك:** ${data.spot}\n💡 **تلميح خاص لك:** ${data.extra}`;
            } else if (data.role === 'detective') {
                infoText = `🔎 **دورك:** محقق جنائي!\n📍 **موقعك:** ${data.spot}\n💡 *استجوب المشتبه بهم للوصول للجاني!*`;
            } else {
                infoText = `👤 **دورك:** مواطن عادي\n📍 **موقعك:** ${data.spot}\n💡 *أثبت براءتك باختيار موقعك وساعد المحققين!*`;
            }

            try {
                if (interaction.followUp && !interaction.replied) {
                    await interaction.followUp({
                        content: `📌 **بطاقة أوراقك السرية للجولة:**\n${infoText}`,
                        ephemeral: true
                    });
                } else {
                    await interaction.user.send(`📌 **بطاقة أوراقك السرية للجولة:**\n${infoText}`);
                }
            } catch (e) {
                await interaction.user.send(`📌 **بطاقة أوراقك السرية للجولة:**\n${infoText}`).catch(() => {});
            }
        }

        let selectedKillTarget: User | null = null;
        let selectedProtectTarget: User | null = null;

        const actionBtn = new ButtonBuilder()
            .setCustomId('open_target_menu')
            .setLabel('تنفيذ المهمة (الهدف) 🎯')
            .setStyle(ButtonStyle.Danger);

        const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(actionBtn);

        const actionMsg = await sendToChannel(channel, {
            content: "🌙 **مرحلة الأهداف والمهام السرية:** أمام أصحاب المهام (المجرم والطبيب) 25 ثانية لتحديد الأهداف!",
            components: [actionRow]
        });

        const actionCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 25000 });

        actionCollector.on('collect', async (i: ButtonInteraction) => {
            try {
                if (!playerList.some(p => p.id === i.user.id)) {
                    await i.reply({ content: '❌ أنت لست مشاركاً في هذه الجولة!', ephemeral: true });
                    return;
                }

                if (i.customId === 'open_target_menu') {
                    const data = rolesData[i.user.id]!;

                    if (data.role === 'killer') {
                        const targets = playerList.filter(p => p.id !== killer.id);
                        const buttons = targets.map(p => 
                            new ButtonBuilder()
                                .setCustomId(`kill_target_${p.id}`)
                                .setLabel(p.displayName || p.username)
                                .setStyle(ButtonStyle.Danger)
                        );
                        await i.reply({ content: '🩸 **اختر الضحية:**', components: createChunkedButtons(buttons), ephemeral: true });
                        return;

                    } else if (data.role === 'doctor') {
                        const buttons = playerList.map(p => 
                            new ButtonBuilder()
                                .setCustomId(`protect_target_${p.id}`)
                                .setLabel(p.displayName || p.username)
                                .setStyle(ButtonStyle.Success)
                        );
                        await i.reply({ content: '🛡️ **اختر الشخص المراد حمايته:**', components: createChunkedButtons(buttons), ephemeral: true });
                        return;

                    } else {
                        await i.reply({ content: '⚠️ ليس لديك مهمة خاصة لتنفيذها هذه الليلة، انتظر مرحلة التحقيق!', ephemeral: true });
                        return;
                    }
                }

                if (i.customId.startsWith('kill_target_')) {
                    if (i.user.id !== killer.id) {
                        await i.reply({ content: '❌ هذا الخيار خاص بالمجرم فقط!', ephemeral: true });
                        return;
                    }
                    const targetId = i.customId.replace('kill_target_', '');
                    selectedKillTarget = playerList.find(p => p.id === targetId) || null;
                    if (selectedKillTarget) {
                        await i.update({ content: `🎯 تم اختيار هدفك: **${selectedKillTarget.displayName || selectedKillTarget.username}** بنجاح!`, components: [] });
                    }
                    return;
                }

                if (i.customId.startsWith('protect_target_')) {
                    if (i.user.id !== doctor.id) {
                        await i.reply({ content: '❌ هذا الخيار خاص بالطبيب فقط!', ephemeral: true });
                        return;
                    }
                    const targetId = i.customId.replace('protect_target_', '');
                    selectedProtectTarget = playerList.find(p => p.id === targetId) || null;
                    if (selectedProtectTarget) {
                        await i.update({ content: `🛡️ اخترت حماية: **${selectedProtectTarget.displayName || selectedProtectTarget.username}** بنجاح!`, components: [] });
                    }
                    return;
                }
            } catch (err: unknown) {
                console.error('❌ خطأ أثناء تحديد الأهداف:', err);
            }
        });

        await new Promise<void>(resolve => actionCollector.on('end', () => resolve()));

        actionBtn.setDisabled(true);
        if (actionMsg) {
            await actionMsg.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(actionBtn)] }).catch(() => {});
        }

        const targets = playerList.filter(p => p.id !== killer.id);
        if (!selectedKillTarget && targets.length > 0) {
            selectedKillTarget = targets[Math.floor(Math.random() * targets.length)] || null;
        }

        const currentEvent = NIGHT_EVENTS[Math.floor(Math.random() * NIGHT_EVENTS.length)]!;
        let activePlayers: User[] = [];

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
            await sendToChannel(channel, { embeds: [embed] });
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
            activePlayers = playerList.filter(p => p.id !== selectedKillTarget!.id);
            await sendToChannel(channel, { embeds: [embed] });
        } else {
            activePlayers = [...playerList];
        }

        const skipVotes = new Set<string>();
        const usedEmergency = new Set<string>();
        const SKIP_REQUIRED = Math.ceil(activePlayers.length / 2);
        const investEndTime = Math.floor((Date.now() + 90000) / 1000);

        const skipButton = new ButtonBuilder()
            .setCustomId('skip_investigation')
            .setLabel(`تخطي التحقيق ⏩ (0/${SKIP_REQUIRED})`)
            .setStyle(ButtonStyle.Secondary);

        const emergencyButton = new ButtonBuilder()
            .setCustomId('emergency_meeting')
            .setLabel(`استدعى طارئ 🚨`)
            .setStyle(ButtonStyle.Danger);

        const investRow = new ActionRowBuilder<ButtonBuilder>().addComponents(skipButton, emergencyButton);

        const investMsg = await sendToChannel(channel, {
            content: `⏳ **بدأ وقت التحقيق!** ينتهي التحقيق <t:${investEndTime}:R>\nأمامكم وقت لمناقشة الأماكن والتبريرات.`,
            components: [investRow]
        });

        let skipEarly = false;
        // ✅ صراحة تحديد النوع هنا تجنباً للخطأ
        let emergencyCalledBy: User | null = null;

        const investCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 90000 });

        investCollector.on('collect', async (i: ButtonInteraction) => {
            try {
                if (!activePlayers.some(p => p.id === i.user.id)) {
                    await i.reply({ content: '❌ يمكن للاعبين الأحياء فقط التفاعل أثناء التحقيق!', ephemeral: true });
                    return;
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
                    if (investMsg) {
                        await investMsg.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(skipButton, emergencyButton)] }).catch(() => {});
                    }

                    if (skipVotes.size >= SKIP_REQUIRED) {
                        skipEarly = true;
                        investCollector.stop('skipped');
                    }
                }

                if (i.customId === 'emergency_meeting') {
                    if (usedEmergency.has(i.user.id)) {
                        await i.reply({ content: '❌ لقد استخدمت زر الاستدعاء الطارئ سابقاً!', ephemeral: true });
                        return;
                    }

                    usedEmergency.add(i.user.id);
                    emergencyCalledBy = i.user;
                    await i.reply({ content: '🚨 قمت بطلب اجتماع طارئ قطعاً للتحقيق!' });
                    investCollector.stop('emergency');
                }
            } catch (err: unknown) {
                console.error('❌ خطأ في أزرار التحقيق:', err);
            }
        });

        await new Promise<void>(resolve => investCollector.on('end', () => resolve()));

        skipButton.setDisabled(true);
        emergencyButton.setDisabled(true);
        if (investMsg) {
            await investMsg.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(skipButton, emergencyButton)] }).catch(() => {});
        }

        // ✅ تم تعديل هذا الجزء للتعامل مع المتغير بدون خطأ TypeScript
        if (emergencyCalledBy) {
            const caller = emergencyCalledBy as User;
            await sendToChannel(channel, `🚨 **اجتماع طارئ!** قام <@${caller.id}> بقطع وقت التحقيق للذهاب للتصويت فوراً!`);
        } else if (skipEarly) {
            await sendToChannel(channel, "⏩ **اكتمل نصاب التخطي! الانتقال للتصويت فوراً.**");
        }

        const userVotesMap = new Map<string, string>(); 
        const voteCounts: Record<string, number> = {};
        activePlayers.forEach(p => voteCounts[p.id] = 0);
        let skipVoteCount = 0;
        const voteEndTime = Math.floor((Date.now() + 30000) / 1000);

        function buildVoteRows(isDisabled = false): ActionRowBuilder<ButtonBuilder>[] {
            const buttons: ButtonBuilder[] = [];

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

        const voteMsg = await sendToChannel(channel, {
            content: `🗳️ **مرحلة التصويت!** ينتهي التصويت <t:${voteEndTime}:R>\nاختر المشتبه به لنقله لمرحلة المحاكمة:`,
            components: buildVoteRows(false)
        });

        const voteCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        voteCollector.on('collect', async (vInteraction: ButtonInteraction) => {
            try {
                if (!vInteraction.customId.startsWith('vote_')) return;

                if (!activePlayers.some(p => p.id === vInteraction.user.id)) {
                    await vInteraction.reply({ content: '❌ أنت لست ضمن المشاركين الأحياء!', ephemeral: true });
                    return;
                }

                const userId = vInteraction.user.id;

                if (vInteraction.customId !== 'vote_skip') {
                    const targetId = vInteraction.customId.replace('vote_', '');
                    if (targetId === userId) {
                        await vInteraction.reply({ content: '❌ لا يمكنك التصويت ضد نفسك!', ephemeral: true });
                        return;
                    }
                }

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

                    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
                    userVotesMap.set(userId, targetId);
                    
                    const targetUser = activePlayers.find(p => p.id === targetId);
                    await vInteraction.reply({ content: `تم تصويتك ضد **${targetUser ? targetUser.displayName || targetUser.username : 'المشتبه به'}**!`, ephemeral: true });
                }

                if (voteMsg) {
                    await voteMsg.edit({ components: buildVoteRows(false) }).catch(() => {});
                }

                if (userVotesMap.size >= activePlayers.length) {
                    voteCollector.stop();
                }
            } catch (err: unknown) {
                console.error('❌ خطأ أثناء التصويت:', err);
            }
        });

        await new Promise<void>(resolve => voteCollector.on('end', () => resolve()));
        if (voteMsg) {
            await voteMsg.edit({ components: buildVoteRows(true) }).catch(() => {});
        }

        let maxVotes = 0;
        let topCandidate: string | null = null;
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

        let finalConvictedCandidate: string | null = null;

        if (topCandidate && !isTie) {
            const accusedUser: User | undefined = activePlayers.find(p => p.id === topCandidate);

            if (accusedUser) {
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

                await sendToChannel(channel, { embeds: [defenseEmbed] });

                await new Promise(resolve => setTimeout(resolve, 50000));

                const confirmVotes = { execute: 0, pardon: 0 };
                const confirmedVoters = new Set<string>();

                const executeBtn = new ButtonBuilder()
                    .setCustomId('confirm_execute')
                    .setLabel('طرد المتهم ❌')
                    .setStyle(ButtonStyle.Danger);

                const pardonBtn = new ButtonBuilder()
                    .setCustomId('confirm_pardon')
                    .setLabel('منح العفو 🕊️')
                    .setStyle(ButtonStyle.Success);

                const trialRow = new ActionRowBuilder<ButtonBuilder>().addComponents(executeBtn, pardonBtn);

                const trialMsg = await sendToChannel(channel, {
                    content: `⚖️ **انتهى وقت الدفاع!** صوّتوا الآن على مصير <@${accusedUser.id}>:`,
                    components: [trialRow]
                });

                const trialCollector = channel.createMessageComponentCollector({ componentType: ComponentType.Button, time: 20000 });

                trialCollector.on('collect', async (tInt: ButtonInteraction) => {
                    try {
                        if (!activePlayers.some(p => p.id === tInt.user.id)) {
                            await tInt.reply({ content: '❌ يمكن للاعبين الأحياء فقط المشاركة في الحكم!', ephemeral: true });
                            return;
                        }

                        if (tInt.user.id === accusedUser.id) {
                            await tInt.reply({ content: '❌ لا يمكنك التصويت في محاكمتك الخاصة!', ephemeral: true });
                            return;
                        }

                        if (confirmedVoters.has(tInt.user.id)) {
                            await tInt.reply({ content: '❌ لقد أصدرت حكمك بالفعل!', ephemeral: true });
                            return;
                        }

                        confirmedVoters.add(tInt.user.id);

                        if (tInt.customId === 'confirm_execute') {
                            confirmVotes.execute++;
                            await tInt.reply({ content: 'صوّت لـ **طرد المتهم**.', ephemeral: true });
                        } else {
                            confirmVotes.pardon++;
                            await tInt.reply({ content: 'صوّت لـ **منح العفو**.', ephemeral: true });
                        }
                    } catch (err: unknown) {
                        console.error('❌ خطأ في تصويت المحاكمة:', err);
                    }
                });

                await new Promise<void>(resolve => trialCollector.on('end', () => resolve()));

                executeBtn.setDisabled(true);
                pardonBtn.setDisabled(true);
                if (trialMsg) {
                    await trialMsg.edit({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(executeBtn, pardonBtn)] }).catch(() => {});
                }

                if (confirmVotes.execute > confirmVotes.pardon) {
                    finalConvictedCandidate = topCandidate;
                    await sendToChannel(channel, `⚖️ **أصدرت المحكمة حكمها!** تم تأكيد طرد <@${accusedUser.id}> بأغلبية الأصوات.`);
                } else {
                    await sendToChannel(channel, `🕊️ **تم منح العفو!** قررت الأغلبية قبول دفاع <@${accusedUser.id}> ولم يتم طرده.`);
                }
            }
        }

        const rolesSummary = playerList.map((p: User) => {
            const data = rolesData[p.id]!;
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

        await sendToChannel(channel, { embeds: [resultEmbed] });

    } catch (err: unknown) {
        console.error('❌ خطأ في تشغيل جولة المحققين:', err);
    }
}
