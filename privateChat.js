const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits, 
    StringSelectMenuBuilder, 
    UserSelectMenuBuilder,
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

// 3. معالجة التفاعلات
async function handlePrivateChatInteraction(interaction) {
    if (!interaction.guild && !interaction.isButton()) return;

    const { customId, guild, member, user } = interaction;

    // --- ✉️ فتح قائمة اختيار العضو للدعوة ---
    if (customId === 'pc_invite') {
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('pc_select_invite_user')
            .setPlaceholder('اختر العضو لإرسال الدعوة');

        const row = new ActionRowBuilder().addComponents(userSelect);
        return interaction.reply({ content: 'من تريد دعوته؟', components: [row], ephemeral: true });
    }

    // --- 📩 إرسال الدعوة إلى الخاص (DM) عند اختيار العضو ---
    if (interaction.isUserSelectMenu() && customId === 'pc_select_invite_user') {
        await interaction.deferReply({ ephemeral: true });

        const targetUser = interaction.users.first();
        const userChannel = guild.channels.cache.find(ch => ch.topic === `PC_OWNER_${user.id}`);

        if (!userChannel) {
            return interaction.editReply({ content: '⚠️ يجب أن تمتلك غرفة خاصة أولاً لإرسال دعوة!' });
        }

        // إنشاء إمبد الدعوة للخاص المطابق للصورة الأولى
        const inviteEmbed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setDescription(
                `✦ **تلقيت دعوة مراسلة**\n` +
                `✦ **من:** ${user}`
            )
            .setImage(BANNER_URL);

        const inviteButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`invite_accept_${userChannel.id}_${user.id}`).setLabel('قبول').setStyle(ButtonStyle.Success),
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

    // --- 🟢 قبول الدعوة من الخاص (DM) ---
    if (customId && customId.startsWith('invite_accept_')) {
        const [, , channelId, inviterId] = customId.split('_');
        const channel = interaction.client.channels.cache.get(channelId);

        if (!channel) {
            return interaction.reply({ content: '❌ هذه الدردشة لم تعد متاحة.', ephemeral: true });
        }

        // إعطاء العضو صلاحية الدخول
        await channel.permissionOverwrites.edit(user.id, {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true
        });

        // تحديث رسالة الخاص بالقبول (مطابق للصورة الثانية)
        await interaction.update({ components: [] });
        await interaction.followUp({
            content: `✦ تم قبول دعوة المراسلة !\n✦ للمراسلة توجه الى الدردشة الخاصة:\n\n${channel}`
        });

        // إرسال إشعار داخل الغرفة الخاصة (مطابق للصورة الرابعة)
        return channel.send({
            content: `قام ${user} بقبول دعوتك، هذه مساحة خاصة جديدة بينكما!`
        });
    }

    // --- 🔴 رفض الدعوة من الخاص (DM) ---
    if (customId && customId.startsWith('invite_reject_')) {
        await interaction.update({ components: [] });
        return interaction.followUp({ content: '❌ تم رفض الدعوة.' });
    }

    // --- ⚙️ باقي التفاعلات (إنشاء غرفة، طرق الباب، إلخ) ---
    if (customId === 'pc_create') {
        await interaction.deferReply({ ephemeral: true });

        const existingChannel = guild.channels.cache.find(ch => ch.topic === `PC_OWNER_${user.id}`);
        if (existingChannel) {
            return interaction.editReply({ content: `⚠️ لديك بالفعل غرفة خاصة مفتوحة: ${existingChannel}` });
        }

        try {
            const channel = await guild.channels.create({
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

            const roomPanelData = getRoomControlPanel(user);
            await channel.send(roomPanelData);

            return interaction.editReply({ content: `✦ تم انشاء دردشتك الخاصة: ${channel}` });
        } catch (error) {
            console.error(error);
            return interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء الغرفة.' });
        }
    }
}

module.exports = {
    getPrivateChatPanel,
    handlePrivateChatInteraction
};
