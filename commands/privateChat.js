const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const PRIVATE_CHAT_CATEGORY_ID = process.env.PRIVATE_CHAT_CATEGORY_ID || 'ضع_هنا_ID_الكاتيجوري';
const BANNER_URL = 'https://i.imgur.com/G5gE334.png';

// 🧠 ذاكرة تخزين مخصصة لرادار البحث
const radarUsers = new Set();

// 1. لوحة التحكم الرئيسية
function getPrivateChatPanel() {
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('✦ انشاء دردشة خاصة')
        .setDescription(
            '✦ تمنحك هذه اللوحة القدرة الكاملة على إنشاء دردشتك الخاصة، حيث تتحكم بكل الصلاحيات: إضافة من تشاء، إزالة من لا ترغب به، مسح الشات، وحتى حذف الدردشة بالكامل 📑.\n\n' +
            '✦ الخصوصية في هذه الدردشات محفوظة لك في اختيار من يمكنه الدخول إليها 👤.\n\n' +
            '✦ أي دردشة خاصة تبقى خاملة 3 أيام ستُمحى تلقائياً 🧹.'
        )
        .setImage(BANNER_URL);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pc_create').setLabel('انشاء دردشة').setEmoji('💬').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pc_invite').setLabel('ارسال دعوة').setEmoji('✉️').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pc_radar').setLabel('رادار البحث').setEmoji('📡').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('pc_knock').setLabel('طرق الباب').setEmoji('🚪').setStyle(ButtonStyle.Success)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pc_zajel').setLabel('زاجل').setEmoji('🕊️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('pc_settings').setLabel('الإعدادات').setEmoji('🔔').setStyle(ButtonStyle.Danger)
    );

    return { embeds: [embed], components: [row1, row2, row3] };
}

// 2. لوحة التحكم داخل الروم الخاص
function getRoomControlPanel(owner) {
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('✦ دردشتك الخاصة')
        .setDescription(
            `✦ **المالك:** ${owner}\n\n` +
            '✦ الخصوصية في هذه الدردشات محفوظة لك في اختيار من يمكنه الدخول إليها.\n\n' +
            '✦ أي دردشة خاصة تبقى خاملة 3 أيام ستُمحى تلقائياً.\n\n' +
            '✦ استعمل الأزرار التالية للتحكم الكامل بدردشتك الخاصة.'
        )
        .setFooter({ text: 'الامبراطورية | Empire' })
        .setImage(BANNER_URL);

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('room_add_user').setLabel('اضافة عضو').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('room_remove_user').setLabel('ازالة عضو').setStyle(ButtonStyle.Primary)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('room_create_voice').setLabel('انشاء صوتي').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('room_transfer_owner').setLabel('نقل الملكية').setStyle(ButtonStyle.Secondary)
    );

    const row3 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('room_clear_chat').setLabel('مسح الشات').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('room_rename').setLabel('تغيير الاسم').setStyle(ButtonStyle.Secondary)
    );

    const row4 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('room_leave').setLabel('مغادرة الدردشة').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('room_delete').setLabel('حذف الدردشة').setStyle(ButtonStyle.Danger)
    );

    const row5 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('room_lock').setLabel('اغلاق الباب 🔒').setStyle(ButtonStyle.Danger)
    );

    return { content: `${owner}`, embeds: [embed], components: [row1, row2, row3, row4, row5] };
}

// بناء لوحة الرادار
function buildRadarResponse(guild, currentUserId) {
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('✦ رادار المحادثات')
        .setDescription(
            '• هنا ستجد الاشخاص المتاحين للدردشة حاليا !\n' +
            '• للانضمام للرادار واضافة اسمك اضغط انضمام'
        );

    const isJoined = radarUsers.has(currentUserId);
    const activeUsers = Array.from(radarUsers)
        .map(id => guild.members.cache.get(id))
        .filter(m => m !== undefined);

    let components = [];

    if (activeUsers.length === 0) {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pc_radar_select_disabled')
            .setPlaceholder('لا يوجد أشخاص متاحين حالياً')
            .setDisabled(true)
            .addOptions([{ label: 'خالي', value: 'none' }]);

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    } else {
        const options = activeUsers.slice(0, 25).map(m => ({
            label: m.displayName,
            description: `دعوته للمحادثة (${m.user.tag})`,
            value: m.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pc_radar_invite_user')
            .setPlaceholder('اختر شخصاً لإرسال دعوة له')
            .addOptions(options);

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    const toggleButton = new ButtonBuilder()
        .setCustomId(isJoined ? 'pc_radar_leave' : 'pc_radar_join')
        .setLabel(isJoined ? 'ازالة من الرادار' : 'الانضمام للرادار')
        .setStyle(isJoined ? ButtonStyle.Danger : ButtonStyle.Success);

    components.push(new ActionRowBuilder().addComponents(toggleButton));

    return { embeds: [embed], components, ephemeral: true };
}

// 3. معالج التفاعلات الرئيسي لجميع الأزرار والقوائم والـ Modals
async function handlePrivateChatInteraction(interaction) {
    const { customId, user } = interaction;

    try {
        // ==========================================
        // 📝 1. معالجة الـ Modals (إدخال النصوص)
        // ==========================================
        if (interaction.isModalSubmit()) {
            // زاجل
            if (customId.startsWith('pc_zajel_modal_')) {
                await interaction.deferReply({ ephemeral: true });
                const targetUserId = customId.split('_')[3];
                const messageText = interaction.fields.getTextInputValue('zajel_message');
                const targetUser = await interaction.client.users.fetch(targetUserId).catch(() => null);

                if (!targetUser) {
                    return interaction.editReply({ content: '❌ تعذر الوصول للطرف الآخر.' });
                }

                const zajelEmbed = new EmbedBuilder()
                    .setColor('#2b2d31')
                    .setTitle('🕊️ رسالة زاجل جديدة!')
                    .setDescription(`وصلتك رسالة مجهولة عبر نظام زاجل:\n\n> **${messageText}**`)
                    .setFooter({ text: 'رسالة سرية مجهولة المصدر' });

                try {
                    await targetUser.send({ embeds: [zajelEmbed] });
                    return interaction.editReply({ content: '✦ تم إرسال رسالة زاجل بنجاح ودون كشف هوياك! 🕊️' });
                } catch (err) {
                    return interaction.editReply({ content: '❌ لم نتمكن من إرسال الرسالة، قد تكون الرسائل الخاصة مغلقة لدى العضو.' });
                }
            }

            // تغيير اسم الغرفة
            if (customId === 'room_modal_rename') {
                await interaction.deferReply({ ephemeral: true });
                const newName = interaction.fields.getTextInputValue('room_new_name');
                try {
                    await interaction.channel.setName(`✧||💬・${newName}`);
                    return interaction.editReply({ content: `✅ تم تغيير اسم الدردشة إلى: **${newName}**` });
                } catch (err) {
                    return interaction.editReply({ content: '❌ حدث خطأ أثناء تغيير اسم الغرفة.' });
                }
            }
        }

        // ==========================================
        // 📩 2. معالجة تفاعلات الـ DM (دعوات وطرق الباب)
        // ==========================================
        if (customId && customId.startsWith('invite_accept_')) {
            await interaction.deferUpdate();
            const channelId = customId.split('_')[2];
            const channel = interaction.client.channels.cache.get(channelId);

            if (!channel) {
                return interaction.followUp({ content: '❌ هذه الدردشة لم تعد متاحة.', ephemeral: true });
            }

            try {
                await channel.permissionOverwrites.edit(user.id, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ content: `✦ تم قبول دعوة المراسلة !\n✦ للمراسلة توجه الى الدردشة الخاصة:\n\n${channel}`, ephemeral: true });
                return channel.send({ content: `قام ${user} بقبول دعوتك، هذه مساحة خاصة جديدة بينكما!` });
            } catch (err) {
                return interaction.followUp({ content: '❌ حدث خطأ أثناء إضافة الصلاحيات.', ephemeral: true });
            }
        }

        if (customId && customId.startsWith('invite_reject_')) {
            await interaction.update({ components: [] });
            return interaction.followUp({ content: '❌ تم رفض الدعوة.', ephemeral: true });
        }

        if (customId === 'invite_disable') {
            await interaction.update({ components: [] });
            return interaction.followUp({ content: '🔕 تم إيقاف تلقي الدعوات.', ephemeral: true });
        }

        if (customId && customId.startsWith('knock_accept_')) {
            await interaction.deferUpdate();
            const [, , targetUserId, channelId] = customId.split('_');
            const channel = interaction.client.channels.cache.get(channelId);

            if (!channel) return interaction.followUp({ content: '❌ الغرفة لم تعد موجودة.', ephemeral: true });

            try {
                await channel.permissionOverwrites.edit(targetUserId, {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true
                });

                await interaction.editReply({ components: [] });
                await interaction.followUp({ content: `✅ تم قبول طرق الباب وإدخال <@${targetUserId}> إلى الدردشة.`, ephemeral: true });
                return channel.send({ content: `🔔 تم قبول طلب الانضمام! مرحباً بك <@${targetUserId}> في الدردشة.` });
            } catch (err) {
                return interaction.followUp({ content: '❌ حدث خطأ أثناء إضافة العضو للغرفة.', ephemeral: true });
            }
        }

        if (customId && customId.startsWith('knock_reject_')) {
            await interaction.update({ components: [] });
            return interaction.followUp({ content: '❌ تم رفض طرق الباب.', ephemeral: true });
        }

        // يشترط أن يكون التفاعل داخل سيرفر للأوامر القادمة
        if (!interaction.guild) return;

        const { guild, channel, member } = interaction;

        // ==========================================
        // 🎛️ 3. لوحة التحكم الرئيسية (الأزرار الخارجية)
        // ==========================================

        // 💬 إنشاء غرفة
        if (customId === 'pc_create') {
            await interaction.deferReply({ ephemeral: true });
            const existingChannel = guild.channels.cache.find(ch => ch.topic === `PC_OWNER_${user.id}`);
            if (existingChannel) {
                return interaction.editReply({ content: `⚠️ لديك بالفعل غرفة خاصة مفتوحة: ${existingChannel}` });
            }

            try {
                const parentId = (PRIVATE_CHAT_CATEGORY_ID && PRIVATE_CHAT_CATEGORY_ID !== 'ضع_هنا_ID_الكاتيجوري') ? PRIVATE_CHAT_CATEGORY_ID : null;
                const newChannel = await guild.channels.create({
                    name: `✧||💬・${member.displayName}`,
                    type: ChannelType.GuildText,
                    parent: parentId,
                    topic: `PC_OWNER_${user.id}`,
                    permissionOverwrites: [
                        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                        {
                            id: user.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.ManageMessages,
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.ReadMessageHistory
                            ]
                        }
                    ]
                });

                await newChannel.send(getRoomControlPanel(user));
                return interaction.editReply({ content: `✦ تم انشاء دردشتك الخاصة: ${newChannel}` });
            } catch (error) {
                console.error('❌ خطأ أثناء إنشاء الغرفة الخاصة:', error);
                return interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء الغرفة. تأكد من إعدادات الرتب والكاتيجوري.' });
            }
        }

        // ✉️ إرسال دعوة
        if (customId === 'pc_invite') {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('pc_select_invite_user')
                .setPlaceholder('اختر العضو لإرسال الدعوة');
            return interaction.reply({ content: 'من تريد دعوته؟', components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
        }

        if (interaction.isUserSelectMenu() && customId === 'pc_select_invite_user') {
            await interaction.deferReply({ ephemeral: true });
            const targetUser = interaction.users.first();
            const userChannel = guild.channels.cache.find(ch => ch.topic === `PC_OWNER_${user.id}`);

            if (!userChannel) {
                return interaction.editReply({ content: '⚠️ يجب أن تمتلك غرفة خاصة أولاً لإرسال دعوة!' });
            }

            const inviteEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setDescription(`✦ **تلقيت دعوة مراسلة**\n✦ **من:** ${user}`)
                .setImage(BANNER_URL);

            const inviteButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`invite_accept_${userChannel.id}`).setLabel('قبول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`invite_reject_${userChannel.id}`).setLabel('رفض').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('invite_disable').setLabel('ايقاف تلقي الدعوات').setStyle(ButtonStyle.Secondary)
            );

            try {
                await targetUser.send({ embeds: [inviteEmbed], components: [inviteButtons] });
                return interaction.editReply({ content: `✦ تم ارسال دعوة المراسلة لـ ${targetUser} بنجاح` });
            } catch (err) {
                return interaction.editReply({ content: `❌ تعذر إرسال الدعوة لـ ${targetUser}، قد تكون رسائله الخاصة مغلقة.` });
            }
        }

        // 📡 رادار البحث
        if (customId === 'pc_radar') {
            return interaction.reply(buildRadarResponse(guild, user.id));
        }

        if (customId === 'pc_radar_join') {
            radarUsers.add(user.id);
            return interaction.update(buildRadarResponse(guild, user.id));
        }

        if (customId === 'pc_radar_leave') {
            radarUsers.delete(user.id);
            return interaction.update(buildRadarResponse(guild, user.id));
        }

        if (interaction.isStringSelectMenu() && customId === 'pc_radar_invite_user') {
            await interaction.deferReply({ ephemeral: true });
            const targetUserId = interaction.values[0];
            const targetUser = guild.members.cache.get(targetUserId);

            const userChannel = guild.channels.cache.find(ch => ch.topic === `PC_OWNER_${user.id}`);
            if (!userChannel) {
                return interaction.editReply({ content: '⚠️ يجب أن تمتلك غرفة خاصة أولاً لإرسال دعوة!' });
            }

            const inviteEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setDescription(`✦ **تلقيت دعوة مراسلة (عبر الرادار)**\n✦ **من:** ${user}`)
                .setImage(BANNER_URL);

            const inviteButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`invite_accept_${userChannel.id}`).setLabel('قبول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`invite_reject_${userChannel.id}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
            );

            try {
                await targetUser.send({ embeds: [inviteEmbed], components: [inviteButtons] });
                return interaction.editReply({ content: `✦ تم إرسال دعوة لـ ${targetUser} من قائمة الرادار بنجاح!` });
            } catch (err) {
                return interaction.editReply({ content: `❌ تعذر إرسال الدعوة لـ ${targetUser}.` });
            }
        }

        // 🚪 طرق الباب
        if (customId === 'pc_knock') {
            const privateChannels = guild.channels.cache.filter(ch => ch.topic && ch.topic.startsWith('PC_OWNER_'));

            if (privateChannels.size === 0) {
                return interaction.reply({ content: '⚠️ لا توجد أي دردشات خاصة مفتوحة حالياً لطرق بابها.', ephemeral: true });
            }

            const options = privateChannels.first(25).map(ch => {
                const ownerId = ch.topic.replace('PC_OWNER_', '');
                const ownerUser = guild.members.cache.get(ownerId)?.displayName || 'عضو';
                return {
                    label: ch.name.replace('✧||💬・', ''),
                    description: `المالك: ${ownerUser}`,
                    value: ch.id
                };
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('pc_select_knock_channel')
                .setPlaceholder('اختر الغرفة التي تريد طرق بابها')
                .addOptions(options);

            return interaction.reply({
                content: '🚪 اختر الدردشة الخاصة التي ترغب في استئذان صاحبها للدخول:',
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                ephemeral: true
            });
        }

        if (interaction.isStringSelectMenu() && customId === 'pc_select_knock_channel') {
            await interaction.deferReply({ ephemeral: true });

            const selectedChannelId = interaction.values[0];
            const targetChannel = guild.channels.cache.get(selectedChannelId);

            if (!targetChannel) return interaction.editReply({ content: '❌ هذه الغرفة لم تعد موجودة.' });

            const ownerId = targetChannel.topic?.replace('PC_OWNER_', '');
            const ownerMember = guild.members.cache.get(ownerId);

            if (!ownerMember) return interaction.editReply({ content: '❌ مالك الغرفة غير متواجد حالياً.' });
            if (ownerId === user.id) return interaction.editReply({ content: '⚠️ هذه الغرفة ملكك بالفعل!' });

            const knockEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('🚪 طرق باب!')
                .setDescription(`✦ يقف **${user}** عند باب دردشتك الخاصة (${targetChannel}) ويريد الدخول.`)
                .setImage(BANNER_URL);

            const knockButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`knock_accept_${user.id}_${targetChannel.id}`).setLabel('السماح بالدخول').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`knock_reject_${user.id}_${targetChannel.id}`).setLabel('رفض').setStyle(ButtonStyle.Danger)
            );

            try {
                await ownerMember.send({ embeds: [knockEmbed], components: [knockButtons] });
                return interaction.editReply({ content: `✦ تم طرق باب دردشة ${ownerMember} بنجاح! يرجى انتظار موافقته.` });
            } catch (err) {
                await targetChannel.send({ content: `${ownerMember}`, embeds: [knockEmbed], components: [knockButtons] });
                return interaction.editReply({ content: `✦ تم إرسال إشعار طرق الباب لمالك الدردشة بنجاح!` });
            }
        }

        // 🕊️ زاجل
        if (customId === 'pc_zajel') {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('pc_select_zajel_target')
                .setPlaceholder('اختر العضو المراد إرسال رسالة زاجل له');
            return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
        }

        if (interaction.isUserSelectMenu() && customId === 'pc_select_zajel_target') {
            const targetUser = interaction.users.first();

            const modal = new ModalBuilder()
                .setCustomId(`pc_zajel_modal_${targetUser.id}`)
                .setTitle(`إرسال زاجل إلى ${targetUser.username}`);

            const input = new TextInputBuilder()
                .setCustomId('zajel_message')
                .setLabel('اكتب رسالتك السرية هنا:')
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(1000)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // 🔔 الإعدادات
        if (customId === 'pc_settings') {
            return interaction.reply({ content: '🔔 إعدادات التنبيهات مفعّلة بشكل افتراضي.', ephemeral: true });
        }

        // ==========================================
        // 🏠 4. أزرار التحكم داخل الغرفة (اللوحة الداخليّة)
        // ==========================================

        // ➕ إضافة عضو
        if (customId === 'room_add_user') {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('room_select_add_user')
                .setPlaceholder('اختر العضو لإضافته للغرفة');
            return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
        }

        if (interaction.isUserSelectMenu() && customId === 'room_select_add_user') {
            const targetUser = interaction.users.first();
            await channel.permissionOverwrites.edit(targetUser.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            return interaction.reply({ content: `✅ تم إضافة ${targetUser} إلى الدردشة الخاصة.`, ephemeral: true });
        }

        // ➖ إزالة عضو
        if (customId === 'room_remove_user') {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('room_select_remove_user')
                .setPlaceholder('اختر العضو لإزالته');
            return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
        }

        if (interaction.isUserSelectMenu() && customId === 'room_select_remove_user') {
            const targetUser = interaction.users.first();
            await channel.permissionOverwrites.delete(targetUser.id);
            return interaction.reply({ content: `🚪 تم إزالة ${targetUser} من الدردشة الخاصة.`, ephemeral: true });
        }

        // 🎙️ إنشاء صوتي
        if (customId === 'room_create_voice') {
            await interaction.deferReply({ ephemeral: true });
            try {
                const voiceChannel = await guild.channels.create({
                    name: `🔊・صوتي ${member.displayName}`,
                    type: ChannelType.GuildVoice,
                    parent: channel.parentId,
                    permissionOverwrites: channel.permissionOverwrites.cache.map(p => ({
                        id: p.id,
                        allow: p.allow,
                        deny: p.deny
                    }))
                });
                return interaction.editReply({ content: `🎙️ تم إنشاء الغرفة الصوتية الخاصة بك: ${voiceChannel}` });
            } catch (err) {
                return interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء الغرفة الصوتية.' });
            }
        }

        // 👑 نقل الملكية
        if (customId === 'room_transfer_owner') {
            if (!channel.topic || !channel.topic.includes(`PC_OWNER_${user.id}`)) {
                return interaction.reply({ content: '❌ أنت لست مالك هذه الغرفة لنقل الملكية!', ephemeral: true });
            }
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('room_select_transfer_owner')
                .setPlaceholder('اختر المالك الجديد للغرفة');
            return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
        }

        if (interaction.isUserSelectMenu() && customId === 'room_select_transfer_owner') {
            const targetUser = interaction.users.first();
            await channel.setTopic(`PC_OWNER_${targetUser.id}`);
            return interaction.reply({ content: `👑 تم نقل ملكية هذه الغرفة بنجاح إلى ${targetUser}.` });
        }

        // 🧹 مسح الشات
        if (customId === 'room_clear_chat') {
            if (!channel.topic || !channel.topic.includes(`PC_OWNER_${user.id}`)) {
                return interaction.reply({ content: '❌ فقط مالك هذه الدردشة يمكنه مسح الشات!', ephemeral: true });
            }

            await interaction.deferReply({ ephemeral: true });
            try {
                const fetched = await channel.messages.fetch({ limit: 100 });
                const toDelete = fetched.filter(m => !m.embeds.some(e => e.title === '✦ دردشتك الخاصة'));
                await channel.bulkDelete(toDelete, true);
                return interaction.editReply({ content: '🧹 تم مسح رسائل الشات بنجاح.' });
            } catch (err) {
                return interaction.editReply({ content: '❌ تعذر مسح الرسائل القديمة تلقائياً (الرسائل أقدم من 14 يوماً).' });
            }
        }

        // ✏️ تغيير الاسم
        if (customId === 'room_rename') {
            if (!channel.topic || !channel.topic.includes(`PC_OWNER_${user.id}`)) {
                return interaction.reply({ content: '❌ فقط مالك الغرفة يمكنه تغيير اسمها!', ephemeral: true });
            }

            const modal = new ModalBuilder()
                .setCustomId('room_modal_rename')
                .setTitle('تغيير اسم الدردشة الخاصة');

            const input = new TextInputBuilder()
                .setCustomId('room_new_name')
                .setLabel('الاسم الجديد للغرفة:')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(input));
            return interaction.showModal(modal);
        }

        // 🚪 مغادرة الدردشة
        if (customId === 'room_leave') {
            if (channel.topic && channel.topic.includes(`PC_OWNER_${user.id}`)) {
                return interaction.reply({ content: '⚠️ مالك الغرفة لا يمكنه مغادرتها، يمكنك استعمال زر حذف الدردشة.', ephemeral: true });
            }
            await channel.permissionOverwrites.delete(user.id);
            await channel.send({ content: `🚪 غادر ${user} الدردشة الخاصة.` });
            return interaction.reply({ content: 'تمت مغادرة الدردشة بنجاح.', ephemeral: true });
        }

        // 🗑️ حذف الدردشة
        if (customId === 'room_delete') {
            if (!channel.topic || (!channel.topic.includes(`PC_OWNER_${user.id}`) && !member.permissions.has(PermissionFlagsBits.ManageChannels))) {
                return interaction.reply({ content: '❌ فقط مالك هذه الدردشة الخاصة يمكنه حذفها!', ephemeral: true });
            }

            await interaction.reply({ content: '🗑️ جاري حذف الدردشة الخاصة خلال 3 ثوانٍ...' });
            setTimeout(async () => {
                try {
                    await channel.delete();
                } catch (err) {
                    console.error('فشل حذف الغرفة:', err);
                }
            }, 3000);
            return;
        }

        // 🔒 إغلاق/فتح الباب
        if (customId === 'room_lock') {
            if (!channel.topic || !channel.topic.includes(`PC_OWNER_${user.id}`)) {
                return interaction.reply({ content: '❌ فقط مالك هذه الدردشة يمكنه إغلاق/فتح الباب!', ephemeral: true });
            }

            const isLocked = channel.permissionOverwrites.cache.get(guild.roles.everyone.id)?.deny.has(PermissionFlagsBits.SendMessages);
            
            if (isLocked) {
                await channel.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: null });
                return interaction.reply({ content: '🔓 تم فتح الباب للجميع.' });
            } else {
                await channel.permissionOverwrites.edit(guild.roles.everyone.id, { SendMessages: false });
                return interaction.reply({ content: '🔒 تم إغلاق الباب وخفّض صلاحية الإرسال.' });
            }
        }
    } catch (err) {
        console.error('❌ خطأ في التعامل مع تفاعلات الغرف الخاصة:', err);
    }
}

module.exports = {
    getPrivateChatPanel,
    handlePrivateChatInteraction
};
