import { UserProfile } from "../database/models/UserProfile";

type EdgeType = "up" | "down" | "spouse";

interface NodeInfo {
  parentIds: string[];
  spouseIds: string[];
  childrenIds: string[];
}

const MAX_DEPTH = 6;

async function loadNode(userId: string, guildId: string, cache: Map<string, NodeInfo>): Promise<NodeInfo> {
  const cached = cache.get(userId);
  if (cached) return cached;

  const [profile, children] = await Promise.all([
    UserProfile.findOne({ userId, guildId }, { parentIds: 1, spouseIds: 1 }),
    UserProfile.find({ guildId, parentIds: userId }, { userId: 1 }),
  ]);

  const info: NodeInfo = {
    parentIds: profile?.parentIds ?? [],
    spouseIds: profile?.spouseIds ?? [],
    childrenIds: children.map((c) => c.userId),
  };
  cache.set(userId, info);
  return info;
}

/** يلاقي أقصر مسار بين شخصين عبر روابط أب/ابن/زوج، ويرجع تسلسل نوع كل رابطة */
async function shortestPath(aId: string, bId: string, guildId: string): Promise<EdgeType[] | null> {
  if (aId === bId) return [];

  const cache = new Map<string, NodeInfo>();
  const visited = new Set<string>([aId]);
  let frontier: { id: string; path: EdgeType[] }[] = [{ id: aId, path: [] }];

  for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
    const next: { id: string; path: EdgeType[] }[] = [];

    for (const node of frontier) {
      const info = await loadNode(node.id, guildId, cache);
      const neighbors: { id: string; type: EdgeType }[] = [
        ...info.parentIds.map((id) => ({ id, type: "up" as const })),
        ...info.childrenIds.map((id) => ({ id, type: "down" as const })),
        ...info.spouseIds.map((id) => ({ id, type: "spouse" as const })),
      ];

      for (const n of neighbors) {
        if (visited.has(n.id)) continue;
        const path = [...node.path, n.type];
        if (n.id === bId) return path;
        visited.add(n.id);
        next.push({ id: n.id, path });
      }
    }

    frontier = next;
  }

  return null;
}

const PATTERNS: Record<string, string> = {
  "": "نفسه",
  spouse: "الزوج/الزوجة",
  up: "أحد الوالدين",
  down: "الابن/الابنة",
  "up,down": "الأخ/الأخت",
  "up,up": "الجد/الجدة",
  "down,down": "الحفيد/الحفيدة",
  "up,spouse": "زوج/زوجة الوالد",
  "spouse,up": "والد/والدة الزوج",
  "spouse,down": "ابن/ابنة الزوج",
  "up,up,down": "العم/الخال أو العمة/الخالة",
  "down,up,up": "ابن/ابنة الأخ أو الأخت",
  "up,up,down,down": "ابن العم/الخال (أبناء العمومة)",
  "spouse,up,down": "أخ/أخت الزوج",
  "up,spouse,down": "الأخ/الأخت من زوج الوالد",
};

export interface RelationshipResult {
  label: string;
  pathLength: number | null;
}

/** يحسب العلاقة بين شخصين ويرجع أقرب تسمية عربية لها */
export async function computeRelationship(aId: string, bId: string, guildId: string): Promise<RelationshipResult> {
  const path = await shortestPath(aId, bId, guildId);
  if (path === null) return { label: "غرباء", pathLength: null };

  const key = path.join(",");
  const label = PATTERNS[key] ?? (path.length <= MAX_DEPTH ? "قريب بعيد" : "غرباء");
  return { label, pathLength: path.length };
}
