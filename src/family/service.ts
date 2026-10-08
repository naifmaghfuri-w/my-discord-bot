import { UserProfile, type IUserProfile } from "../database/models/UserProfile";
import { getProfile } from "../services/economy";
import { logTransaction } from "../services/transactions";
import type { Gender } from "./gender";

export const FAMILY = {
  /** 0 = الزواج المجاني مسموح (مهر 0) */
  minDowry: 0,
  maxParents: 2,
  maxWivesForMale: 4,
  maxHusbandsForFemale: 1,
} as const;

function spouseCapacity(gender: Gender): number {
  return gender === "male" ? FAMILY.maxWivesForMale : FAMILY.maxHusbandsForFemale;
}

export type MarryResult =
  | { ok: true }
  | { ok: false; reason: "self" }
  | { ok: false; reason: "gender_unknown" }
  | { ok: false; reason: "same_gender" }
  | { ok: false; reason: "proposer_full" }
  | { ok: false; reason: "target_full" }
  | { ok: false; reason: "already_married_each_other" }
  | { ok: false; reason: "insufficient_dowry" };

/** يتأكد إن الاقتراح ممكن قبل ما نعرض زر القبول (بدون تنفيذ) */
export async function canPropose(
  fromId: string,
  toId: string,
  guildId: string,
  dowry: number,
  fromGender: Gender,
  toGender: Gender,
): Promise<MarryResult> {
  if (fromId === toId) return { ok: false, reason: "self" };
  if (!fromGender || !toGender) return { ok: false, reason: "gender_unknown" };
  if (fromGender === toGender) return { ok: false, reason: "same_gender" };

  const [from, to] = await Promise.all([getProfile(fromId, guildId), getProfile(toId, guildId)]);
  const fromSpouses = from.spouseIds ?? [];
  const toSpouses = to.spouseIds ?? [];

  if (fromSpouses.includes(toId)) return { ok: false, reason: "already_married_each_other" };
  if (fromSpouses.length >= spouseCapacity(fromGender)) return { ok: false, reason: "proposer_full" };
  if (toSpouses.length >= spouseCapacity(toGender)) return { ok: false, reason: "target_full" };
  if (dowry < FAMILY.minDowry || from.coins < dowry) return { ok: false, reason: "insufficient_dowry" };
  return { ok: true };
}

/** ينفّذ الزواج فعلياً (بعد كل موافقات القبول اللازمة)، بحارس ذري على الطرفين */
export async function marry(
  fromId: string,
  toId: string,
  guildId: string,
  dowry: number,
  fromGender: Gender,
  toGender: Gender,
): Promise<MarryResult> {
  const check = await canPropose(fromId, toId, guildId, dowry, fromGender, toGender);
  if (!check.ok) return check;

  const paid = await UserProfile.findOneAndUpdate(
    {
      userId: fromId,
      guildId,
      coins: { $gte: dowry },
      $expr: { $lt: [{ $size: { $ifNull: ["$spouseIds", []] } }, spouseCapacity(fromGender)] },
    },
    { $inc: { coins: -dowry }, $addToSet: { spouseIds: toId } },
    { new: true },
  );
  if (!paid) return { ok: false, reason: "insufficient_dowry" };

  const confirmed = await UserProfile.findOneAndUpdate(
    {
      userId: toId,
      guildId,
      $expr: { $lt: [{ $size: { $ifNull: ["$spouseIds", []] } }, spouseCapacity(toGender)] },
    },
    { $inc: { coins: dowry }, $addToSet: { spouseIds: fromId } },
    { new: true },
  );
  if (!confirmed) {
    await UserProfile.updateOne(
      { userId: fromId, guildId },
      { $inc: { coins: dowry }, $pull: { spouseIds: toId } },
    );
    return { ok: false, reason: "target_full" };
  }

  // المهر 0 ما نسجله كعملية مالية (ما فيه مبلغ ينتقل)
  if (dowry > 0) {
    await logTransaction(guildId, fromId, "pay_sent", dowry, toId);
    await logTransaction(guildId, toId, "pay_received", dowry, fromId);
  }
  return { ok: true };
}

async function unlinkSpouses(aId: string, bId: string, guildId: string): Promise<void> {
  await UserProfile.updateOne({ userId: aId, guildId }, { $pull: { spouseIds: bId } });
  await UserProfile.updateOne({ userId: bId, guildId }, { $pull: { spouseIds: aId } });
}

export type DivorceResult =
  | { ok: true; exSpouseId: string }
  | { ok: false; reason: "not_married" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "specify_wife" };

/** طلاق: للزوج فقط. لو عنده أكثر من زوجة لازم يحدد وحدة */
export async function talaqDivorce(husbandId: string, guildId: string, wifeId?: string): Promise<DivorceResult> {
  const husband = await getProfile(husbandId, guildId);
  const wives = husband.spouseIds ?? [];
  if (wives.length === 0) return { ok: false, reason: "not_married" };

  let target = wifeId;
  if (!target) {
    if (wives.length > 1) return { ok: false, reason: "specify_wife" };
    target = wives[0];
  }
  if (!wives.includes(target)) return { ok: false, reason: "not_found" };

  await unlinkSpouses(husbandId, target, guildId);
  return { ok: true, exSpouseId: target };
}

/** خلع: للزوجة فقط (حد أقصى زوج واحد أصلاً، فما فيه لبس بمين) */
export async function khulaDivorce(wifeId: string, guildId: string): Promise<DivorceResult> {
  const wife = await getProfile(wifeId, guildId);
  const husbands = wife.spouseIds ?? [];
  if (husbands.length === 0) return { ok: false, reason: "not_married" };

  const husbandId = husbands[0];
  await unlinkSpouses(wifeId, husbandId, guildId);
  return { ok: true, exSpouseId: husbandId };
}

export type AdoptResult =
  | { ok: true }
  | { ok: false; reason: "self" }
  | { ok: false; reason: "gender_unknown" }
  | { ok: false; reason: "already_parent" }
  | { ok: false; reason: "same_gender_parent" }
  | { ok: false; reason: "child_has_two_parents" }
  | { ok: false; reason: "not_stepparent" };

/** يتأكد إن التبني ممكن (بدون تنفيذ). existingParentGenders: جنس كل والد مسجّل حالياً للطفل */
export async function canAdopt(
  parentId: string,
  childId: string,
  guildId: string,
  parentGender: Gender,
  existingParentGenders: Gender[],
): Promise<AdoptResult> {
  if (parentId === childId) return { ok: false, reason: "self" };
  if (!parentGender) return { ok: false, reason: "gender_unknown" };

  const child = await getProfile(childId, guildId);
  const existingParents = child.parentIds ?? [];

  if (existingParents.includes(parentId)) return { ok: false, reason: "already_parent" };
  if (existingParentGenders.includes(parentGender)) return { ok: false, reason: "same_gender_parent" };

  if (existingParents.length === 0) return { ok: true };
  if (existingParents.length >= FAMILY.maxParents) return { ok: false, reason: "child_has_two_parents" };

  // عنده والد وحد مسجّل: لازم تكون متزوج منه عشان تصير الوالد الثاني (زوج أب/أم)
  const parent = await getProfile(parentId, guildId);
  const spouses = parent.spouseIds ?? [];
  if (existingParents.some((id) => spouses.includes(id))) return { ok: true };
  return { ok: false, reason: "not_stepparent" };
}

export async function adopt(
  parentId: string,
  childId: string,
  guildId: string,
  parentGender: Gender,
  existingParentGenders: Gender[],
): Promise<AdoptResult> {
  const check = await canAdopt(parentId, childId, guildId, parentGender, existingParentGenders);
  if (!check.ok) return check;

  await UserProfile.updateOne({ userId: childId, guildId }, { $addToSet: { parentIds: parentId } }, { upsert: true });
  return { ok: true };
}

export type DisownResult = { ok: true } | { ok: false; reason: "not_your_child" };

/** تبرؤ: الأب يفك رابط الأبوة مع ابنه/ابنته */
export async function disown(fatherId: string, childId: string, guildId: string): Promise<DisownResult> {
  const child = await getProfile(childId, guildId);
  if (!(child.parentIds ?? []).includes(fatherId)) return { ok: false, reason: "not_your_child" };

  await UserProfile.updateOne({ userId: childId, guildId }, { $pull: { parentIds: fatherId } });
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

export async function getSpouses(userId: string, guildId: string): Promise<IUserProfile[]> {
  const profile = await getProfile(userId, guildId);
  const ids = profile.spouseIds ?? [];
  if (ids.length === 0) return [];
  return UserProfile.find({ guildId, userId: { $in: ids } });
}

export interface FamilyView {
  parents: IUserProfile[];
  spouses: IUserProfile[];
  siblings: IUserProfile[];
  children: IUserProfile[];
}

/** يجمع كل أطراف عائلة العضو (والدان، أزواج، إخوة، أبناء) */
export async function getFamilyView(userId: string, guildId: string): Promise<FamilyView> {
  const [parents, siblings, children, spouses] = await Promise.all([
    getParents(userId, guildId),
    getSiblings(userId, guildId),
    getChildren(userId, guildId),
    getSpouses(userId, guildId),
  ]);
  return { parents, siblings, children, spouses };
}

