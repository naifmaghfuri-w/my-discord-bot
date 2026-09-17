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

// 🔴 ضع هنا ID الكاتيجوري (القسم) الذي تريد إنشاء الرومات فيه
const PRIVATE_CHAT_CATEGORY_ID = '1406728181456830524';

// 🖼️ رابط صورة شغال بديل (يمكنك استبداله بأي رابط مباشر)
const BANNER_URL = 'https://i.imgur.com/G5gE334.png';

// 1. بناء لوحة التحكم الرئيسية (الخارجية)
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

// 2. بناء لوحة التحكم داخل الروم الخاص
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
        .setFooter({ text: 'SunRise' })
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

// 3. بناء لوحة الإعدادات الخاصة بالإشعارات (المطابقة للصورة الثانية)
function getSettingsPanel() {
    const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('✱ لوحة التحكم بالاشعارات والدعوات')
        .setDescription(
            'هنا يمكنك التحكم بـ الاشعارات والدعوات التي تتلقاها\n' +
            'اختار الزر المناسب للتفعيل او التعطيل\n\n' +
            '✉️ **زاجل:** استقبال رسائل زاجل من الاعضاء\n' +
            '🚪 **الدعوات:** استقبال دعوات الانضمام للدردشات الخاصة'
        )
        .setFooter({ text: 'SunRise' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('toggle_invites').setLabel('الدعوات: مفعل').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('toggle_zajel').setLabel('زاجل: مفعل').setStyle(ButtonStyle.Success)
    );

    return { embeds: [embed], components: [row], ephemeral: true };
}

// 4. معالجة التفاعلات
async function handlePrivateChatInteraction(interaction) {
    if (!interaction.guild) return;

    const { customId, guild, member, user } = interaction;

    // --- 🔔 زر الإعدادات ---
    if (customId === 'pc_settings') {
        const settingsData = getSettingsPanel();
        return interaction.reply(settingsData);
    }

    // --- 💬 إنشاء دردشة جديدة ---
    if (customId === 'pc_create') {
        await interaction.deferReply({ ephemeral: true });

        const existingChannel = guild.channels.cache.find(
            ch => ch.topic === `PC_OWNER_${user.id}`
        );

        if (existingChannel) {
            return interaction.editReply({ content: `⚠️ لديك بالفعل غرفة خاصة مفتوحة: ${existingChannel}` });
        }

        const channelName = `✧||💬・${member.displayName}`;

        try {
            const channel = await guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: PRIVATE_CHAT_CATEGORY_ID !== '1406728181456830524' ? PRIVATE_CHAT_CATEGORY_ID : null,
                topic: `PC_OWNER_${user.id}`,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.ManageMessages,
                            PermissionFlagsBits.ManageChannels,
                            PermissionFlagsBits.ReadMessageHistory
                        ],
                    },
                ],
            });

            const roomPanelData = getRoomControlPanel(user);
            await channel.send(roomPanelData);

            return interaction.editReply({ content: `✦ تم انشاء دردشتك الخاصة: ${channel}` });
        } catch (error) {
            console.error(error);
            return interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء الغرفة.' });
        }
    }

    // --- ✉️ باقي التفاعلات ---
    if (customId === 'pc_invite') {
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('pc_select_invite_user')
            .setPlaceholder('اختر العضو لإرسال الدعوة');

        const row = new ActionRowBuilder().addComponents(userSelect);
        return interaction.reply({ content: 'من تريد دعوته؟', components: [row], ephemeral: true });
    }

    if (customId === 'pc_knock') {
        const privateChannels = guild.channels.cache.filter(
            ch => ch.type === ChannelType.GuildText && ch.topic && ch.topic.startsWith('PC_OWNER_')
        );

        if (privateChannels.size === 0) {
            return interaction.reply({ content: 'لا توجد غرف دردشة خاصة متاحة حالياً.', ephemeral: true });
        }

        const options = privateChannels.map(ch => ({
            label: ch.name.replace('✧||💬・', ''),
            value: ch.id,
            emoji: '🚪'
        })).slice(0, 25);

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('pc_select_knock_channel')
            .setPlaceholder('اختر غرفة الدردشة لطرق بابها')
            .addOptions(options);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return interaction.reply({ content: 'اختر الغرفة التي تريد طرق بابها:', components: [row], ephemeral: true });
    }

    if (customId === 'pc_zajel') {
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('pc_select_zajel_user')
            .setPlaceholder('اختر الشخص الذي تريد مراسلته');

        const row = new ActionRowBuilder().addComponents(userSelect);
        return interaction.reply({ content: '✉️ اختر الشخص الذي تريد إرسال رسالة زاجل له:', components: [row], ephemeral: true });
    }
}

module.exports = {
    getPrivateChatPanel,
    handlePrivateChatInteraction
};
