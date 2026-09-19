import * as fs from 'fs';
import * as path from 'path';
import labData from './data';

// --- الواجهات والأنواع (Interfaces & Types) ---

export interface LabItem {
    name?: string;
    price: number;
    buyable?: boolean;
    shelfLife?: number; // بالثواني
}

export interface LabDataStructure {
    items?: Record<string, LabItem>;
}

export interface DailyQuest {
    item: string;
    count: number;
    progress: number;
    rewardCoins: number;
    rewardXp: number;
    completed: boolean;
    lastReset: number;
}

export interface Upgrades {
    speed: boolean;
    shield: boolean;
}

export interface Achievements {
    cautious: number;
    trader: number;
    explorer: boolean;
}

export interface QueueItem {
    id: string;
    finishTime: number;
    [key: string]: unknown;
}

export interface PlayerData {
    level: number;
    xp: number;
    coins: number;
    abilityPoints: number;
    academicReputation?: number;
    unlockedReactions: string[];
    // تم التعديل لتقبل أرقام أو بولين لتتوافق تماماً مع ملف lab.ts و helpers.ts
    ownedEquipment: Record<string, number | boolean>;
    equipmentLevels: Record<string, number>;
    inv: Record<string, number>;
    itemTimestamps: Record<string, number>;
    codex: string[];
    upgrades: Upgrades;
    achievements: Achievements;
    unlockedBadges: string[];
    automatedProduct: string | null;
    lastAutoClaim: number;
    quest: DailyQuest;
    pendingQueue: QueueItem[];
}

export type Database = Record<string, PlayerData>;

// --- الإعدادات والمتغيرات ---

const dataPath: string = path.join(__dirname, 'labData.json');

// التخزين المؤقت في الذاكرة
let dbCache: Database | null = null;
let saveTimeout: NodeJS.Timeout | null = null;

// صب البيانات المستوردة إلى النوع المحدد
const typedLabData = labData as LabDataStructure;

// --- الدوال ---

export function ensureDataFile(): void {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify({}, null, 2), 'utf8');
    }
}

export function loadDatabase(): Database {
    if (dbCache) return dbCache;
    ensureDataFile();
    try {
        const raw = fs.readFileSync(dataPath, 'utf8');
        dbCache = JSON.parse(raw) as Database;
    } catch (err) {
        console.error('فشل في قراءة ملف البيانات، تم إعادة التعيين إلى كائن فارغ:', err);
        dbCache = {};
    }
    return dbCache;
}

// حفظ آمن مع تأجيل (Debounce) لمنع كتابة الملف بشكل مستمر ومتكرر
export function saveDatabase(immediate: boolean = false): void {
    if (!dbCache) return;

    const performSave = async () => {
        try {
            await fs.promises.writeFile(dataPath, JSON.stringify(dbCache, null, 2), 'utf8');
        } catch (err) {
            console.error('فشل في حفظ ملف البيانات:', err);
        }
    };

    if (immediate) {
        if (saveTimeout) clearTimeout(saveTimeout);
        performSave();
        return;
    }

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(performSave, 1000);
}

export function getMarketPrices(): Record<string, number> {
    const minuteSeed = Math.floor(Date.now() / 300000); // تتغير الأسعار كل 5 دقائق
    const prices: Record<string, number> = {};

    const items = typedLabData.items || {};
    for (const [id, item] of Object.entries(items)) {
        if (item.price > 0) {
            const factor = 0.7 + (Math.abs(Math.sin(minuteSeed + id.length)) * 0.6);
            prices[id] = Math.round(item.price * factor);
        }
    }
    return prices;
}

export function generateDailyQuest(playerLevel: number = 1): DailyQuest {
    const items = typedLabData.items || {};
    const targetItems = Object.entries(items).filter(
        ([_, item]) => !item.buyable && item.price > 0
    );

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

    const randomIndex = Math.floor(Math.random() * targetItems.length);
    const [randomItem] = targetItems[randomIndex];
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

export function processItemStabilityAndDecay(player: PlayerData): string[] {
    if (!player.itemTimestamps) player.itemTimestamps = {};
    if (!player.inv) player.inv = {};

    const now = Date.now();
    const decayedItems: string[] = [];

    for (const [itemId, qty] of Object.entries(player.inv)) {
        if (qty <= 0) {
            delete player.inv[itemId];
            delete player.itemTimestamps[itemId];
            continue;
        }

        const itemInfo = typedLabData.items?.[itemId];
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

export function getPlayerData(userId: string): PlayerData {
    const db = loadDatabase();
    const ONE_DAY_MS = 86400000;
    let isModified = false;

    if (!db[userId]) {
        db[userId] = {
            level: 1,
            xp: 0,
            coins: 200,
            abilityPoints: 2,
            academicReputation: 0,
            unlockedReactions: ['r_nacl'],
            ownedEquipment: { beaker: true }, // استخدام قيمة بولينية للبداية لتتوافق مع الأنظمة
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
        isModified = true;
    }

    const player = db[userId];

    if (player.academicReputation === undefined) { player.academicReputation = 0; isModified = true; }
    if (!player.equipmentLevels) { player.equipmentLevels = { beaker: 1 }; isModified = true; }
    if (!player.achievements) { player.achievements = { cautious: 0, trader: 0, explorer: false }; isModified = true; }
    if (!player.unlockedBadges) { player.unlockedBadges = []; isModified = true; }
    if (!player.itemTimestamps) { player.itemTimestamps = {}; isModified = true; }
    if (!player.pendingQueue) { player.pendingQueue = []; isModified = true; }

    const decayed = processItemStabilityAndDecay(player);
    if (decayed.length > 0) isModified = true;

    if (!player.quest || (Date.now() - (player.quest.lastReset || 0)) > ONE_DAY_MS) {
        player.quest = generateDailyQuest(player.level || 1);
        isModified = true;
    }

    if (isModified) {
        saveDatabase();
    }

    return player;
}

export function updatePlayerData(userId: string, data: PlayerData): void {
    const db = loadDatabase();
    
    if (data.academicReputation === undefined) {
        data.academicReputation = 0;
    }

    db[userId] = data;
    saveDatabase();
}
