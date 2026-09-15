const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = [
    {
        data: new SlashCommandBuilder()
            .setName('ban')
            .setDescription('حظر عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString())
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو').setRequired(true))
            .addStringOption(opt => opt.setName('السبب').setDescription('سبب الحظر').setRequired(false)),
        async execute(interaction) {
            const user = interaction.options.getUser('العضو');
            const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
            if (!member.bannable) return interaction.reply({ content: '❌ لا أملك صلاحيات لحظر هذا العضو!', flags: MessageFlags.Ephemeral });

            await member.ban({ reason });
            await interaction.reply({ content: `🔨 تم حظر ${user.tag} بنجاح!\n**السبب:** ${reason}` });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('kick')
            .setDescription('طرد عضو من السيرفر')
            .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString())
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو').setRequired(true))
            .addStringOption(opt => opt.setName('السبب').setDescription('سبب الطرد').setRequired(false)),
        async execute(interaction) {
            const user = interaction.options.getUser('العضو');
            const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
            if (!member.kickable) return interaction.reply({ content: '❌ لا أملك صلاحيات لطرد هذا العضو!', flags: MessageFlags.Ephemeral });

            await member.kick(reason);
            await interaction.reply({ content: `👞 تم طرد ${user.tag} بنجاح!\n**السبب:** ${reason}` });
        }
    },
    {
        data: new SlashCommandBuilder()
            .setName('timeout')
            .setDescription('إسكات عضو لفترة محددة (تايم أوت)')
            .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString())
            .addUserOption(opt => opt.setName('العضو').setDescription('اختر العضو').setRequired(true))
            .addIntegerOption(opt => opt.setName('الدقائق').setDescription('مدة الإسكات بالدقائق').setRequired(true))
            .addStringOption(opt => opt.setName('السبب').setDescription('سبب التايم أوت').setRequired(false)),
        async execute(interaction) {
            const user = interaction.options.getUser('العضو');
            const minutes = interaction.options.getInteger('الدقائق');
            const reason = interaction.options.getString('السبب') || 'لم يتم تحديد سبب';
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) return interaction.reply({ content: '❌ العضو غير موجود بالسيرفر.', flags: MessageFlags.Ephemeral });
            if (!member.moderatable) return interaction.reply({ content: '❌ لا أملك صلاحيات لإعطاء تايم أوت!', flags: MessageFlags.Ephemeral });

            await member.timeout(minutes * 60 * 1000, reason);
            await interaction.reply({ content: `🔇 تم إعطاء تايم أوت لـ ${user.tag} لمدة **${minutes}** دقيقة.\n**السبب:** ${reason}` });
        }
    }
];

