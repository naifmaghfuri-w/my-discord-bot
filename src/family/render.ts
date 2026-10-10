import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { FONT_BOLD, ensureFontsRegistered } from "../quests/render/fonts";
import { stripStreak } from "../streak/nick";
import type { Gender } from "./gender";

const NODE_R = 55;
const SLOT = 170; // المسافة بين مراكز الأشخاص بنفس الصف
const ROW_GAP = 270; // المسافة العمودية بين الصفوف
const PILL_H = 60;
const MARGIN_X = 90;

const COLORS = {
  parent: "#c084fc",
  sibling: "#94a3b8",
  spouse: "#f472b6",
  child: "#4ade80",
  grandparent: "#818cf8",
  grandchild: "#34d399",
  ego: "#facc15",
} as const;

export interface FamilyMember {
  userId: string;
  username: string;
  avatarURL: string;
  gender: Gender;
  /** من هو بالنسبة لمن يشاهد الشجرة (يُكتب تحت الصورة): الأب، الأخت، غريب... */
  relation: string;
  /** معرفات والدَي العضو (تُستخدم لرسم الخط من منتصف الزوجين) */
  parentIds?: string[];
}

export interface FamilyTreeInput {
  title: string;
  ego: FamilyMember;
  spouses: FamilyMember[];
  parents: FamilyMember[];
  siblings: FamilyMember[];
  children: FamilyMember[];
  /** الأجداد، viaId = الوالد اللي ينتمون له */
  grandparents: { member: FamilyMember; viaId: string }[];
  /** أزواج/زوجات الأبناء (الصهر والكنة)، viaId = الابن/الابنة */
  childSpouses: { member: FamilyMember; viaId: string }[];
  /** الأحفاد، viaIds = والداهم (الابن وزوجه) */
  grandchildren: { member: FamilyMember; viaIds: string[] }[];
}

export type Role = "parent" | "sibling" | "spouse" | "child" | "grandparent" | "grandchild";

const ROLE_LABELS: Record<Role, { male: string; female: string; unknown: string }> = {
  parent: { male: "الأب", female: "الأم", unknown: "الوالد" },
  sibling: { male: "الأخ", female: "الأخت", unknown: "الأخ/الأخت" },
  spouse: { male: "الزوج", female: "الزوجة", unknown: "الزوج/الزوجة" },
  child: { male: "الابن", female: "الابنة", unknown: "الابن/الابنة" },
  grandparent: { male: "الجد", female: "الجدة", unknown: "الجد/الجدة" },
  grandchild: { male: "الحفيد", female: "الحفيدة", unknown: "الحفيد/الحفيدة" },
};

/** صهر (زوج البنت) أو كنة (زوجة الابن): نعتمد جنس الزوج نفسه، وإلا عكس جنس الابن */
export function inLawLabel(spouseGender: Gender, childGender: Gender): string {
  if (spouseGender === "male") return "الصهر";
  if (spouseGender === "female") return "الكنة";
  if (childGender === "female") return "الصهر";
  if (childGender === "male") return "الكنة";
  return "الصهر/الكنة";
}

/** تسمية العلاقة حسب الدور والجنس */
export function roleLabel(role: Role, gender: Gender): string {
  const f = ROLE_LABELS[role];
  return gender === "male" ? f.male : gender === "female" ? f.female : f.unknown;
}

/**
 * ينظف الاسم من الحروف الزخرفية اللي ما يدعمها الخط (تظهر مربعات):
 * يحوّل الحروف المزخرفة لحروف عادية (NFKC) ثم يبقي العربي واللاتيني والأرقام فقط.
 */
export function cleanName(name: string, fallback: string): string {
  const clean = (s: string) =>
    s
      .normalize("NFKC")
      .replace(/[^\p{Script=Arabic}\p{Script=Latin}\p{N}\s_.\-]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  return clean(stripStreak(name)) || clean(stripStreak(fallback)) || "عضو";
}

async function fetchAvatar(url: string): Promise<Image | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await loadImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

function line(ctx: SKRSContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function heart(ctx: SKRSContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = COLORS.spouse;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.5, y - s * 1.1, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s, y - s * 0.5, x, y + s * 0.35);
  ctx.closePath();
  ctx.fill();
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}..` : text;
}

interface Placed {
  member: FamilyMember;
  image: Image | null;
  x: number;
  y: number;
  ring: string;
}

/** الدائرة + تحتها الاسم، وتحته العلاقة بالنسبة لمن يشاهد الشجرة */
function drawNode(ctx: SKRSContext2D, n: Placed) {
  const { x, y, ring, member, image } = n;

  ctx.beginPath();
  ctx.arc(x, y, NODE_R + 4, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (image) ctx.drawImage(image, x - NODE_R, y - NODE_R, NODE_R * 2, NODE_R * 2);
  else {
    ctx.fillStyle = "#334155";
    ctx.fillRect(x - NODE_R, y - NODE_R, NODE_R * 2, NODE_R * 2);
  }
  ctx.restore();

  const name = truncate(member.username, 13);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `700 20px "${FONT_BOLD}"`;
  const nameW = ctx.measureText(name).width;
  ctx.font = `700 18px "${FONT_BOLD}"`;
  const relW = ctx.measureText(member.relation).width;

  const w = Math.max(nameW, relW, 70) + 26;
  const x0 = x - w / 2;
  const y0 = y + NODE_R + 10;

  // خلفية خفيفة تضمن وضوح النص حتى لو مرّ خط خلفه
  ctx.fillStyle = "rgba(11,10,20,0.82)";
  ctx.beginPath();
  ctx.roundRect(x0, y0, w, PILL_H, 12);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 20px "${FONT_BOLD}"`;
  ctx.fillText(name, x, y0 + 7);
  ctx.fillStyle = ring;
  ctx.font = `700 18px "${FONT_BOLD}"`;
  ctx.fillText(member.relation, x, y0 + 33);
}

/**
 * شجرة بصفوف مرتبة:
 *  0) الأجداد   1) الوالدان   2) الإخوة (يسار) • الشخص • الأزواج (يمين)   3) الأبناء (مع أزواجهم)   4) الأحفاد
 * صاحب الشجرة دايمًا بمنتصف الصورة، والصورة تصغر لو صارت عريضة.
 */
export async function renderFamilyTree(data: FamilyTreeInput): Promise<Buffer | null> {
  if (!ensureFontsRegistered()) return null;

  const MAX_SIBLINGS = 6;
  const MAX_SPOUSES = 4;
  const MAX_CHILDREN = 6;
  const MAX_GRANDCHILDREN = 8;
  const MAX_PARENTS = 4;
  const UNIT_GAP = 40;
  const MAX_WIDTH = 1200;

  const siblings = data.siblings.slice(0, MAX_SIBLINGS);
  const spouses = data.spouses.slice(0, MAX_SPOUSES);
  const children = data.children.slice(0, MAX_CHILDREN);
  const extraChildren = data.children.length - children.length;
  const parents = data.parents.slice(0, MAX_PARENTS);
  const hasParents = parents.length > 0;
  const grandparents = data.grandparents.filter((g) => parents.some((p) => p.userId === g.viaId)).slice(0, 4);
  const hasGrand = grandparents.length > 0;
  const grandchildren = data.grandchildren.slice(0, MAX_GRANDCHILDREN);
  const extraGrandchildren = data.grandchildren.length - grandchildren.length;
  const gcSlots = grandchildren.length + (extraGrandchildren > 0 ? 1 : 0);

  // ───── المواضع النسبية (الشخص الرئيسي عند x = 0) ─────
  const egoX = 0;
  const sibXs = siblings.map((_, i) => -SLOT * (siblings.length - i));
  const spouseXs = spouses.map((_, i) => SLOT * (i + 1));
  const rowXs = [...sibXs, egoX];
  const groupMid = (Math.min(...rowXs) + Math.max(...rowXs)) / 2;
  // الوالدان (وزوجاتهم/أزواجهم لو الابن متبنى من متزوج) صف واحد حول منتصف الإخوة
  const parentSpacing = parents.length === 2 ? (hasGrand ? SLOT * 2 : 250) : SLOT;
  const parentXs = parents.map((_, i) => groupMid + (i - (parents.length - 1) / 2) * parentSpacing);

  // الأبناء: كل ابن + أزواجه بجنبه، وتتوزع الوحدات حول منتصف الصورة
  const units = children.map((c) => ({
    child: c,
    spouses: data.childSpouses.filter((s) => s.viaId === c.userId).map((s) => s.member).slice(0, 2),
  }));
  const rel: { childX: number; spouseXs: number[] }[] = [];
  let cursor = 0;
  for (const u of units) {
    rel.push({ childX: cursor, spouseXs: u.spouses.map((_, k) => cursor + SLOT * (k + 1)) });
    cursor += SLOT * u.spouses.length + SLOT + UNIT_GAP;
  }
  const extraRel = extraChildren > 0 ? cursor : null;
  const lastRel = extraRel ?? (rel.length ? Math.max(...rel.flatMap((r) => [r.childX, ...r.spouseXs])) : 0);
  const childOffset = egoX - lastRel / 2;
  const childXs = rel.map((r) => r.childX + childOffset);
  const childSpouseXs = rel.map((r) => r.spouseXs.map((x) => x + childOffset));
  const extraX = extraRel !== null ? extraRel + childOffset : null;
  const hasChildren = children.length > 0 || extraChildren > 0;

  // الأجداد فوق والدهم
  const gpXs: number[] = [];
  parents.forEach((par, pi) => {
    const mine = grandparents.filter((g) => g.viaId === par.userId);
    mine.forEach((g, j) => {
      gpXs[grandparents.indexOf(g)] = parentXs[pi] + (j - (mine.length - 1) / 2) * SLOT;
    });
  });

  // الأحفاد صف واحد تحت الأبناء
  const gcXs = grandchildren.map((_, i) => egoX + (i - (gcSlots - 1) / 2) * SLOT);
  const gcExtraX = extraGrandchildren > 0 ? egoX + (grandchildren.length - (gcSlots - 1) / 2) * SLOT : null;

  const allXs = [
    ...rowXs, ...spouseXs, ...parentXs, ...childXs, ...childSpouseXs.flat(), ...(extraX !== null ? [extraX] : []),
    ...gpXs, ...gcXs, ...(gcExtraX !== null ? [gcExtraX] : []),
  ];
  // صاحب الشجرة دايمًا بالمنتصف: العرض متماثل حول x = 0
  const half = Math.max(Math.abs(Math.min(...allXs)), Math.abs(Math.max(...allXs))) + MARGIN_X;
  const W = Math.max(760, Math.round(half * 2));
  const X = (x: number) => Math.round(x + W / 2);

  // ───── المواضع العمودية ─────
  const top = 80 + 30 + NODE_R;
  const gpY = top;
  const parentY = hasGrand ? gpY + ROW_GAP : top;
  const egoY = hasParents ? parentY + ROW_GAP : top;
  const childY = egoY + ROW_GAP;
  const gcY = (hasChildren ? childY : egoY) + ROW_GAP;
  const lastY = gcSlots > 0 ? gcY : hasChildren ? childY : egoY;
  const H = lastY + NODE_R + PILL_H + 50;

  // لو الصورة عريضة نصغّرها بدل ما تنحرف الشجرة لجهة
  const scale = Math.min(1, MAX_WIDTH / W);
  const canvas = createCanvas(Math.round(W * scale), Math.round(H * scale));
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // الخلفية
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#1e1b2e");
  grad.addColorStop(1, "#0b0a14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, Math.max(W, H) * 0.6);
  glow.addColorStop(0, "rgba(168,85,247,0.10)");
  glow.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // العنوان (بدون إيموجي: الخط ما يدعمه ويظهر مربع)
  ctx.fillStyle = "#e9d5ff";
  ctx.font = `800 32px "${FONT_BOLD}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(data.title, W / 2, 28);

  // ───── تحميل الصور بالتوازي ─────
  const load = (m: FamilyMember) => fetchAvatar(m.avatarURL);
  const [egoImg, parentImgs, sibImgs, spouseImgs, childImgs, csImgs, gpImgs, gcImgs] = await Promise.all([
    load(data.ego),
    Promise.all(parents.map(load)),
    Promise.all(siblings.map(load)),
    Promise.all(spouses.map(load)),
    Promise.all(children.map(load)),
    Promise.all(units.map((u) => Promise.all(u.spouses.map(load)))),
    Promise.all(grandparents.map((g) => load(g.member))),
    Promise.all(grandchildren.map((g) => load(g.member))),
  ]);

  const nodes: Placed[] = [];
  grandparents.forEach((g, i) => nodes.push({ member: g.member, image: gpImgs[i], x: X(gpXs[i]), y: gpY, ring: COLORS.grandparent }));
  parents.forEach((m, i) => nodes.push({ member: m, image: parentImgs[i], x: X(parentXs[i]), y: parentY, ring: COLORS.parent }));
  siblings.forEach((m, i) => nodes.push({ member: m, image: sibImgs[i], x: X(sibXs[i]), y: egoY, ring: COLORS.sibling }));
  spouses.forEach((m, i) => nodes.push({ member: m, image: spouseImgs[i], x: X(spouseXs[i]), y: egoY, ring: COLORS.spouse }));
  children.forEach((m, i) => nodes.push({ member: m, image: childImgs[i], x: X(childXs[i]), y: childY, ring: COLORS.child }));
  units.forEach((u, i) => u.spouses.forEach((m, k) => nodes.push({ member: m, image: csImgs[i][k], x: X(childSpouseXs[i][k]), y: childY, ring: COLORS.spouse })));
  grandchildren.forEach((g, i) => nodes.push({ member: g.member, image: gcImgs[i], x: X(gcXs[i]), y: gcY, ring: COLORS.grandchild }));
  nodes.push({ member: data.ego, image: egoImg, x: X(egoX), y: egoY, ring: COLORS.ego });

  const below = (y: number) => y + NODE_R + PILL_H + 16;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  // ───── الخطوط (ترسم أولاً حتى تكون خلف الدوائر) ─────
  // الأجداد ← الوالد
  if (hasGrand) {
    const busY = parentY - NODE_R - 45;
    parents.forEach((par, pi) => {
      const mineIdx = grandparents.map((g, i) => (g.viaId === par.userId ? i : -1)).filter((i) => i >= 0);
      if (mineIdx.length === 0) return;
      const px = X(parentXs[pi]);
      const xs = mineIdx.map((i) => X(gpXs[i]));
      line(ctx, Math.min(px, ...xs), busY, Math.max(px, ...xs), busY, COLORS.grandparent);
      line(ctx, px, busY, px, parentY - NODE_R - 4, COLORS.grandparent);
      for (const gx of xs) line(ctx, gx, below(gpY), gx, busY, COLORS.grandparent);
    });
  }

  // الوالدان ← الخط ينزل من منتصفهم ← الإخوة والشخص
  if (hasParents) {
    const busY = egoY - NODE_R - 45;
    const pxs = parentXs.map(X);
    const midX = Math.round(mean(pxs));
    if (parents.length >= 2) line(ctx, Math.min(...pxs), parentY, Math.max(...pxs), parentY, COLORS.parent);
    const dropFrom = parents.length >= 2 ? parentY : below(parentY);
    line(ctx, midX, dropFrom, midX, busY, COLORS.parent);
    const xs = rowXs.map(X);
    line(ctx, Math.min(midX, ...xs), busY, Math.max(midX, ...xs), busY, COLORS.parent);
    for (const x of xs) line(ctx, x, busY, x, egoY - NODE_R - 4, COLORS.parent);
  }

  // الأزواج: خط أفقي من الشخص مع قلب بين كل اثنين
  if (spouses.length > 0) line(ctx, X(egoX), egoY, X(spouseXs[spouses.length - 1]), egoY, COLORS.spouse);
  // أزواج الأبناء
  units.forEach((_, i) => {
    if (childSpouseXs[i].length > 0) line(ctx, X(childXs[i]), childY, X(childSpouseXs[i][childSpouseXs[i].length - 1]), childY, COLORS.spouse);
  });

  // الأبناء: الخط ينزل من منتصف الأب والأم (أو من الشخص لو وحده هو والدهم)
  if (hasChildren) {
    const busY = childY - NODE_R - 45;
    const coupleXs = [egoX, ...spouseXs];
    const coupleIds = [data.ego.userId, ...spouses.map((s) => s.userId)];
    const childSrc = children.map((c) => {
      const mine = coupleIds.map((id, k) => ((c.parentIds ?? []).includes(id) ? coupleXs[k] : null)).filter((x): x is number => x !== null);
      return mine.length >= 2 ? { x: X(mean(mine)), y: egoY } : { x: X(mine[0] ?? egoX), y: below(egoY) };
    });
    const allChildXs = [...childXs, ...(extraX !== null ? [extraX] : [])].map(X);
    const drops = new Map<number, number>();
    for (const sc of childSrc) drops.set(sc.x, sc.y);
    if (extraX !== null || childSrc.length === 0) drops.set(X(egoX), below(egoY));
    const srcXs = [...drops.keys()];
    for (const [sx, sy] of drops) line(ctx, sx, sy, sx, busY, COLORS.child);
    line(ctx, Math.min(...srcXs, ...allChildXs), busY, Math.max(...srcXs, ...allChildXs), busY, COLORS.child);
    for (const x of allChildXs) line(ctx, x, busY, x, childY - NODE_R - 4, COLORS.child);
  }

  // الأحفاد ← من منتصف الابن وزوجه
  if (gcSlots > 0) {
    const busY = gcY - NODE_R - 45;
    const posOf = new Map<string, number>();
    children.forEach((c, i) => posOf.set(c.userId, childXs[i]));
    units.forEach((u, i) => u.spouses.forEach((m, k) => posOf.set(m.userId, childSpouseXs[i][k])));
    grandchildren.forEach((g, i) => {
      const mine = g.viaIds.map((id) => posOf.get(id)).filter((x): x is number => x !== undefined);
      const src = mine.length >= 2 ? { x: X(mean(mine)), y: childY } : { x: X(mine[0] ?? egoX), y: below(childY) };
      const gx = X(gcXs[i]);
      line(ctx, src.x, src.y, src.x, busY, COLORS.grandchild);
      line(ctx, Math.min(src.x, gx), busY, Math.max(src.x, gx), busY, COLORS.grandchild);
      line(ctx, gx, busY, gx, gcY - NODE_R - 4, COLORS.grandchild);
    });
  }

  // ───── الدوائر والنصوص ─────
  for (const n of nodes) drawNode(ctx, n);

  // قلوب الزواج فوق الخط بين الدوائر
  spouseXs.forEach((sx, i) => {
    const prev = i === 0 ? egoX : spouseXs[i - 1];
    heart(ctx, X((prev + sx) / 2), egoY - 18, 11);
  });
  units.forEach((_, i) => {
    childSpouseXs[i].forEach((sx, k) => {
      const prev = k === 0 ? childXs[i] : childSpouseXs[i][k - 1];
      heart(ctx, X((prev + sx) / 2), childY - 18, 11);
    });
  });

  const more = (cx: number, cy: number, n: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(cx, cy, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.fillStyle = "#f0fdf4";
    ctx.font = `700 28px "${FONT_BOLD}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${n}`, cx, cy);
  };
  if (extraChildren > 0 && extraX !== null) more(X(extraX), childY, extraChildren, "#166534");
  if (extraGrandchildren > 0 && gcExtraX !== null) more(X(gcExtraX), gcY, extraGrandchildren, "#065f46");

  return canvas.encode("png");
}

export function toFamilyMember(
  userId: string,
  username: string,
  avatarURL: string,
  gender: Gender,
  relation: string,
): FamilyMember {
  return { userId, username, avatarURL, gender, relation };
}
