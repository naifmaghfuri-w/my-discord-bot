const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');

// تخزين بيانات الـ AFK والرسائل المتروكة والمُنبهين
const afkUsers = new Map(); // targetUserId -> { reason, timestamp, oldNickname, mentionsCount, notifiedUsers: Set, leftMessages: Array }

module.exports = {
    // 1. معالجة الرسائل والـ AFK
    async handleMessage(client, message) {
        if (message.author.bot || !message.guild) return;

        const rawContent = message.content.trim();
        const content = rawContent.toLowerCase();

        // 🟢 إلغاء الـ AFK وإرسال التنبيهات
        if (afkUsers.has(message.author.id)) {
            const userData = afkUsers.get(message.author.id);
            afkUsers.delete(message.author.id);

            try {
                if (message.member.manageable && userData.oldNickname !== undefined) {
                    await message.member.setNickname(userData.oldNickname);
                }
            } catch (err) {
                console.error('❌ تعذر تغيير الاسم:', err.message);
            }

            const afkTime = Math.floor(userData.timestamp / 1000);
            let welcomeText = `👋*أهلاً بعودتك يا ${message.author}!*\n⏱️*مدة الغياب: <t:${afkTime}:R>*\n🔔*تم منشنتك: ${userData.mentionsCount} مرة أثناء غيابك*`;

            // تنبيه العضو بالرسائل المتروكة له إن وجدت
            if (userData.leftMessages && userData.leftMessages.length > 0) {
                welcomeText += `\n\n📨 **الرسائل المتروكة لك أثناء غيابك:**\n` + 
                    userData.leftMessages.map((m, i) => `**${i + 1}.** من <@${m.from}>: "${m.text}"`).join('\n');
            }

            await message.reply({ content: welcomeText });

            // تنبيه الأشخاص الذين طلبوا "نبهني عند عودته"
            if (userData.notifiedUsers && userData.notifiedUsers.size > 0) {
                const notifyList = Array.from(userData.notifiedUsers).map(id => `<@${id}>`).join(' ');
                await message.channel.send({ content: `🔔 تنبيه للجميع: العضو ${message.author} عاد من الغياب الآن! ${notifyList}` });
            }
            return;
        }

        // 🔴 تفعيل الـ AFK
        const args = rawContent.split(/ +/);
        const commandName = args[0].toLowerCase();

        if (commandName === 'afk') {
            const reason = args.slice(1).join(' ') || 'مشغول حالياً';
            const currentNickname = message.member.nickname || message.author.username;
            const newNickname = `[AFK] ${currentNickname}`.slice(0, 32);

            afkUsers.set(message.author.id, {
                reason: reason,
                timestamp: Date.now(),
                oldNickname: message.member.nickname || null,
                mentionsCount: 0,
                notifiedUsers: new Set(),
                leftMessages: []
            });

            try {
                if (message.member.manageable) {
                    await message.member.setNickname(newNickname);
                }
            } catch (err) {
                console.error('❌ تعذر تغيير اللقب:', err.message);
            }

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('💤 غياب مؤقت')
                .setDescription(`تم تفعيل وضع الغياب المؤقت بنجاح\n\n📝 **السبب:** ${reason}`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

            return message.reply({ embeds: [embed] });
        }

        // 🟡 عند منشن شخص غائب
        if (message.mentions.users.size > 0) {
            message.mentions.users.forEach(async (user) => {
                if (afkUsers.has(user.id)) {
                    const afkData = afkUsers.get(user.id);
                    afkData.mentionsCount += 1;

                    const afkTime = Math.floor(afkData.timestamp / 1000);

                    const embed = new EmbedBuilder()
                        .setColor('#ff0055')
                        .setTitle(` ${user.displayName}`)
                        .setDescription(`💤 **في وضع الغياب المؤقت(AFK)**\n📝 **السبب:** ${afkData.reason}\n⏳ **منذ:** <t:${afkTime}:R>`)
                        .setThumbnail(user.displayAvatarURL({ dynamic: true }));

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`afk_notify_${user.id}`)
                            .setLabel('نبهني عند عودته 🔔')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`afk_message_${user.id}`)
                            .setLabel('اترك رسالة 📨')
                            .setStyle(ButtonStyle.Primary)
                    );

                    await message.reply({ embeds: [embed], components: [row] });
                }
            });
        }
    },

    // 2. معالجة تفاعلات الأزرار والـ Modal
    async handleInteraction(interaction) {
        // أ. زر التنبيه "نبهني عند عودته"
        if (interaction.isButton() && interaction.customId.startsWith('afk_notify_')) {
            const targetUserId = interaction.customId.replace('afk_notify_', '');
            const afkData = afkUsers.get(targetUserId);

            if (!afkData) {
                return interaction.reply({ content: '❌ هذا العضو لم يعد في وضع الغياب المؤقت.', flags: MessageFlags.Ephemeral });
            }

            afkData.notifiedUsers.add(interaction.user.id);
            return interaction.reply({ content: '🔔 تم تسجيل طلبك! سيتم تنبيهك في القناة فور عودة العضو.', flags: MessageFlags.Ephemeral });
        }

        // ب. زر "اترك رسالة" - فتح نافذة Modal
        if (interaction.isButton() && interaction.customId.startsWith('afk_message_')) {
            const targetUserId = interaction.customId.replace('afk_message_', '');
            
            if (!afkUsers.has(targetUserId)) {
                return interaction.reply({ content: '❌ هذا العضو لم يعد في وضع الغياب المؤقت.', flags: MessageFlags.Ephemeral });
            }

            const modal = new ModalBuilder()
                .setCustomId(`afk_modal_${targetUserId}`)
                .setTitle('ترك رسالة للعضو الغائب');

            const messageInput = new TextInputBuilder()
                .setCustomId('afk_msg_input')
                .setLabel('اكتب رسالتك هنا:')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(500);

            const row = new ActionRowBuilder().addComponents(messageInput);
            modal.addComponents(row);

            return await interaction.showModal(modal);
        }

        // ج. استقبال نص الرسالة من الـ Modal
        if (interaction.isModalSubmit() && interaction.customId.startsWith('afk_modal_')) {
            const targetUserId = interaction.customId.replace('afk_modal_', '');
            const afkData = afkUsers.get(targetUserId);

            if (!afkData) {
                return interaction.reply({ content: '❌ العضو عاد من الغياب قبل إرسال الرسالة.', flags: MessageFlags.Ephemeral });
            }

            const userText = interaction.fields.getTextInputValue('afk_msg_input');
            afkData.leftMessages.push({ from: interaction.user.id, text: userText });

            return interaction.reply({ content: '✅ تم حفظ رسالتك بنجاح! وسوف يستلمها العضو فور عودته.', flags: MessageFlags.Ephemeral });
        }

        return false;
    }
};
