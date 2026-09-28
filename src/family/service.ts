import { UserProfile, type IUserProfile } from "../database/models/UserProfile";
import { getProfile } from "../services/economy";
import { logTransaction } from "../services/transactions";

export const FAMILY = {
  minDowry: 1,
  maxParents: 2,
} as const;

export type MarryResult =
  | { ok: true }
  | { ok: false; reason: "self" }
  | { ok: false; reason: "proposer_married" }
  | { ok: false; reason: "target_married" }
  | { ok: false; reason: "insufficient_dowry" };

/** يتأكد إن الاقتراح ممكن قبل ما نعرض زر القبول (بدون تنفيذ) */
export async function canPropose(fromId: string, toId: string, guildId: string, dowry: number): Promise<MarryResult> {
  if (fromId === toId) return { ok: false, reason: "self" };
  const [from, to] = await Promise.all([getProfile(fromId, guildId), getProfile(toId, guildId)]);
  if (from.spouseId) return { ok: false, reason: "proposer_married" };
  if (to.spouseId) return { ok: false, reason: "target_married" };
  if (from.coins < dowry) return { ok: false, reason: "insufficient_dowry" };
  return { ok: true };
}

/** ينفّذ الزواج فعلياً بعد ما الطرف الثاني يضغط قبول (يعيد التحقق بشكل ذري) */
export async function marry(fromId: string, toId: string, guildId: string, dowry: number): Promise<MarryResult> {
  const check = await canPropose(fromId, toId, guildId, dowry);
  if (!check.ok) return check;

  const paid = await UserProfile.findOneAndUpdate(
    { userId: fromId, guildId, coins: { $gte: dowry }, spouseId: { $exists: false } },
    { $inc: { coins: -dowry }, $set: { spouseId: toId } },
    { new: true },
  );
  if (!paid) return { ok: false, reason: "insufficient_dowry" };

  await UserProfile.updateOne({ userId: toId, guildId }, { $inc: { coins: dowry }, $set: { spouseId: fromId } });
  await logTransaction(guildId, fromId, "pay_sent", dowry, toId);
  await logTransaction(guildId, toId, "pay_received", dowry, fromId);
  return { ok: true };
}

export async function divorce(userId: string, guildId: string): Promise<string | null> {
  const profile = await getProfile(userId, guildId);
  if (!profile.spouseId) return null;
  const spouseId = profile.spouseId;
  await UserProfile.updateOne({ userId, guildId }, { $unset: { spouseId: "" } });
  await UserProfile.updateOne({ userId: spouseId, guildId }, { $unset: { spouseId: "" } });
  return spouseId;
}

export type AdoptResult =
  | { ok: true }
  | { ok: false; reason: "self" }
  | { ok: false; reason: "already_parent" }
  | { ok: false; reason: "child_has_two_parents" }
  | { ok: false; reason: "not_stepparent" };

/** يتأكد إن التبني ممكن (بدون تنفيذ) */
export async function canAdopt(parentId: string, childId: string, guildId: string): Promise<AdoptResult> {
  if (parentId === childId) return { ok: false, reason: "self" };
  const [parent, child] = await Promise.all([getProfile(parentId, guildId), getProfile(childId, guildId)]);
  const existingParents = child.parentIds ?? [];

  if (existingParents.includes(parentId)) return { ok: false, reason: "already_parent" };

  if (existingParents.length === 0) return { ok: true };
  if (existingParents.length >= FAMILY.maxParents) return { ok: false, reason: "child_has_two_parents" };

  // عنده والد وحد مسجّل: لازم تكون متزوج منه عشان تصير الوالد الثاني (زوج أب/أم)
  if (parent.spouseId && existingParents.includes(parent.spouseId)) return { ok: true };
  return { ok: false, reason: "not_stepparent" };
}

export async function adopt(parentId: string, childId: string, guildId: string): Promise<AdoptResult> {
  const check = await canAdopt(parentId, childId, guildId);
  if (!check.ok) return check;

  await UserProfile.updateOne(
    { userId: childId, guildId },
    { $addToSet: { parentIds: parentId } },
    { upsert: true },
  );
  return { ok: true };
}

export async function getChildren(userId: string, guildId: string): Promise<IUserProfile[]> {
  return UserProfile.find({ guildId, parentIds: userId });
}

export async function getParents(userId: string, guildId: string): Promise<IUserProfile[]> {
  const profile = await getProfile(userId, guildId);
  const ids = profile.parentIds ?? [];
  if (ids.length === 0) return [];
  return UserProfile.find({ guildId, userId: { $in: ids } });
}

export async function getSiblings(userId: string, guildId: string): Promise<IUserProfile[]> {
  const parents = await getParents(userId, guildId);
  if (parents.length === 0) return [];
  const ids = parents.map((p) => p.userId);
  const siblings = await UserProfile.find({ guildId, parentIds: { $in: ids }, userId: { $ne: userId } });
  // إزالة التكرار (لو مشترك بالأبوين الاثنين يطلع مرتين)
  const seen = new Set<string>();
  return siblings.filter((s) => (seen.has(s.userId) ? false : (seen.add(s.userId), true)));
}

export interface FamilyView {
  parents: IUserProfile[];
  spouse: IUserProfile | null;
  siblings: IUserProfile[];
  children: IUserProfile[];
}

/** يجمع كل أطراف عائلة العضو (والدان، زوج، إخوة، أبناء) بأربع استعلامات متوازية */
export async function getFamilyView(userId: string, guildId: string): Promise<FamilyView> {
  const profile = await getProfile(userId, guildId);
  const [parents, siblings, children, spouse] = await Promise.all([
    getParents(userId, guildId),
    getSiblings(userId, guildId),
    getChildren(userId, guildId),
    profile.spouseId ? UserProfile.findOne({ userId: profile.spouseId, guildId }) : Promise.resolve(null),
  ]);
  return { parents, siblings, children, spouse };
}
