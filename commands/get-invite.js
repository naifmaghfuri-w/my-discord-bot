const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

// ⚠️ الآيدي الخاص بحساب صاحب البوت
const OWNER_ID = '1391517806193017023';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('get-invite')
        .setDescription('إنشاء رابط دعوة لسيرفر يتواجد فيه البوت بواسطة ID')
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('آيدي السيرفر المطلوب')
                .setRequired(true)),

    async execute(interaction) {
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            // التحقق من أن المستخدم هو صاحب البوت
            if (interaction.user.id !== OWNER_ID) {
                return interaction.editReply({ content: '❌ هذا الأمر مخصص لصاحب البوت فقط!' });
            }

            const guildId = interaction.options.getString('guild_id').trim();
            
            // البحث عن السيرفر في الكاش أو محاولة جلب بياناته
            let guild = interaction.client.guilds.cache.get(guildId);
            if (!guild) {
                guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
            }

            if (!guild) {
                return interaction.editReply({ content: '❌ البوت غير متواجد في هذا السيرفر أو أن الـ ID غير صحيح.' });
            }

            // جلب عضوية البوت داخل السيرفر للتأكد من الصلاحيات
            const botMember = await guild.members.fetchMe().catch(() => null);
            if (!botMember) {
                return interaction.editReply({ content: '❌ تعذر التحقق من صلاحيات البوت في هذا السيرفر.' });
            }

            // البحث عن أول قناة نصية يمتلك فيها البوت صلاحية إنشاء دعوة
            const channel = guild.channels.cache.find(c => 
                c.isTextBased() && 
                c.permissionsFor(botMember).has(PermissionFlagsBits.CreateInstantInvite)
            );

            if (!channel) {
                return interaction.editReply({ content: '❌ البوت لا يمتلك صلاحيات إنشاء دعوة (Create Instant Invite) في قنوات هذا السيرفر.' });
            }

            // إنشاء رابط دعوة صالح لمدة 24 ساعة واستخدام واحد
            const invite = await channel.createInvite({
                maxAge: 86400, // 24 ساعة
                maxUses: 1,    // استخدام واحد
                unique: true,
                reason: `تم إنشاء الدعوة بواسطة صاحب البوت: ${interaction.user.tag}`
            });

            return interaction.editReply({ 
                content: `🔗 **رابط الدعوة لسيرفر:** ${guild.name}\n${invite.url}` 
            });

        } catch (error) {
            console.error('❌ خطأ أثناء إنشاء الدعوة:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء محاولة إنشاء رابط الدعوة.' });
            }
        }
    },
};
