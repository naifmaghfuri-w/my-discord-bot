const fs = require('fs');
const path = require('path');
const labData = require('./data');

const dataPath = path.join(__dirname, 'labData.json');

// التخزين المؤقت في الذاكرة للحد من القراءة والتكرار من القرص الصلب
let dbCache = null;

function ensureDataFile() {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify({}, null, 2), 'utf8');
    }
}

function loadDatabase() {
    if (dbCache) return dbCache;
    ensureDataFile();
    try {
        const raw = fs.readFileSync(dataPath, 'utf8');
        dbCache = JSON.parse(raw);
    } catch (err) {
        console.error('فشل في قراءة ملف البيانات، تم إعادة التعيين إلى كائن فارغ:', err);
        dbCache = {};
    }
    return dbCache;
}

function saveDatabase() {
    if (!dbCache) return;
    try {
        fs.writeFileSync(dataPath, JSON.stringify(dbCache, null, 2), 'utf8');
    } catch (err) {
        console.error('فشل في حفظ ملف البيانات:', err);
    }
}

function getMarketPrices() {
    // بذور للتغير كل 5 دقائق (300,000 ملي ثانية)
    const minuteSeed = Math.floor(Date.now() / 300000);
    const prices = {};

    for (const [id, item] of Object.entries(labData.items || {})) {
        if (item.price > 0) {
            const factor = 0.7 + (Math.abs(Math.sin(minuteSeed + id.length)) * 0.6);
            prices[id] = Math.round(item.price * factor);
        }
    }
    return prices;
}

function generateDailyQuest(playerLevel = 1) {
    const targetItems = Object.entries(labData.items || {}).filter(
        ([_, item]) => !item.buyable && item.price > 0
    );

    // خطة بديلة في حال عدم وجود عناصر تطابق الشروط لمنع الكراش
    if (targetItems.length === 0) {
        return {
            item: 'h2o_imp',
            count: 1,
            progress: 0,
            rewardCoins: 150 + playerLevel * 20,
            rewardXp: 40 + playerLevel * 10,
            completed: false,
            lastReset: Date.now()
        };
    }

    const [randomItem] = targetItems[Math.floor(Math.random() * targetItems.length)];
    const count = Math.floor(Math.random() * 2) + 1;

    return {
        item: randomItem,
        count: count,
        progress: 0,
        rewardCoins: count * 150 + playerLevel * 20,
        rewardXp: count * 40 + playerLevel * 10,
        completed: false,
        lastReset: Date.now()
    };
}

function processItemStabilityAndDecay(player) {
    if (!player.itemTimestamps) player.itemTimestamps = {};
    if (!player.inv) player.inv = {};

    const now = Date.now();
    const decayedItems = [];

    for (const [itemId, qty] of Object.entries(player.inv)) {
        if (qty <= 0) continue;

        const itemInfo = labData.items?.[itemId];
        if (itemInfo && itemInfo.shelfLife) {
            if (!player.itemTimestamps[itemId]) {
                player.itemTimestamps[itemId] = now;
            } else if (now - player.itemTimestamps[itemId] > itemInfo.shelfLife * 1000) {
                delete player.inv[itemId];
                delete player.itemTimestamps[itemId];
                player.inv['h2o_imp'] = (player.inv['h2o_imp'] || 0) + qty;
                decayedItems.push(itemInfo.name || itemId);
            }
        }
    }
    return decayedItems;
}

function getPlayerData(userId) {
    const db = loadDatabase();
    const ONE_DAY_MS = 86400000;

    if (!db[userId]) {
        db[userId] = {
            level: 1,
            xp: 0,
            coins: 200,
            abilityPoints: 2,
            academicReputation: 0,
            unlockedReactions: ['r_nacl'],
            ownedEquipment: { beaker: 1 },
            equipmentLevels: { beaker: 1 },
            inv: { na: 2, cl: 2, h2o_imp: 3, fe: 2, o2: 1 },
            itemTimestamps: {},
            codex: [],
            upgrades: { speed: false, shield: false },
            achievements: { cautious: 0, trader: 0, explorer: false },
            unlockedBadges: [],
            automatedProduct: null,
            lastAutoClaim: Date.now(),
            quest: generateDailyQuest(1),
            pendingQueue: []
        };
        saveDatabase();
    }

    const player = db[userId];

    // ضمان وجود الحقول الافتراضية للحسابات القديمة
    if (!player.equipmentLevels) player.equipmentLevels = { beaker: 1 };
    if (!player.achievements) player.achievements = { cautious: 0, trader: 0, explorer: false };
    if (!player.unlockedBadges) player.unlockedBadges = [];

    // تجديد المهمة اليومية
    if (!player.quest || (Date.now() - (player.quest.lastReset || 0)) > ONE_DAY_MS) {
        player.quest = generateDailyQuest(player.level || 1);
        saveDatabase();
    }

    return player;
}

function updatePlayerData(userId, data) {
    const db = loadDatabase();
    db[userId] = data;
    saveDatabase();
}

module.exports = {
    ensureDataFile,
    getMarketPrices,
    generateDailyQuest,
    processItemStabilityAndDecay,
    getPlayerData,
    updatePlayerData
};
