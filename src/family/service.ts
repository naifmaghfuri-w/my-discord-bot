import { Marriage } from "../database/models/Marriage";
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

  // نسجّل المهر لأجل الخلع (يرجع نصفه للزوج)
  const husbandId = fromGender === "male" ? fromId : toId;
  const wifeId = husbandId === fromId ? toId : fromId;
  await Marriage.updateOne(
    { guildId, husbandId, wifeId },
    { $set: { dowry, paidBy: fromId, createdAt: new Date() } },
    { upsert: true },
  ).catch(() => undefined);

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
  await Marriage.deleteMany({ guildId, $or: [{ husbandId: aId, wifeId: bId }, { husbandId: bId, wifeId: aId }] });
}

export type DivorceResult =
  | { ok: true; exSpouseId: string; refund?: number }
  | { ok: false; reason: "insufficient_refund"; needed: number }
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

/** خلع: للزوجة فقط. ترجع نصف المهر لزوجها (لو المهر مسجّل ودفعه الزوج) */
export async function khulaDivorce(wifeId: string, guildId: string): Promise<DivorceResult> {
  const wife = await getProfile(wifeId, guildId);
  const husbands = wife.spouseIds ?? [];
  if (husbands.length === 0) return { ok: false, reason: "not_married" };

  const husbandId = husbands[0];
  const record = await Marriage.findOne({ guildId, husbandId, wifeId });
  const refund = record && record.paidBy === husbandId ? Math.floor(record.dowry / 2) : 0;

  if (refund > 0) {
    // خصم ذرّي من محفظة الزوجة: لو ما تكفي ما يتم الخلع
    const took = await UserProfile.findOneAndUpdate({ userId: wifeId, guildId, coins: { $gte: refund } }, { $inc: { coins: -refund } });
    if (!took) return { ok: false, reason: "insufficient_refund", needed: refund };
    await UserProfile.updateOne({ userId: husbandId, guildId }, { $inc: { coins: refund } });
    await logTransaction(guildId, wifeId, "pay_sent", refund, husbandId);
    await logTransaction(guildId, husbandId, "pay_received", refund, wifeId);
  }

  await unlinkSpouses(wifeId, husbandId, guildId);
  return { ok: true, exSpouseId: husbandId, refund };
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

  // المتبنّي متزوج؟ الابن يصير ابنهم كلهم (الزوج/الزوجات)
  const adopter = await getProfile(parentId, guildId);
  const partners = (adopter.spouseIds ?? []).filter((id) => id !== childId && id !== parentId);
  if (partners.length > 0) {
    await UserProfile.updateOne({ userId: childId, guildId }, { $addToSet: { parentIds: { $each: partners } } });
  }
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

export type RunAwayResult = { ok: true; parentIds: string[] } | { ok: false; reason: "no_family" };

/** هروب: الابن يتخلى عن عائلته بالكامل (يفك رابطه مع كل والديه، ومعهم يروح الإخوة) */
export async function runAway(childId: string, guildId: string): Promise<RunAwayResult> {
  const child = await getProfile(childId, guildId);
  const parentIds = child.parentIds ?? [];
  if (parentIds.length === 0) return { ok: false, reason: "no_family" };
  await UserProfile.updateOne({ userId: childId, guildId }, { $set: { parentIds: [] } });
  return { ok: true, parentIds };
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
  /** الأجداد (أهل الوالدين) مع معرف الوالد اللي ينتمون له */
  grandparents: { profile: IUserProfile; viaId: string }[];
  /** أزواج/زوجات الأبناء (الصهر والكنة) مع معرف الابن/الابنة */
  childSpouses: { profile: IUserProfile; viaId: string }[];
  /** الأحفاد (أبناء الأبناء) مع معرف الابن اللي ينتمون له */
  grandchildren: { profile: IUserProfile; viaId: string }[];
}

/** يجمع كل أطراف عائلة العضو (والدان، أجداد، أزواج، إخوة، أبناء، أحفاد) */
export async function getFamilyView(userId: string, guildId: string): Promise<FamilyView> {
  const [parents, siblings, children, spouses] = await Promise.all([
    getParents(userId, guildId),
    getSiblings(userId, guildId),
    getChildren(userId, guildId),
    getSpouses(userId, guildId),
  ]);

  // الأجداد: والدا كل والد
  const gpIds = [...new Set(parents.flatMap((p) => p.parentIds ?? []))];
  const gpDocs = gpIds.length ? await UserProfile.find({ guildId, userId: { $in: gpIds } }) : [];
  const grandparents = gpDocs.map((profile) => ({
    profile,
    viaId: parents.find((p) => (p.parentIds ?? []).includes(profile.userId))?.userId ?? parents[0]?.userId ?? "",
  }));

  // الأحفاد: أبناء كل ابن
  const childIds = children.map((c) => c.userId);
  const gcDocs = childIds.length ? await UserProfile.find({ guildId, parentIds: { $in: childIds } }) : [];
  const grandchildren = gcDocs
    .filter((g) => g.userId !== userId)
    .map((profile) => ({ profile, viaId: (profile.parentIds ?? []).find((id) => childIds.includes(id)) ?? childIds[0] }));

  // أزواج الأبناء (حتى اثنين لكل ابن)
  const spouseIdsOf = new Map<string, string[]>(children.map((c) => [c.userId, (c.spouseIds ?? []).filter((id) => id !== userId).slice(0, 2)]));
  const csIds = [...new Set([...spouseIdsOf.values()].flat())];
  const csDocs = csIds.length ? await UserProfile.find({ guildId, userId: { $in: csIds } }) : [];
  const childSpouses: { profile: IUserProfile; viaId: string }[] = [];
  for (const c of children) {
    for (const id of spouseIdsOf.get(c.userId) ?? []) {
      const profile = csDocs.find((d) => d.userId === id);
      if (profile) childSpouses.push({ profile, viaId: c.userId });
    }
  }

  return { parents, siblings, children, spouses, grandparents, childSpouses, grandchildren };
}
