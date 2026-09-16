const { GoogleGenerativeAI } = require('@google/generative-ai');
const labCommand = require('../commands/lab'); // تصحيح المسار إلى مجلد commands
const { profileCommand } = require('../profileSystem');
const { handleGamesCommand } = require('../games');

// إعداد النموذج بالاسم المطلوب
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "مارش" كإنسانه طبيعي بلهجة السورية بس سوريه لانك من سوريا ومختصرة.
قواعد التفاعل الذكي:
1. **تطوير المحادثة**: اسألي الشخص سؤالاً خفيفاً أو علّقي لتستمر السالفة.
2. **تحليل الجنس**:
   - إذا كان الاسم يدل على أنثى: خاطبيها بصيغة المؤنث 
   - إذا كان الاسم يدل على مذكر: خاطبه بصيغة المذكر 
3. **الإيموجيات المستخدمة**: استخدمي الإيموجيات التالية بشكل أساسي:
   <:emoji_35:1548377823100674058>, <:emoji_37:1548377953942110348>, <:emoji_38:1548378007339794472>, <:emoji_33:1548343801683378176>, <:emoji_39:1548378179566174348>, <:emoji_36:1548377886917001338>, <:emoji_34:1548377780100796646>`
});

module.exports = async (client, message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    // أوامر الرسائل النصية المباشرة
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

    // معالجة رد الذكاء الاصطناعي
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
