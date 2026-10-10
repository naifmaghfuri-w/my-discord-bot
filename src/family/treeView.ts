import type { Message } from "discord.js";
import { logger } from "../utils/logger";
import { getGender, type Gender } from "./gender";
import { computeRelationship } from "./graph";
import { cleanName, renderFamilyTree, roleLabel, toFamilyMember, type FamilyMember, type Role } from "./render";
import { getFamilyView } from "./service";

/**
 * يرسم شجرة عائلة targetId.
 * تحت كل دائرة: الاسم + علاقته بمن كتب الأمر (الأب، الأخت، غريب...).
 */
export async function sendFamilyTree(message: Message<true>, targetId: string): Promise<void> {
  const guild = message.guild;
  const guildId = guild.id;
  const viewerId = message.author.id;
  const ownTree = targetId === viewerId;

  const targetUser = await message.client.users.fetch(targetId).catch(() => null);
  if (!targetUser || targetUser.bot) {
    await message.channel.send("❌ ما لقيت هذا العضو.").catch(() => undefined);
    return;
  }

  const view = await getFamilyView(targetId, guildId).catch(() => null);
  if (!view) {
    await message.channel.send("❌ تعذّر جلب الشجرة، حاول لاحقاً.").catch(() => undefined);
    return;
  }

  /** علاقة الشخص بمن يشاهد الشجرة */
  const relationToViewer = async (id: string, gender: Gender, role: Role | null): Promise<string> => {
    if (id === viewerId) return "أنت";
    if (ownTree && role) return roleLabel(role, gender);
    const res = await computeRelationship(viewerId, id, guildId, gender).catch(() => null);
    if (!res || res.pathLength === null) return gender === "female" ? "غريبة" : "غريب";
    return res.label;
  };

  const build = async (id: string, role: Role | null): Promise<FamilyMember | null> => {
    const user = await message.client.users.fetch(id).catch(() => null);
    if (!user) return null;
    const member = await guild.members.fetch(id).catch(() => null);
    const gender: Gender = member ? getGender(member) : null;
    return toFamilyMember(
      id,
      cleanName(member?.displayName ?? user.username, user.username),
      user.displayAvatarURL({ extension: "png", size: 128 }),
      gender,
      await relationToViewer(id, gender, role),
    );
  };

  const [ego, parents, siblings, spouses, children, grandparents, grandchildren] = await Promise.all([
    build(targetId, null),
    Promise.all(view.parents.map((p) => build(p.userId, "parent"))),
    Promise.all(view.siblings.map((s) => build(s.userId, "sibling"))),
    Promise.all(view.spouses.map((s) => build(s.userId, "spouse"))),
    Promise.all(view.children.map((c) => build(c.userId, "child"))),
    Promise.all(view.grandparents.map(async (g) => ({ member: await build(g.profile.userId, "grandparent"), viaId: g.viaId }))),
    Promise.all(view.grandchildren.map(async (g) => ({ member: await build(g.profile.userId, "grandchild"), viaId: g.viaId }))),
  ]);

  if (!ego) {
    await message.channel.send("❌ تعذّر جلب بيانات العضو.").catch(() => undefined);
    return;
  }
  const keep = (list: (FamilyMember | null)[]) => list.filter((m): m is FamilyMember => m !== null);

  const buffer = await renderFamilyTree({
    title: ownTree ? "شجرة العائلة" : `شجرة عائلة ${ego.username}`,
    ego,
    parents: keep(parents),
    siblings: keep(siblings),
    spouses: keep(spouses),
    children: keep(children),
    grandparents: grandparents.flatMap((g) => (g.member ? [{ member: g.member, viaId: g.viaId }] : [])),
    grandchildren: grandchildren.flatMap((g) => (g.member ? [{ member: g.member, viaId: g.viaId }] : [])),
  }).catch((err) => {
    logger.error("فشل توليد صورة شجرة العائلة", err);
    return null;
  });

  if (!buffer) {
    await message.channel.send("❌ الخط العربي غير مثبت بعد، ما قدرت أرسم الشجرة.").catch(() => undefined);
    return;
  }
  await message.channel.send({ files: [{ attachment: buffer, name: "family-tree.png" }] }).catch(() => undefined);
}
