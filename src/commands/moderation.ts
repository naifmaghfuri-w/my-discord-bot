import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    MessageFlags, 
    ChatInputCommandInteraction, 
    GuildMember 
} from 'discord.js';

export interface Command {
    data: SlashCommandBuilder;
    execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const moderationCmds: Command[] = [
    {
        data: new SlashCommandBuilder()
            .setName('ban')
            .setDescription('حظر عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو').setRequired(true))
            .addStringOption(opt => opt.setName('السبب').setDescription('سبب الحظر').setRequired(false)) as SlashCommandBuilder,
        async execute(interaction: ChatInputCommandInteraction): Promise<void> {
            try {
                if (!interaction.guild) return;

                const user = interaction.options.getUser('العضو', true);
                const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);

                if (!member) {
                    await interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (!member.bannable) {
                    await interaction.reply({ content: '❌ لا أملك صلاحيات لحظر هذا العضو (رتبته أعلى مني أو من المالك)!', flags: MessageFlags.Ephemeral });
                    return;
                }

                await member.ban({ reason });
                await interaction.reply({ content: `🔨 تم حظر **${user.tag}** بنجاح!\n**السبب:** ${reason}` });
            } catch (err) {
                console.error('❌ خطأ في تنفيذ أمر ban:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ حدث خطأ أثناء محاولة حظر العضو.', flags: MessageFlags.Ephemeral });
                }
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('kick')
            .setDescription('طرد عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو').setRequired(true))
            .addStringOption(opt => opt.setName('السبب').setDescription('سبب الطرد').setRequired(false)) as SlashCommandBuilder,
        async execute(interaction: ChatInputCommandInteraction): Promise<void> {
            try {
                if (!interaction.guild) return;

                const user = interaction.options.getUser('العضو', true);
                const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);

                if (!member) {
                    await interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (!member.kickable) {
                    await interaction.reply({ content: '❌ لا أملك صلاحيات لطرد هذا العضو!', flags: MessageFlags.Ephemeral });
                    return;
                }

                await member.kick(reason);
                await interaction.reply({ content: `👞 تم طرد **${user.tag}** بنجاح!\n**السبب:** ${reason}` });
            } catch (err) {
                console.error('❌ خطأ في تنفيذ أمر kick:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ حدث خطأ أثناء محاولة طرد العضو.', flags: MessageFlags.Ephemeral });
                }
            }
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('إسكات عضو لفترة محددة (تايم أوت)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو').setRequired(true))
            .addIntegerOption(opt => opt.setName('الدقائق').setDescription('مدة الإسكات بالدقائق').setRequired(true))
            .addStringOption(opt => opt.setName('السبب').setDescription('سبب التايم أوت').setRequired(false)) as SlashCommandBuilder,
        async execute(interaction: ChatInputCommandInteraction): Promise<void> {
            try {
                if (!interaction.guild) return;

                const user = interaction.options.getUser('العضو', true);
                const minutes = interaction.options.getInteger('الدقائق', true);
                const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
                const member = await interaction.guild.members.fetch(user.id).catch(() => null);

                if (!member) {
                    await interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (!member.moderatable) {
                    await interaction.reply({ content: '❌ لا أملك صلاحيات لإعطاء تايم أوت لهذا العضو!', flags: MessageFlags.Ephemeral });
                    return;
                }

                await member.timeout(minutes * 60 * 1000, reason);
                await interaction.reply({ content: `🔇 تم إعطاء تايم أوت لـ **${user.tag}** لمدة **${minutes}** دقيقة.\n**السبب:** ${reason}` });
            } catch (err) {
                console.error('❌ خطأ في تنفيذ أمر timeout:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ حدث خطأ أثناء محاولة تنفيذ التايم أوت.', flags: MessageFlags.Ephemeral });
                }
            }
        }
    }
];

export default moderationCmds;
