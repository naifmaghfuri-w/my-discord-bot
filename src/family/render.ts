import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import type { IUserProfile } from "../database/models/UserProfile";
import { FONT_BOLD, ensureFontsRegistered } from "../quests/render/fonts";
import type { Gender } from "./gender";

const WIDTH = 1250;
const HEIGHT = 720;
const NODE_R = 55;

export interface FamilyMember {
  userId: string;
  username: string;
  avatarURL: string;
  gender: Gender;
}

export interface FamilyTreeInput {
  ego: FamilyMember;
  spouses: FamilyMember[];
  parents: FamilyMember[];
  siblings: FamilyMember[];
  children: FamilyMember[];
}

type Role = "parent" | "sibling" | "spouse" | "child";

const RELATION_LABELS: Record<Role, { male: string; female: string; unknown: string }> = {
  parent: { male: "الأب", female: "الأم", unknown: "الوالد" },
  sibling: { male: "الأخ", female: "الأخت", unknown: "الأخ/الأخت" },
  spouse: { male: "الزوج", female: "الزوجة", unknown: "الزوج/الزوجة" },
  child: { male: "الابن", female: "الابنة", unknown: "الابن/الابنة" },
};

function relationLabel(role: Role, gender: Gender): string {
  const forms = RELATION_LABELS[role];
  return gender === "male" ? forms.male : gender === "female" ? forms.female : forms.unknown;
}

async function fetchAvatar(url: string): Promise<Image | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return await loadImage(buf);
  } catch {
    return null;
  }
}

function drawLine(ctx: SKRSContext2D, x1: number, y1: number, x2: number, y2: number, color = "#94a3b8") {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawNode(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  member: FamilyMember,
  image: Image | null,
  ring: string,
  relation: string,
) {
  // تسمية العلاقة فوق الصورة
  ctx.fillStyle = ring;
  ctx.font = `700 18px "${FONT_BOLD}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(relation, x, y - NODE_R - 8);

  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, NODE_R + 4, 0, Math.PI * 2);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (image) {
    ctx.drawImage(image, x - NODE_R, y - NODE_R, NODE_R * 2, NODE_R * 2);
  } else {
    ctx.fillStyle = "#334155";
    ctx.fillRect(x - NODE_R, y - NODE_R, NODE_R * 2, NODE_R * 2);
  }
  ctx.restore();

  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 20px "${FONT_BOLD}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const label = member.username.length > 14 ? `${member.username.slice(0, 13)}…` : member.username;
  ctx.fillText(label, x, y + NODE_R + 10);
}

function background(ctx: SKRSContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  grad.addColorStop(0, "#1e1b2e");
  grad.addColorStop(1, "#0b0a14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, 500);
  glow.addColorStop(0, "rgba(168,85,247,0.10)");
  glow.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** يرسم صورة شجرة العائلة (الوالدان، الإخوة، الأزواج، الأبناء) مع تسمية كل علاقة فوق صورتها */
export async function renderFamilyTree(data: FamilyTreeInput): Promise<Buffer | null> {
  if (!ensureFontsRegistered()) return null;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");
  background(ctx);

  ctx.fillStyle = "#e9d5ff";
  ctx.font = `800 30px "${FONT_BOLD}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("🌳 شجرة العائلة", WIDTH / 2, 24);

  const egoY = 380;
  const egoX = WIDTH / 2 - 80;

  // الوالدان
  const parentY = 130;
  const parentXs = data.parents.length === 2 ? [egoX - 110, egoX + 110] : [egoX];
  const parentImages: (Image | null)[] = [];
  for (const p of data.parents) parentImages.push(await fetchAvatar(p.avatarURL));

  if (data.parents.length === 2) drawLine(ctx, parentXs[0], parentY, parentXs[1], parentY, "#c084fc");
  const parentMidX = data.parents.length ? (parentXs[0] + (parentXs[1] ?? parentXs[0])) / 2 : egoX;
  if (data.parents.length) drawLine(ctx, parentMidX, parentY + NODE_R, egoX, egoY - NODE_R, "#c084fc");

  data.parents.forEach((p, i) =>
    drawNode(ctx, parentXs[i], parentY, p, parentImages[i], "#c084fc", relationLabel("parent", p.gender)),
  );

  // الإخوة حول نفس مستوى الوالدين تقريباً (يسار/يمين الوسط)
  const sibY = 250;
  const maxSibs = Math.min(data.siblings.length, 4);
  for (let i = 0; i < maxSibs; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const offset = Math.ceil((i + 1) / 2);
    const sx = egoX + side * (170 * offset);
    const img = await fetchAvatar(data.siblings[i].avatarURL);
    if (data.parents.length) drawLine(ctx, parentMidX, parentY + NODE_R, sx, sibY - NODE_R, "#64748b");
    drawNode(ctx, sx, sibY, data.siblings[i], img, "#64748b", relationLabel("sibling", data.siblings[i].gender));
  }

  // الأزواج (حتى 4) على يمين الشخص الرئيسي
  const spouses = data.spouses.slice(0, 4);
  for (let i = 0; i < spouses.length; i++) {
    const spouseX = egoX + 150 + 120 * i;
    const img = await fetchAvatar(spouses[i].avatarURL);
    drawLine(ctx, egoX + NODE_R, egoY, spouseX - NODE_R, egoY, "#f472b6");
    ctx.fillStyle = "#f472b6";
    ctx.font = `20px "${FONT_BOLD}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("💍", (egoX + spouseX) / 2, egoY - 30);
    drawNode(ctx, spouseX, egoY, spouses[i], img, "#f472b6", relationLabel("spouse", spouses[i].gender));
  }

  // الشخص الرئيسي
  const egoImg = await fetchAvatar(data.ego.avatarURL);
  drawNode(ctx, egoX, egoY, data.ego, egoImg, "#facc15", "أنت");

  // الأبناء (نعرض حتى 6، والباقي يظهر كعدد إضافي حتى ما تطلع الصورة فوضى أو تتجاوز حدودها)
  const childY = 590;
  const MAX_CHILDREN_SHOWN = 6;
  const shownChildren = data.children.slice(0, MAX_CHILDREN_SHOWN);
  const extraChildren = data.children.length - shownChildren.length;
  const n = shownChildren.length + (extraChildren > 0 ? 1 : 0);

  for (let i = 0; i < shownChildren.length; i++) {
    const cx = egoX + (i - (n - 1) / 2) * 170;
    const img = await fetchAvatar(shownChildren[i].avatarURL);
    drawLine(ctx, egoX, egoY + NODE_R, cx, childY - NODE_R, "#4ade80");
    drawNode(ctx, cx, childY, shownChildren[i], img, "#4ade80", relationLabel("child", shownChildren[i].gender));
  }

  if (extraChildren > 0) {
    const cx = egoX + (shownChildren.length - (n - 1) / 2) * 170;
    drawLine(ctx, egoX, egoY + NODE_R, cx, childY - NODE_R, "#4ade80");
    ctx.beginPath();
    ctx.arc(cx, childY, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = "#166534";
    ctx.fill();
    ctx.fillStyle = "#f0fdf4";
    ctx.font = `700 26px "${FONT_BOLD}"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`+${extraChildren}`, cx, childY);
  }

  return canvas.encode("png");
}

export function toFamilyMember(
  profile: Pick<IUserProfile, "userId">,
  username: string,
  avatarURL: string,
  gender: Gender,
): FamilyMember {
  return { userId: profile.userId, username, avatarURL, gender };
}
