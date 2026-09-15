const { GoogleGenerativeAI } = require('@google/generative-ai');
const labCommand = require('../lab');
const { profileCommand } = require('../profileSystem');
const { handleGamesCommand } = require('../games');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ 
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "مارش" تتحدثين في سيرفر ديسكورد كإنسان طبيعي بلهجة عامية السورية ومختصرة.`
});

module.exports = async (client, message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    if (content === 'بروفايل' || content === 'بروفايلي' || content === 'profile') {
        return profileCommand.executeText(message).catch(console.error);
    }

    if (content === 'lab' || content === 'the lab' || content === 'مختبر') {
        return labCommand.handleLabSession(message, message.author).catch(console.error);
    }

    if (content === 'العاب' || content === 'ألعاب' || content === 'games') {
        return handleGamesCommand(message).catch(console.error);
    }

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

