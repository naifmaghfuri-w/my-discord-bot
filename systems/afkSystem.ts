import { 
    Client, 
    Message, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    MessageFlags,
    Interaction,
    ButtonInteraction,
    ModalSubmitInteraction,
    GuildMember
} from 'discord.js';

// تعريف واجهة بيانات العضو الغائب
export interface LeftMessage {
    from: string;
    text: string;
}

export interface AfkUserData {
    reason: string;
    timestamp: number;
    oldNickname: string | null;
    mentionsCount: number;
    notifiedUsers: Set<string>;
    leftMessages: LeftMessage[];
}

// تخزين بيانات الـ AFK والرسائل المتروكة والمُنبهين
const afkUsers = new Map<string, AfkUserData>();

export const afkSystem = {
    // 1. معالجة الرسائل والـ AFK
    async handleMessage(client: Client, message: Message): Promise<void> {
        if (message.author.bot || !message.guild || !message.member) return;

        const rawContent = message.content.trim();

        // 🟢 إلغاء الـ AFK وإرسال التنبيهات فور إرسال الشخص الغائب لأي رسالة
        if (afkUsers.has(message.author.id)) {
            const userData = afkUsers.get(message.author.id)!;
            afkUsers.delete(message.author.id);

            try {
                if (message.member.manageable && userData.oldNickname !== null) {
                    await message.member.setNickname(userData.oldNickname);
                }
            } catch (err: unknown) {
                const error = err as Error;
                console.error('❌ تعذر استعادة الاسم الأصلي:', error.message);
            }

            const afkTime = Math.floor(userData.timestamp / 1000);
            let welcomeText = `👋 **أهلاً بعودتك يا ${message.author}!**\n⏱️ **مدة الغياب:** <t:${afkTime}:R>\n🔔 **تم منشنتك:** \`${userData.mentionsCount}\` مرة أثناء غيابك`;

            // تنبيه العضو بالرسائل المتروكة له إن وجدت
            if (userData.leftMessages && userData.leftMessages.length > 0) {
                welcomeText += `\n\n📨 **الرسائل المتروكة لك أثناء غيابك:**\n`;
                const formattedMsgs = userData.leftMessages.map((m, i) => `**${i + 1}.** من <@${m.from}>: "${m.text}"`).join('\n');
                
                // حماية من تجاوز حد الـ 2000 حرف
                if ((welcomeText + formattedMsgs).length > 1950) {
                    welcomeText += formattedMsgs.slice(0, 1800) + '\n...وغيرها من الرسائل التي تجاوزت حد العرض.';
                } else {
                    welcomeText += formattedMsgs;
                }
            }

            await message.reply({ content: welcomeText }).catch(() => null);

            // تنبيه الأشخاص الذين طلبوا "نبهني عند عودته"
            if (userData.notifiedUsers && userData.notifiedUsers.size > 0) {
                const notifyList = Array.from(userData.notifiedUsers).map(id => `<@${id}>`).join(' ');
                await message.channel.send({ 
                    content: `🔔 **تنبيه:** العضو ${message.author} عاد من الغياب الآن!\n${notifyList}` 
                }).catch(() => null);
            }
            return;
        }

        // 🔴 تفعيل الـ AFK عبر كتابة "afk" في الشات
        const args = rawContent.split(/ +/);
        const commandName = args[0]?.toLowerCase();

        if (commandName === 'afk') {
            const reason = args.slice(1).join(' ') || 'مشغول حالياً';
            const currentNickname = message.member.nickname || message.author.username;
            const newNickname = `[AFK] ${currentNickname}`.slice(0, 32);

            afkUsers.set(message.author.id, {
                reason: reason,
                timestamp: Date.now(),
                oldNickname: message.member.nickname || null,
                mentionsCount: 0,
                notifiedUsers: new Set<string>(),
                leftMessages: []
            });

            try {
                if (message.member.manageable) {
                    await message.member.setNickname(newNickname);
                }
            } catch (err: unknown) {
                const error = err as Error;
                console.error('❌ تعذر تغيير اللقب إلى AFK:', error.message);
            }

            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('💤 غياب مؤقت')
                .setDescription(`تم تفعيل وضع الغياب المؤقت بنجاح.\n\n📝 **السبب:** ${reason}`)
                .setThumbnail(message.author.displayAvatarURL());

            await message.reply({ embeds: [embed] }).catch(() => null);
            return;
        }

        // 🟡 عند منشن شخص في وضع الغياب
        if (message.mentions.users.size > 0) {
            for (const user of message.mentions.users.values()) {
                if (afkUsers.has(user.id) && user.id !== message.author.id) {
                    const afkData = afkUsers.get(user.id)!;
                    afkData.mentionsCount += 1;

                    const afkTime = Math.floor(afkData.timestamp / 1000);

                    const embed = new EmbedBuilder()
                        .setColor('#ff0055')
                        .setTitle(`💤 ${user.displayName} في وضع الغياب المؤقت`)
                        .setDescription(`📝 **السبب:** ${afkData.reason}\n⏳ **منذ:** <t:${afkTime}:R>`)
                        .setThumbnail(user.displayAvatarURL());

                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`afk_notify_${user.id}`)
                            .setLabel('نبهني عند عودته 🔔')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`afk_message_${user.id}`)
                            .setLabel('اترك رسالة 📨')
                            .setStyle(ButtonStyle.Secondary)
                    );

                    await message.reply({ embeds: [embed], components: [row] }).catch(() => null);
                }
            }
        }
    },

    // 2. معالجة تفاعلات الأزرار والنوافذ المنبثقة Modal
    async handleInteraction(interaction: Interaction): Promise<boolean | void> {
        try {
            // أ. زر التنبيه "نبهني عند عودته"
            if (interaction.isButton() && interaction.customId.startsWith('afk_notify_')) {
                const btnInteraction = interaction as ButtonInteraction;
                const targetUserId = btnInteraction.customId.replace('afk_notify_', '');
                const afkData = afkUsers.get(targetUserId);

                if (!afkData) {
                    await btnInteraction.reply({ content: '❌ هذا العضو لم يعد في وضع الغياب المؤقت.', flags: MessageFlags.Ephemeral });
                    return true;
                }

                if (btnInteraction.user.id === targetUserId) {
                    await btnInteraction.reply({ content: '❌ لا يمكنك طلب تنبيه لنفسك!', flags: MessageFlags.Ephemeral });
                    return true;
                }

                afkData.notifiedUsers.add(btnInteraction.user.id);
                await btnInteraction.reply({ content: '🔔 تم تسجيل طلبك! سيتم تنبيهك في القناة فور عودة العضو.', flags: MessageFlags.Ephemeral });
                return true;
            }

            // ب. زر "اترك رسالة" - فتح نافذة Modal
            if (interaction.isButton() && interaction.customId.startsWith('afk_message_')) {
                const btnInteraction = interaction as ButtonInteraction;
                const targetUserId = btnInteraction.customId.replace('afk_message_', '');
                
                if (!afkUsers.has(targetUserId)) {
                    await btnInteraction.reply({ content: '❌ هذا العضو لم يعد في وضع الغياب المؤقت.', flags: MessageFlags.Ephemeral });
                    return true;
                }

                if (btnInteraction.user.id === targetUserId) {
                    await btnInteraction.reply({ content: '❌ لا يمكنك ترك رسالة لنفسك!', flags: MessageFlags.Ephemeral });
                    return true;
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

                const row = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
                modal.addComponents(row);

                await btnInteraction.showModal(modal);
                return true;
            }

            // ج. استقبال نص الرسالة من الـ Modal
            if (interaction.isModalSubmit() && interaction.customId.startsWith('afk_modal_')) {
                const modalInteraction = interaction as ModalSubmitInteraction;
                const targetUserId = modalInteraction.customId.replace('afk_modal_', '');
                const afkData = afkUsers.get(targetUserId);

                if (!afkData) {
                    await modalInteraction.reply({ content: '❌ العضو عاد من الغياب قبل إرسال الرسالة.', flags: MessageFlags.Ephemeral });
                    return true;
                }

                const userText = modalInteraction.fields.getTextInputValue('afk_msg_input');
                afkData.leftMessages.push({ from: modalInteraction.user.id, text: userText });

                await modalInteraction.reply({ content: '✅ تم حفظ رسالتك بنجاح! وسوف يستلمها العضو فور عودته.', flags: MessageFlags.Ephemeral });
                return true;
            }
        } catch (err: unknown) {
            console.error('❌ خطأ في تفاعلات نظام AFK:', err);
        }

        return false;
    }
};

export default afkSystem;
