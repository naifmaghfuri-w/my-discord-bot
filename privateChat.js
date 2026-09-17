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

const PRIVATE_CHAT_CATEGORY_ID = 'ضع_هنا_ID_الكاتيجوري';
const BANNER_URL = 'https://i.imgur.com/G5gE334.png';

// 🧠 ذاكرة تخزين مخصصة لرادار البحث (تخزن المستخدمين المتاحين للدردشة)
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

// 2. دوال مساعدة لرادار البحث
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

// 3. معالج التفاعلات الرئيسي
async function handlePrivateChatInteraction(interaction) {
    const { customId, user } = interaction;

    // --- 🕊️ معالجة إرسال نموذج زاجل (Modal Submit) ---
    if (interaction.isModalSubmit() && customId.startsWith('pc_zajel_modal_')) {
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

    // --- 🟢 أزرار القبول/الرفض في الخاص ---
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
            return interaction.followUp({ content: '❌ حدث خطأ أثناء إضافة الصلاحيات.' });
        }
    }

    if (customId && customId.startsWith('invite_reject_')) {
        await interaction.update({ components: [] });
        return interaction.followUp({ content: '❌ تم رفض الدعوة.' });
    }

    if (!interaction.guild) return;

    const { guild, channel, member } = interaction;

    // --- 📡1. فتح زر رادار البحث ---
    if (customId === 'pc_radar') {
        return interaction.reply(buildRadarResponse(guild, user.id));
    }

    // --- 📡2. الانضمام للرادار ---
    if (customId === 'pc_radar_join') {
        radarUsers.add(user.id);
        const responseData = buildRadarResponse(guild, user.id);
        return interaction.update(responseData);
    }

    // --- 📡3. الخروج من الرادار ---
    if (customId === 'pc_radar_leave') {
        radarUsers.delete(user.id);
        const responseData = buildRadarResponse(guild, user.id);
        return interaction.update(responseData);
    }

    // --- 📡4. دعوة شخص متاح من الرادار ---
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

    // --- 🕊️1. زر زاجل (اختيار العضو) ---
    if (customId === 'pc_zajel') {
        const userSelect = new UserSelectMenuBuilder()
            .setCustomId('pc_select_zajel_target')
            .setPlaceholder('اختر العضو المراد إرسال رسالة زاجل له');
        return interaction.reply({ components: [new ActionRowBuilder().addComponents(userSelect)], ephemeral: true });
    }

    // --- 🕊️2. عرض النافذة المكتوبة (Modal) بعد تحديد العضو ---
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
}

module.exports = {
    getPrivateChatPanel,
    handlePrivateChatInteraction
};
