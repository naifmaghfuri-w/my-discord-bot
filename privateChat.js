const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require('discord.js');

const PRIVATE_CHAT_CATEGORY_ID = 'ضع_هنا_ID_الكاتيجوري';
const BANNER_URL = 'https://i.imgur.com/G5gE334.png';

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

// 3. معالج التفاعلات المحدث
async function handlePrivateChatInteraction(interaction) {
    const { customId, user } = interaction;

    // --- 🟢 قبول / رفض الدعوة في الـ DM ---
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
            await interaction.followUp({ content: `✦ تم قبول دعوة المراسلة !\n✦ للمراسلة توجه الى الدردشة الخاصة:\n\n${channel}` });
            return channel.send({ content: `قام ${user} بقبول دعوتك، هذه مساحة خاصة جديدة بينكما!` });
        } catch (err) {
            console.error(err);
            return interaction.followUp({ content: '❌ حدث خطأ أثناء إضافة الصلاحيات.' });
        }
    }

    if (customId && customId.startsWith('invite_reject_')) {
        await interaction.update({ components: [] });
        return interaction.followUp({ content: '❌ تم رفض الدعوة.' });
    }

    if (customId === 'invite_disable') {
        await interaction.update({ components: [] });
        return interaction.followUp({ content: '🔕 تم إيقاف تلقي الدعوات.' });
    }

    // --- 🚪 قبول/رفض طرق الباب (تصل للمالك) ---
    if (customId && customId.startsWith('knock_accept_')) {
        await interaction.deferUpdate();
        const [, , targetUserId, channelId] = customId.split('_');
        const channel = interaction.guild?.channels.cache.get(channelId) || interaction.client.channels.cache.get(channelId);

        if (!channel) return interaction.followUp({ content: '❌ الغرفة لم تعد موجودة.', ephemeral: true });

        try {
            await channel.permissionOverwrites.edit(targetUserId, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });

            await interaction.editReply({ components: [] });
            await interaction.followUp({ content: `✅ تم قبول طرق الباب وإدخال <@${targetUserId}> إلى الدردشة.` });
            return channel.send({ content: `🔔 تم قبول طلب الانضمام! مرحباً بك <@${targetUserId}> في الدردشة.` });
        } catch (err) {
            console.error(err);
            return interaction.followUp({ content: '❌ حدث خطأ أثناء إضافة العضو للغرفة.' });
        }
    }

    if (customId && customId.startsWith('knock_reject_')) {
        await interaction.update({ components: [] });
        return interaction.followUp({ content: '❌ تم رفض طرق الباب.' });
    }

    // يتطلب وجود السيرفر لباقي الأوامر
    if (!interaction.guild) return;

    const { guild, channel, member } = interaction;

    // --- 🚪1. إظهار قائمة الرومات عند ضغط "طرق الباب" ---
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

    // --- 🚪2. إرسال طلب طرق الباب لمالك الغرفة المختارة ---
    if (interaction.isStringSelectMenu() && customId === 'pc_select_knock_channel') {
        await interaction.deferReply({ ephemeral: true });

        const selectedChannelId = interaction.values[0];
        const targetChannel = guild.channels.cache.get(selectedChannelId);

        if (!targetChannel) {
            return interaction.editReply({ content: '❌ هذه الغرفة لم تعد موجودة.' });
        }

        const ownerId = targetChannel.topic?.replace('PC_OWNER_', '');
        const ownerMember = guild.members.cache.get(ownerId);

        if (!ownerMember) {
            return interaction.editReply({ content: '❌ مالك الغرفة غير متواجد حالياً.' });
        }

        if (ownerId === user.id) {
            return interaction.editReply({ content: '⚠️ هذه الغرفة ملكك بالفعل!' });
        }

        // إرسال تنبيه في الخاص لمالك الغرفة أو داخل الغرفة نفسها
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
            // إذا كان الخاص مغلقاً يتم إرسال التنبيه في الغرفة الخاصة مباشرة
            await targetChannel.send({ content: `${ownerMember}`, embeds: [knockEmbed], components: [knockButtons] });
            return interaction.editReply({ content: `✦ تم إرسال إشعار طرق الباب لمالك الدردشة بنجاح!` });
        }
    }

    // --- 💬 إنشاء غرفة خاصة ---
    if (customId === 'pc_create') {
        await interaction.deferReply({ ephemeral: true });
        const existingChannel = guild.channels.cache.find(ch => ch.topic === `PC_OWNER_${user.id}`);
        if (existingChannel) {
            return interaction.editReply({ content: `⚠️ لديك بالفعل غرفة خاصة مفتوحة: ${existingChannel}` });
        }

        try {
            const newChannel = await guild.channels.create({
                name: `✧||💬・${member.displayName}`,
                type: ChannelType.GuildText,
                parent: PRIVATE_CHAT_CATEGORY_ID !== 'ضع_هنا_ID_الكاتيجوري' ? PRIVATE_CHAT_CATEGORY_ID : null,
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
            console.error(error);
            return interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء الغرفة.' });
        }
    }

    // --- ✉️ إرسال دعوة ---
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

    // --- 🗑️ حذف الدردشة ---
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

    // --- 🧹 مسح الشات ---
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
            return interaction.editReply({ content: '❌ تعذر مسح الرسائل القديمة (أكثر من 14 يوم).' });
        }
    }

    // --- ➕ إضافة عضو ---
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

    // --- ➖ إزالة عضو ---
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

    // --- 🚪 مغادرة الدردشة ---
    if (customId === 'room_leave') {
        if (channel.topic && channel.topic.includes(`PC_OWNER_${user.id}`)) {
            return interaction.reply({ content: '⚠️ مالك الغرفة لا يمكنه مغادرتها، يمكنك استعمال زر حذف الدردشة.', ephemeral: true });
        }
        await channel.permissionOverwrites.delete(user.id);
        await channel.send({ content: `🚪 غادر ${user} الدردشة الخاصة.` });
        return interaction.reply({ content: 'تمت مغادرة الدردشة بنجاح.', ephemeral: true });
    }
}

module.exports = {
    getPrivateChatPanel,
    handlePrivateChatInteraction
};
