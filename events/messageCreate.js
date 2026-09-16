const { GoogleGenerativeAI } = require('@google/generative-ai');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const labCommand = require('../commands/lab');
const { profileCommand } = require('../profileSystem');
const { handleGamesCommand } = require('../games');

// تخزين بيانات الـ AFK: key=userId, value={ reason, timestamp, oldNickname, mentionsCount }
const afkUsers = new Map();

// إعداد النموذج بالاسم المطلوب
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "مارش" كإنسانه طبيعي بلهجة السورية بس سوريه ومختصرة.
قواعد التفاعل الذكي:
-لاتكثري من اساله شو اخبارك و منورنا وكيف حالك لاتكثرين منها دوماً خلك في موضوع
-اسماء الاولاد الي تحكين معهم بصغة ولد هم ساي و زيلا و مي 
-اسماء البنات هم اسيل و ايما و نو ميرسي و ايميكا و عيدالحب وزها
2. **تحليل الجنس**:
   - إذا كان الاسم يدل على أنثى: خاطبيها بصيغة المؤنث 
   - إذا كان الاسم يدل على مذكر: خاطبه بصيغة المذكر 
3. **الإيموجيات المستخدمة**: استخدمي الإيموجيات التالية بشكل أساسي:
   <:emoji_35:1548377823100674058>, <:emoji_37:1548377953942110348>, <:emoji_38:1548378007339794472>, <:emoji_33:1548343801683378176>, <:emoji_39:1548378179566174348>, <:emoji_36:1548377886917001338>, <:emoji_34:1548377780100796646>`
});

module.exports = async (client, message) => {
    if (message.author.bot || !message.guild) return;

    const rawContent = message.content.trim();
    const content = rawContent.toLowerCase();

    // ==========================================
    // 1. إلغاء الـ AFK ورسالة الترحيب المطابقة للصورة
    // ==========================================
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
        const welcomeText = `👋*أهلاً بعودتك يا ${message.author}!*\n⏱️*مدة الغياب: <t:${afkTime}:R>*\n🔔*تم منشنتك: ${userData.mentionsCount} مرة أثناء غيابك*`;

        await message.reply({ content: welcomeText });
    }

    // ==========================================
    // 2. تفعيل وضع الـ AFK
    // ==========================================
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
            mentionsCount: 0 // العداد يبدأ من صفر
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

    // ==========================================
    // 3. التنبيه وزيادة عداد المنشن لشخص غائب
    // ==========================================
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(async (user) => {
            if (afkUsers.has(user.id)) {
                const afkData = afkUsers.get(user.id);
                
                // زيادة عدد المنشنات المستلمة
                afkData.mentionsCount += 1;
                afkUsers.set(user.id, afkData);

                const afkTime = Math.floor(afkData.timestamp / 1000);

                const embed = new EmbedBuilder()
                    .setColor('#ff0055')
                    .setTitle(`🧐 ${user.displayName}`)
                    .setDescription(`💤 **في وضع الغياب المؤقت(AFK)**\n📝 **السبب:** ${afkData.reason}\n⏳ **منذ:** <t:${afkTime}:R>`)
                    .setThumbnail(user.displayAvatarURL({ dynamic: true }));

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`afk_notify_${user.id}`)
                        .setLabel('نبهني عندعودته 🔔')
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

    // ==========================================
    // 4. أوامر الرسائل النصية المباشرة
    // ==========================================
    if (content === 'بروفايل' || content === 'بروفايلي' || content === 'profile') {
        if (profileCommand.execute) {
            return profileCommand.execute(message).catch(console.error);
        }
    }

    if (content === 'lab' || content === 'the lab' || content === 'مختبر') {
        return labCommand.execute(message).catch(console.error);
    }

    if (content === 'العاب' || content === 'ألعاب' || content === 'games') {
        return handleGamesCommand(message).catch(console.error);
    }

    // ==========================================
    // 5. معالجة رد الذكاء الاصطناعي (Gemini)
    // ==========================================
    const isMentioned = message.mentions.has(client.user);
    const isDots = content === '..' || content === '...';
    const isCalledByName = content.includes('مارش') || content.includes('marsh');

    if (isMentioned || isDots || isCalledByName) {
        try {
            await message.channel.sendTyping();
            const userDisplayName = message.member?.displayName || message.author.username;
            const userPrompt = `اسم العرض: "${userDisplayName}". الرسالة: "${message.content}"`;

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            await message.reply(response.text().slice(0, 2000));
        } catch (error) {
            console.error('❌ خطأ في الاستجابة الذكية من Gemini:', error);
        }
    }
};
