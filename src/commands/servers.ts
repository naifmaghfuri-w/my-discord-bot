import { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    MessageFlags, 
    ChatInputCommandInteraction, 
    Guild 
} from 'discord.js';

// ⚠️ الآيدي الخاص بحساب صاحب البوت
const OWNER_ID: string = '1391517806193017023';

export default {
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('عرض السيرفرات التي يتواجد فيها البوت'),

    async execute(interaction: ChatInputCommandInteraction): Promise<any> {
        try {
            // التحقق من أن المستخدم هو صاحب البوت
            if (interaction.user.id !== OWNER_ID) {
                return interaction.reply({ 
                    content: '❌ هذا الأمر مخصص لصاحب البوت فقط!', 
                    flags: MessageFlags.Ephemeral 
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const guilds: Guild[] = Array.from(interaction.client.guilds.cache.values());

            if (guilds.length === 0) {
                return interaction.editReply({ content: '⚠️ البوت غير متواجد في أي سيرفر حالياً.' });
            }

            // تنسيق قائمة السيرفرات
            const formattedList: string[] = guilds.map((guild: Guild, index: number) => 
                `**${index + 1}.${guild.name}**\n🆔 ID: \`${guild.id}\` | 👥 الأعضاء: \`${guild.memberCount}\``
            );

            let description: string = formattedList.join('\n\n');

            // حماية من تجاوز حد 4000 حرف في الـ Embed Description
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
        } catch (err: any) {
            console.error('❌ خطأ في تنفيذ أمر servers:', err);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء جلب قائمة السيرفرات.' });
            }
        }
    },
};
