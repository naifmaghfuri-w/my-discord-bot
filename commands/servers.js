const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

// ⚠️ الآيدي الخاص بحساب صاحب البوت
const OWNER_ID = '1391517806193017023';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('عرض السيرفرات التي يتواجد فيها البوت'),

    async execute(interaction) {
        try {
            // التحقق من أن المستخدم هو صاحب البوت قبل deferReply لتوفير الاستجابة السريعة
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ 
                    content: '❌ هذا الأمر مخصص لصاحب البوت فقط!', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guilds = Array.from(interaction.client.guilds.cache.values());

            if (guilds.length === 0) {
                return interaction.editReply({ content: '⚠️ البوت غير متواجد في أي سيرفر حالياً.' });
            }

            // تقسيم السيرفرات لقوائم لتفادي تجاوز حد الـ Embed
            const formattedList = guilds.map((guild, index) => 
                `**${index + 1}.${guild.name}**\n🆔 ID: \`${guild.id}\` | 👥 الأعضاء: \`${guild.memberCount}\``
            );

            let description = formattedList.join('\n\n');

            // حماية من تجاوز حد 4000 حرف
            if (description.length > 4000) {
                description = description.slice(0, 3950) + '\n\n...وغيرها من السيرفرات التي تجاوزت حد العرض.';
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 قائمة سيرفرات البوت (${guilds.length})`)
                .setDescription(description)
                .setColor('#2b2d31')
                .setFooter({ text: `طُلب بواسطة: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('❌ خطأ في تنفيذ أمر servers:', err);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء جلب قائمة السيرفرات.' });
            }
        }
    },
};
