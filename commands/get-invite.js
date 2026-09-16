const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

// ⚠️ ضع الآيدي الخاص بحسابك لضمان استخدام الأمر منك فقط
const OWNER_ID = 'YOUR_DISCORD_ID';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('get-invite')
        .setDescription('إنشاء رابط دعوة لسيرفر يتواجد فيه البوت بواسطة ID')
        .addStringOption(option =>
            option.setName('guild_id')
                .setDescription('آيدي السيرفر المطلوب')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        if (interaction.user.id !== OWNER_ID) {
            return interaction.editReply({ content: '❌ هذا الأمر مخصص لصاحب البوت فقط!' });
        }

        const guildId = interaction.options.getString('guild_id');
        const guild = interaction.client.guilds.cache.get(guildId);

        if (!guild) {
            return interaction.editReply({ content: '❌ البوت غير متواجد في هذا السيرفر أو أن الـ ID غير صحيح.' });
        }

        try {
            // البحث عن أول قناة كتابية يمتلك البوت فيها صلاحية إنشاء دعوة
            const channel = guild.channels.cache.find(c => 
                c.isTextBased() && 
                c.permissionsFor(guild.members.me).has(PermissionFlagsBits.CreateInstantInvite)
            );

            if (!channel) {
                return interaction.editReply({ content: '❌ البوت لا يمتلك صلاحيات إنشاء دعوة (Create Instant Invite) في قنوات هذا السيرفر.' });
            }

            // إنشاء رابط دعوة صالح لمدة 24 ساعة واستخدام واحد (أو صلاحية مفتوحة)
            const invite = await channel.createInvite({
                maxAge: 86400, // 24 ساعة
                maxUses: 1,    // استخدام واحد فقط
                unique: true,
            });

            await interaction.editReply({ content: `🔗 رابط الدعوة لسيرفر **${guild.name}**:\n${invite.url}` });
        } catch (error) {
            console.error('❌ خطأ أثناء إنشاء الدعوة:', error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء محاولة إنشاء رابط الدعوة.' });
        }
    },
};
