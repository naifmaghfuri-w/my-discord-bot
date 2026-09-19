import { Client, Message, PermissionsBitField, SendableChannels } from 'discord.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExecutableCommand {
    execute?: (message: Message | any, ...args: any[]) => Promise<any>;
    handleLabSession?: (interaction: any, user: any) => Promise<any>;
}

export interface AfkSystem {
    handleMessage?: (client: Client, message: Message) => Promise<any>;
}

let labCommand: any;
let profileCommand: ExecutableCommand | undefined;
let handleGamesCommand: ((message: Message) => Promise<any>) | undefined;
let afkModule: any;
let getPrivateChatPanel: (() => any) | undefined;

try { labCommand = require('../commands/lab'); } catch (e: any) { console.error('⚠️ تعذر تحميل مجلد المختبر:', e.message); }
try { profileCommand = require('../commands/profileSystem')?.profileCommand; } catch (e: any) { console.error('⚠️ تعذر تحميل البروفايل:', e.message); }
try { handleGamesCommand = require('../commands/games')?.handleGamesCommand; } catch (e: any) { console.error('⚠️ تعذر تحميل الألعاب:', e.message); }
try { afkModule = require('../commands/afkSystem'); } catch (e: any) { console.error('⚠️ تعذر تحميل نظام AFK:', e.message); }
try { getPrivateChatPanel = require('../commands/privateChat')?.getPrivateChatPanel; } catch (e: any) { console.error('⚠️ تعذر تحميل الدردشات الخاصة:', e.message); }

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const model = genAI.getGenerativeModel({
    model: 'gemini-3.5-flash-lite',
    systemInstruction: `أنتِ فتاة اسمك "بيتو" كإنسانة طبيعية تتكلمين عربي وخليك ذكيةوكلامك مختصر.
قواعد التفاعل الذكي:
- لاتكثري من أسئلة شو أخبارك ومنورنا وكيف حالك، خليك في الموضوع دائماً.
- أسماء الأولاد الذين تحكين معهم بصيغة المذكر هم: ساي، زيلا، مي.
- أسماء البنات هم: أسيل، إيما، نو ميرسي، ايميكا، عيدالحب، زها.
2. تحليل الجنس:
   - إذا كان الاسم يدل على أنثى: خاطبيها بصيغة المؤنث.
   - إذا كان الاسم يدل على مذكر: خاطبه بصيغة المذكر.`
});

export default async function handleMessageCreate(client: Client, message: Message): Promise<void> {
    if (message.author.bot || !message.guild || !client.user) return;

    const rawContent = message.content.trim();
    const content = rawContent.toLowerCase();

    // 1. تشغيل نظام الـ AFK أولاً مع كل رسالة (للتحقق من إلغاء الـ AFK أو تفعيله أو المنشن)
    const afkHandler = afkModule?.afkSystem?.handleMessage || afkModule?.default?.handleMessage || afkModule?.handleMessage;
    if (typeof afkHandler === 'function') {
        await afkHandler(client, message).catch(console.error);
    }

    // 2. لوحة الدردشات
    if ((content === '!setup-panel' || content === 'لوحة الدردشات') && typeof getPrivateChatPanel === 'function') {
        if (!message.member?.permissions.has(PermissionsBitField.Flags.Administrator)) return;
        const panelData = getPrivateChatPanel();
        
        if (message.channel.isSendable()) {
            await message.channel.send(panelData);
        }
        await message.delete().catch(() => {});
        return;
    }

    // 3. أمر المختبر
    if (['lab', 'the lab', 'مختبر', 'المختبر'].includes(content)) {
        if (labCommand) {
            let replyMessage: Message | null = null;
            
            const fakeInteraction: any = {
                id: message.id,
                guild: message.guild,
                channel: message.channel,
                user: message.author,
                member: message.member,
                client: message.client,
                replied: false,
                deferred: false,
                isCommand: () => false,
                isButton: () => false,
                isStringSelectMenu: () => false,
                isRepliable: () => true,
                reply: async (options: any) => {
                    fakeInteraction.replied = true;
                    replyMessage = await message.reply(options);
                    return replyMessage;
                },
                followUp: async (options: any) => {
                    if (message.channel.isSendable()) {
                        return await (message.channel as SendableChannels).send(options);
                    }
                },
                editReply: async (options: any) => {
                    if (replyMessage) return await replyMessage.edit(options);
                    return await message.reply(options);
                },
                deferReply: async () => {
                    fakeInteraction.deferred = true;
                    if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
                        await message.channel.sendTyping().catch(() => {});
                    }
                }
            };

            const execFunc = labCommand.handleLabSession || labCommand.execute || labCommand;
            if (typeof execFunc === 'function') {
                return await execFunc(fakeInteraction, message.author).catch(console.error);
            }
        }
    }

    // 4. البروفايل
    if (['بروفايل', 'بروفايلي', 'profile'].includes(content) && profileCommand?.execute) {
        return await profileCommand.execute(message).catch(console.error);
    }

    // 5. الألعاب
    if (['العاب', 'ألعاب', 'games', '!games'].includes(content) && typeof handleGamesCommand === 'function') {
        return await handleGamesCommand(message).catch(console.error);
    }

    // 6. ذكاء بيتو الاصطناعي (Gemini Response)
    const isMentioned = message.mentions.has(client.user);
    const isDots = content === '..' || content === '...';
    const isCalledByName = content.includes('بيتو') || content.includes('pitou');

    if (isMentioned || isDots || isCalledByName) {
        try {
            if ('sendTyping' in message.channel && typeof message.channel.sendTyping === 'function') {
                await message.channel.sendTyping().catch(() => {});
            }

            const cleanedContent = message.content
                .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
                .trim();
                
            const userDisplayName = message.member?.displayName || message.author.username;
            const promptText = cleanedContent || (isDots ? '...' : 'أهلاً بيتو');
            const userPrompt = `اسم العرض: "${userDisplayName}". الرسالة: "${promptText}"`;

            const result = await model.generateContent(userPrompt);
            const response = await result.response;
            const text = response.text();

            if (text) {
                await message.reply(text.slice(0, 2000));
            }
        } catch (error: any) {
            console.error('❌ خطأ في الاستجابة الذكية من Gemini:', error.message);
        }
    }
}
