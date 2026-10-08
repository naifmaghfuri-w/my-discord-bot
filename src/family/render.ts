import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { FONT_BOLD, ensureFontsRegistered } from "../quests/render/fonts";
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
  ego: "#facc15",
} as const;

export interface FamilyMember {
  userId: string;
  username: string;
  avatarURL: string;
  gender: Gender;
  /** من هو بالنسبة لمن يشاهد الشجرة (يُكتب تحت الصورة): الأب، الأخت، غريب... */
  relation: string;
}

export interface FamilyTreeInput {
  title: string;
  ego: FamilyMember;
  spouses: FamilyMember[];
  parents: FamilyMember[];
  siblings: FamilyMember[];
  children: FamilyMember[];
}

export type Role = "parent" | "sibling" | "spouse" | "child";

const ROLE_LABELS: Record<Role, { male: string; female: string; unknown: string }> = {
  parent: { male: "الأب", female: "الأم", unknown: "الوالد" },
  sibling: { male: "الأخ", female: "الأخت", unknown: "الأخ/الأخت" },
  spouse: { male: "الزوج", female: "الزوجة", unknown: "الزوج/الزوجة" },
  child: { male: "الابن", female: "الابنة", unknown: "الابن/الابنة" },
};

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
  return clean(name) || clean(fallback) || "عضو";
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
 *  1) الوالدان   2) الإخوة (يسار) • الشخص • الأزواج (يمين)   3) الأبناء
 * وتحت كل دائرة: الاسم ثم علاقته بمن يشاهد الشجرة.
 */
export async function renderFamilyTree(data: FamilyTreeInput): Promise<Buffer | null> {
  if (!ensureFontsRegistered()) return null;

  const MAX_SIBLINGS = 6;
  const MAX_SPOUSES = 4;
  const MAX_CHILDREN = 6;

  const siblings = data.siblings.slice(0, MAX_SIBLINGS);
  const spouses = data.spouses.slice(0, MAX_SPOUSES);
  const children = data.children.slice(0, MAX_CHILDREN);
  const extraChildren = data.children.length - children.length;
  const childSlots = children.length + (extraChildren > 0 ? 1 : 0);
  const parents = data.parents.slice(0, 2);
  const hasParents = parents.length > 0;

  // ───── المواضع النسبية (الشخص الرئيسي عند x = 0) ─────
  const egoX = 0;
  const sibXs = siblings.map((_, i) => -SLOT * (siblings.length - i));
  const spouseXs = spouses.map((_, i) => SLOT * (i + 1));
  const rowXs = [...sibXs, egoX];
  const groupMid = (Math.min(...rowXs) + Math.max(...rowXs)) / 2;
  const parentXs = parents.length === 2 ? [groupMid - 125, groupMid + 125] : [groupMid];
  const childXs = children.map((_, i) => egoX + (i - (childSlots - 1) / 2) * SLOT);
  const extraX = extraChildren > 0 ? egoX + (children.length - (childSlots - 1) / 2) * SLOT : null;

  const allXs = [...rowXs, ...spouseXs, ...(hasParents ? parentXs : []), ...childXs, ...(extraX !== null ? [extraX] : [])];
  const minX = Math.min(...allXs) - MARGIN_X;
  const maxX = Math.max(...allXs) + MARGIN_X;
  const W = Math.max(760, Math.round(maxX - minX));
  const shift = -minX + (W - (maxX - minX)) / 2;
  const X = (x: number) => Math.round(x + shift);

  // ───── المواضع العمودية ─────
  const parentY = 80 + 30 + NODE_R;
  const egoY = hasParents ? parentY + ROW_GAP : 80 + 30 + NODE_R;
  const childY = egoY + ROW_GAP;
  const H = (childSlots > 0 ? childY : egoY) + NODE_R + PILL_H + 50;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

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
  const [egoImg, parentImgs, sibImgs, spouseImgs, childImgs] = await Promise.all([
    load(data.ego),
    Promise.all(parents.map(load)),
    Promise.all(siblings.map(load)),
    Promise.all(spouses.map(load)),
    Promise.all(children.map(load)),
  ]);

  const nodes: Placed[] = [];
  parents.forEach((m, i) => nodes.push({ member: m, image: parentImgs[i], x: X(parentXs[i]), y: parentY, ring: COLORS.parent }));
  siblings.forEach((m, i) => nodes.push({ member: m, image: sibImgs[i], x: X(sibXs[i]), y: egoY, ring: COLORS.sibling }));
  spouses.forEach((m, i) => nodes.push({ member: m, image: spouseImgs[i], x: X(spouseXs[i]), y: egoY, ring: COLORS.spouse }));
  children.forEach((m, i) => nodes.push({ member: m, image: childImgs[i], x: X(childXs[i]), y: childY, ring: COLORS.child }));
  nodes.push({ member: data.ego, image: egoImg, x: X(egoX), y: egoY, ring: COLORS.ego });

  // ───── الخطوط (ترسم أولاً حتى تكون خلف الدوائر) ─────
  // الوالدان ← ناقل أفقي ← الإخوة والشخص
  if (hasParents) {
    const busY = egoY - NODE_R - 45;
    const midX = X(parentXs.length === 2 ? (parentXs[0] + parentXs[1]) / 2 : parentXs[0]);
    if (parents.length === 2) line(ctx, X(parentXs[0]), parentY, X(parentXs[1]), parentY, COLORS.parent);
    const dropFrom = parents.length === 2 ? parentY : parentY + NODE_R + PILL_H + 16;
    line(ctx, midX, dropFrom, midX, busY, COLORS.parent);
    const xs = rowXs.map(X);
    line(ctx, Math.min(midX, ...xs), busY, Math.max(midX, ...xs), busY, COLORS.parent);
    for (const x of xs) line(ctx, x, busY, x, egoY - NODE_R - 4, COLORS.parent);
  }

  // الأزواج: خط أفقي من الشخص (يمر خلف الأزواج الأقرب) مع قلب بين كل اثنين
  if (spouses.length > 0) {
    line(ctx, X(egoX), egoY, X(spouseXs[spouses.length - 1]), egoY, COLORS.spouse);
  }

  // الأبناء ← ناقل أفقي
  if (childSlots > 0) {
    const busY = childY - NODE_R - 45;
    const startY = egoY + NODE_R + PILL_H + 16;
    line(ctx, X(egoX), startY, X(egoX), busY, COLORS.child);
    const xs = [...childXs, ...(extraX !== null ? [extraX] : [])].map(X);
    line(ctx, Math.min(X(egoX), ...xs), busY, Math.max(X(egoX), ...xs), busY, COLORS.child);
    for (const x of xs) line(ctx, x, busY, x, childY - NODE_R - 4, COLORS.child);
  }

  // ───── الدوائر والنصوص ─────
  for (const n of nodes) drawNode(ctx, n);

  // قلوب الزواج فوق الخط بين الدوائر
  spouseXs.forEach((sx, i) => {
    const prev = i === 0 ? egoX : spouseXs[i - 1];
    heart(ctx, X((prev + sx) / 2), egoY - 18, 11);
  });

  if (extraChildren > 0 && extraX !== null) {
    const cx = X(extraX);
    ctx.beginPath();
    ctx.arc(cx, childY, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = "#166534";
    ctx.fill();
    ctx.fillStyle = "#f0fdf4";
    ctx.font = `700 28px "${FONT_BOLD}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${extraChildren}`, cx, childY);
  }

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
