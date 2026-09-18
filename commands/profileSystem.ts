import { createCanvas, loadImage } from '@napi-rs/canvas';
import { 
    SlashCommandBuilder, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    EmbedBuilder,
    MessageFlags,
    ChatInputCommandInteraction,
    StringSelectMenuInteraction,
    User,
    Message,
    ColorResolvable
} from 'discord.js';
import { QuickDB } from 'quick.db';
import path from 'path';

const db = new QuickDB();

// تعريف واجهات البيانات (Interfaces)
interface StoreItem {
    id: string;
    name: string;
    price: number;
    type: 'bg' | 'frame';
}

interface UserProfileData {
    title: string;
    nenType: string;
    affiliation: string;
    level: number;
    wealth: number;
    equippedBg: string;
    frameColor: string;
    inventory: string[];
}

// قائمة العناصر المتاحة في المتجر والمستودع
const STORE_ITEMS: StoreItem[] = [
    { id: 'bg_tower.png', name: 'برج الجويا (Heaven’s Arena)', price: 10000, type: 'bg' },
    { id: 'bg_greed.png', name: 'جزيرة الطمع (Greed Island)', price: 25000, type: 'bg' },
    { id: 'bg_dark.png', name: 'القارة المظلمة (Dark Continent)', price: 50000, type: 'bg' },
    { id: '#00ffcc', name: 'إطار نيون أخضر', price: 5000, type: 'frame' },
    { id: '#9900ff', name: 'إطار هالة أرجوانية', price: 15000, type: 'frame' },
    { id: '#ffd700', name: 'إطار ترخيص ذهبي', price: 30000, type: 'frame' }
];

// دالة رسم الكانفاس
async function generateCanvas(user: User, data: UserProfileData): Promise<Buffer> {
    const canvas = createCanvas(800, 450);
    const ctx = canvas.getContext('2d');

    // 1. رسم الخلفية (صورة إن وجدت أو لون افتراضي)
    try {
        if (data.equippedBg && !data.equippedBg.startsWith('#')) {
            const bgPath = path.join(__dirname, '../assets', data.equippedBg);
            const bgImage = await loadImage(bgPath);
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = '#0a0f1d';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    } catch (e) {
        // خلفية بديلة في حال عدم وجود الصورة
        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. طبقة معتمة وإطار خارجي
    ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
    ctx.fillRect(20, 20, 760, 410);

    const frameColor = data.frameColor || '#00ffcc';
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, 760, 410);

    // 3. Avatar الصورة الشخصية
    try {
        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(120, 120, 60, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, 60, 60, 120, 120);
        ctx.restore();
    } catch (e: any) {
        console.error("خطأ في تحميل الصورة الشخصية:", e.message);
    }

    ctx.beginPath();
    ctx.arc(120, 120, 60, 0, Math.PI * 2);
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 4. النصوص
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(user.username, 200, 90);

    ctx.fillStyle = frameColor;
    ctx.font = '18px sans-serif';
    ctx.fillText(`اللقب: ${data.title}`, 200, 125);

    // 5. المربعات الأربعة
    const fields = [
        { label: 'نوع النين (Nen)', value: data.nenType },
        { label: 'الانتماء (Affiliation)', value: data.affiliation },
        { label: 'المستوى (Level)', value: `Lvl ${data.level}` },
        { label: 'الثروة (Wealth)', value: `${Number(data.wealth).toLocaleString()} Jenny` }
    ];

    fields.forEach((field, index) => {
        const row = Math.floor(index / 2);
        const col = index % 2;
        const x = 60 + col * 360;
        const y = 220 + row * 90;

        ctx.fillStyle = 'rgba(0, 255, 204, 0.05)';
        ctx.fillRect(x, y, 320, 70);
        ctx.strokeStyle = frameColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, 320, 70);

        ctx.fillStyle = '#8a99ad';
        ctx.font = '14px sans-serif';
        ctx.fillText(field.label, x + 15, y + 25);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(String(field.value), x + 15, y + 55);
    });

    return canvas.toBuffer('image/png');
}

// جلب بيانات العضو
async function getUserData(userId: string): Promise<UserProfileData> {
    return {
        title: (await db.get(`user_${userId}.title`)) || 'صياد مبتدئ',
        nenType: (await db.get(`user_${userId}.nen`)) || 'تعزيز (Enhancer)',
        affiliation: (await db.get(`user_${userId}.affiliation`)) || 'جمعية الصيادين',
        level: (await db.get(`user_${userId}.level`)) || 1,
        wealth: (await db.get(`user_${userId}.jenny`)) || 50000,
        equippedBg: (await db.get(`user_${userId}.equippedBg`)) || 'bg_tower.png',
        frameColor: (await db.get(`user_${userId}.frameColor`)) || '#00ffcc',
        inventory: (await db.get(`user_${userId}.inventory`)) || ['bg_tower.png', '#00ffcc']
    };
}

// أمر البروفايل
export const profileCommand = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('عرض بطاقة البروفايل الخاصة بك'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply();
            }
            const userData = await getUserData(interaction.user.id);
            const buffer = await generateCanvas(interaction.user, userData);
            const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (err) {
            console.error('❌ خطأ في عرض البروفايل:', err);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ حدث خطأ أثناء إنشاء بطاقة البروفايل!' }).catch(() => {});
            }
        }
    },

    async executeText(message: Message): Promise<void> {
        try {
            const userData = await getUserData(message.author.id);
            const buffer = await generateCanvas(message.author, userData);
            const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });
            await message.reply({ files: [attachment] });
        } catch (err) {
            console.error('❌ خطأ في عرض البروفايل النصي:', err);
        }
    }
};

// أمر المتجر والمستودع
export const shopCommand = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('متجر ومستودع ستايلات البروفايل'),

    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        try {
            const userId = interaction.user.id;
            const userData = await getUserData(userId);

            const options = STORE_ITEMS.map(item => {
                const isOwned = userData.inventory.includes(item.id);
                return {
                    label: item.name,
                    value: item.id,
                    description: isOwned ? '🟢 مجهزة/مملوكة (اضغط للتجهيز)' : `شراء بـ ${item.price.toLocaleString()} Jenny`,
                    emoji: isOwned ? '🎒' : '🛒'
                };
            });

            const selectMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('profile_shop_select')
                    .setPlaceholder('اختر مظهراً لشراءه أو تجهيزه...')
                    .addOptions(options)
            );

            const embedColor: ColorResolvable = userData.frameColor.startsWith('#') 
                ? (userData.frameColor as ColorResolvable) 
                : '#00ffcc';

            const embed = new EmbedBuilder()
                .setTitle('🛒 متجر ومستودع المظاهر')
                .setDescription(`رصيدك الحالي: **${userData.wealth.toLocaleString()} Jenny**\n\nاختر من القائمة أدناه لشراء مظهر جديد أو تجهيز مظهر تملكه.`)
                .setColor(embedColor);

            await interaction.reply({ embeds: [embed], components: [selectMenu] });
        } catch (err) {
            console.error('❌ خطأ في فتح المتجر:', err);
        }
    }
};

// معالجة تفاعلات القائمة
export async function handleProfileEvents(interaction: any): Promise<boolean> {
    if (interaction.isStringSelectMenu() && interaction.customId === 'profile_shop_select') {
        const selectInteraction = interaction as StringSelectMenuInteraction;
        const userId = selectInteraction.user.id;
        const selectedId = selectInteraction.values[0];
        const item = STORE_ITEMS.find(x => x.id === selectedId);
        
        if (!item) return false;

        let jenny: number = (await db.get(`user_${userId}.jenny`)) || 50000;
        let inventory: string[] = (await db.get(`user_${userId}.inventory`)) || ['bg_tower.png', '#00ffcc'];

        // تجهيز إذا كان مملوكاً
        if (inventory.includes(item.id)) {
            if (item.type === 'bg') await db.set(`user_${userId}.equippedBg`, item.id);
            if (item.type === 'frame') await db.set(`user_${userId}.frameColor`, item.id);

            await selectInteraction.reply({ content: `✅ تم تجهيز **${item.name}** على بطاقتك الشخصية!`, flags: MessageFlags.Ephemeral });
            return true;
        }

        // شراء إذا لم يكن مملوكاً
        if (jenny < item.price) {
            await selectInteraction.reply({ content: '❌ لا تملك رصيد كافٍ من عملة Jenny!', flags: MessageFlags.Ephemeral });
            return true;
        }

        await db.sub(`user_${userId}.jenny`, item.price);
        await db.push(`user_${userId}.inventory`, item.id);

        if (item.type === 'bg') await db.set(`user_${userId}.equippedBg`, item.id);
        if (item.type === 'frame') await db.set(`user_${userId}.frameColor`, item.id);

        await selectInteraction.reply({ content: `🎉 تم شراء وتجهيز **${item.name}** بنجاح!`, flags: MessageFlags.Ephemeral });
        return true;
    }
    return false;
}
