import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

const W = 1000;
const PAD = 36;
const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

async function loadAvatar(url?: string): Promise<Image | null> {
  if (!url) return null;
  return Promise.race([loadImage(url).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

function bg(ctx: SKRSContext2D, h: number, tint: string): void {
  const g = ctx.createLinearGradient(0, 0, W, h);
  g.addColorStop(0, "#0b1220");
  g.addColorStop(1, "#1b2a4a");
  ctx.fillStyle = g;
  rr(ctx, 0, 0, W, h, 32);
  ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(130, 40, 230, 0, Math.PI * 2);
  ctx.fill();
}

function fit(ctx: SKRSContext2D, text: string, family: string, size: number, maxW: number): void {
  let s = size;
  ctx.font = `700 ${s}px "${family}"`;
  while (s > 14 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}

/** وردة مرسومة */
function drawRose(ctx: SKRSContext2D, cx: number, cy: number, k = 1): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.strokeStyle = "#3f9d4a";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.quadraticCurveTo(10, 70, 0, 120);
  ctx.stroke();
  ctx.fillStyle = "#3f9d4a";
  ctx.beginPath();
  ctx.ellipse(-22, 78, 24, 11, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(24, 62, 22, 10, 0.6, 0, Math.PI * 2);
  ctx.fill();
  const petals: [number, number, number, string][] = [[-24, 0, 34, "#c81d3a"], [24, 0, 34, "#c81d3a"], [0, -22, 36, "#d92b4b"], [0, 10, 34, "#d92b4b"]];
  for (const [x, y, r, c] of petals) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ef4a63";
  ctx.beginPath();
  ctx.arc(0, -4, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#a3122e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -4, 14, 0.4, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(2, -4, 6, 0, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
}

/** خاتم الفيروز */
function drawRing(ctx: SKRSContext2D, cx: number, cy: number, k = 1): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.strokeStyle = "#8b8fa3";
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.ellipse(0, 40, 62, 66, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#d4d7e3";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.ellipse(0, 40, 62, 66, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#c3c7d6";
  ctx.strokeStyle = "#8b8fa3";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, -34, 50, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#4fb8ac";
  ctx.beginPath();
  ctx.ellipse(0, -34, 38, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2e8a80";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -36);
  ctx.quadraticCurveTo(-4, -50, 6, -36);
  ctx.quadraticCurveTo(14, -28, 22, -38);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(-22, -48, 12, 4, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function heart(ctx: SKRSContext2D, cx: number, cy: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.7, cy - s * 1.3, cx, cy - s * 0.4);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9);
  ctx.fill();
}

/** قائمة المحلات */
export async function renderShops(shops: { name: string; sub: string; icon: "flower" | "ring" }[]): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 146 + shops.length * 140 + 20;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(245,158,11,0.12)");
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 46px "${family}"`;
    ctx.fillText("المحلات", W - PAD, 62);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 21px "${family}"`;
    ctx.fillText("اختر محل من الأزرار اللي تحت", W - PAD, 108);
    shops.forEach((s, i) => {
      const y = 146 + i * 140;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      rr(ctx, PAD, y, W - PAD * 2, 120, 24);
      ctx.fill();
      if (s.icon === "ring") drawRing(ctx, W - PAD - 70, y + 52, 0.5);
      else drawRose(ctx, W - PAD - 70, y + 40, 0.6);
      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      ctx.font = `700 34px "${family}"`;
      ctx.fillText(s.name, W - PAD - 140, y + 60);
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/** محل الورد */
export async function renderFlowerShop(price: number, owned: number): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 420;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(239,68,68,0.12)");
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.arc(W - 190, 190, 130, 0, Math.PI * 2);
    ctx.fill();
    drawRose(ctx, W - 190, 150, 1.4);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 50px "${family}"`;
    ctx.fillText("محل ورد", W - 380, 100);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText("اشتر ورد وأهده", W - 380, 150);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, PAD, 250, 560, 130, 24);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText("سعر الوردة", 560 + PAD - 28, 292);
    ctx.fillText("عندك", 560 + PAD - 28, 340);
    ctx.textAlign = "left";
    ctx.fillStyle = "#fbbf24";
    ctx.font = `700 34px "${family}"`;
    ctx.fillText(`${fmt(price)} Jenny`, PAD + 28, 292);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(fmt(owned), PAD + 28, 340);
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/** محل المجوهرات */
export async function renderJewelryShop(price: number, owned: number): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 420;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(79,184,172,0.14)");
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.arc(W - 190, 190, 130, 0, Math.PI * 2);
    ctx.fill();
    drawRing(ctx, W - 190, 180, 1);
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 50px "${family}"`;
    ctx.fillText("محل مجوهرات", W - 380, 100);
    ctx.fillStyle = "#5eead4";
    ctx.font = `700 26px "${family}"`;
    ctx.fillText("خاتم الفيروز", W - 380, 150);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, PAD, 250, 560, 130, 24);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText("السعر", 560 + PAD - 28, 292);
    ctx.fillText("عندك", 560 + PAD - 28, 340);
    ctx.textAlign = "left";
    ctx.fillStyle = "#fbbf24";
    ctx.font = `700 34px "${family}"`;
    ctx.fillText(`${fmt(price)} Jenny`, PAD + 28, 292);
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(fmt(owned), PAD + 28, 340);
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/** مقتنياتي: خزانة بشبكة خانات (5×3) */
export const INV_COLS = 5;
export const INV_ROWS = 3;
export const INV_PER_PAGE = INV_COLS * INV_ROWS;

export async function renderInventory(
  owner: string,
  rows: { name: string; count: number; icon: "flower" | "ring" }[],
  page: number,
  pages: number,
): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const CW = 920, CH = 640;
    const canvas = createCanvas(CW, CH);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    // خلفية الخزنة
    ctx.save();
    rr(ctx, 0, 0, CW, CH, 30);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, CW, CH);
    g.addColorStop(0, "#1a1424");
    g.addColorStop(0.5, "#221a2c");
    g.addColorStop(1, "#14161f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);
    // أعمدة وأقواس خفيفة
    ctx.strokeStyle = "rgba(212,170,90,0.08)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(120 + i * 230, 190, 110, Math.PI, 0);
      ctx.stroke();
    }
    const glowC = ctx.createRadialGradient(CW / 2, CH * 0.55, 40, CW / 2, CH * 0.55, 420);
    glowC.addColorStop(0, "rgba(168,85,247,0.16)");
    glowC.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glowC;
    ctx.fillRect(0, 0, CW, CH);
    // تعتيم الأطراف
    const vig = ctx.createRadialGradient(CW / 2, CH / 2, 200, CW / 2, CH / 2, 560);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, CW, CH);

    // العنوان
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, CW, 108);
    ctx.strokeStyle = "rgba(251,191,36,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 108);
    ctx.lineTo(CW, 108);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(251,191,36,0.8)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#fcd34d";
    ctx.font = `700 46px "${family}"`;
    ctx.fillText(owner, CW / 2, 58);
    ctx.shadowBlur = 0;
    ctx.textAlign = "right";
    ctx.fillStyle = "#9ca3af";
    ctx.font = `700 16px "${family}"`;
    ctx.fillText(`[${page + 1}/${pages}]`, CW - 24, 30);

    // الخانات
    const S = 136, GAP = 34;
    const x0 = (CW - (INV_COLS * S + (INV_COLS - 1) * GAP)) / 2;
    const y0 = 140;
    for (let i = 0; i < INV_PER_PAGE; i++) {
      const col = i % INV_COLS, rowI = Math.floor(i / INV_COLS);
      // الترتيب من اليمين لليسار
      const x = x0 + (INV_COLS - 1 - col) * (S + GAP);
      const y = y0 + rowI * (S + GAP);
      ctx.fillStyle = "rgba(6,10,20,0.72)";
      ctx.fillRect(x, y, S, S);
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, S, S);

      const it = rows[i];
      if (!it) continue;
      // إطار الغرض
      const fg = ctx.createLinearGradient(x, y, x + S, y + S);
      fg.addColorStop(0, "#2a1d4a");
      fg.addColorStop(1, "#150f2b");
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, S, S);
      ctx.strokeStyle = "#8b5cf6";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1, y + 1, S - 2, S - 2);
      ctx.fillStyle = "rgba(139,92,246,0.18)";
      ctx.beginPath();
      ctx.arc(x + S / 2, y + 56, 46, 0, Math.PI * 2);
      ctx.fill();
      if (it.icon === "ring") drawRing(ctx, x + S / 2, y + 66, 0.4);
      else drawRose(ctx, x + S / 2, y + 36, 0.55);
      // شريط الاسم
      ctx.fillStyle = "rgba(12,8,28,0.92)";
      ctx.beginPath();
      ctx.moveTo(x - 6, y + S - 30);
      ctx.lineTo(x + S + 6, y + S - 30);
      ctx.lineTo(x + S, y + S - 15);
      ctx.lineTo(x + S + 6, y + S);
      ctx.lineTo(x - 6, y + S);
      ctx.lineTo(x, y + S - 15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#f3f4f6";
      ctx.textAlign = "center";
      fit(ctx, it.name, family, 17, S - 14);
      ctx.fillText(it.name, x + S / 2, y + S - 15);
      // شارة العدد
      ctx.fillStyle = "#0b0b14";
      ctx.beginPath();
      ctx.arc(x + S - 6, y + 6, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 ${it.count > 99 ? 12 : 17}px "${family}"`;
      ctx.fillText(String(Math.min(it.count, 999)), x + S - 6, y + 7);
    }
    ctx.restore();
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

export interface MarriageCardData {
  aName: string;
  aAvatar?: string;
  bName: string;
  bAvatar?: string;
  since: string;
  days: number;
  gifts: number;
  /** نسبة الحب من 100 */
  love: number;
}

/** بطاقة الزواج */
export async function renderMarriageCard(d: MarriageCardData): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 500;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#2a0f24");
    g.addColorStop(1, "#14122e");
    ctx.fillStyle = g;
    rr(ctx, 0, 0, W, H, 32);
    ctx.fill();
    ctx.fillStyle = "rgba(244,114,182,0.12)";
    ctx.beginPath();
    ctx.arc(W / 2, 60, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(244,114,182,0.35)";
    ctx.lineWidth = 3;
    rr(ctx, 14, 14, W - 28, H - 28, 24);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#fbcfe8";
    ctx.font = `700 34px "${family}"`;
    ctx.fillText("بطاقة زواج", W / 2, 62);

    const imgs = await Promise.all([loadAvatar(d.aAvatar), loadAvatar(d.bAvatar)]);
    const slots = [{ x: W - 260, img: imgs[0], name: d.aName }, { x: 260, img: imgs[1], name: d.bName }];
    for (const s of slots) {
      const cy = 190, r = 72;
      ctx.fillStyle = "#f472b6";
      ctx.beginPath();
      ctx.arc(s.x, cy, r + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.x, cy, r, 0, Math.PI * 2);
      ctx.clip();
      if (s.img) ctx.drawImage(s.img, s.x - r, cy - r, r * 2, r * 2);
      else {
        ctx.fillStyle = "#2a2a31";
        ctx.fillRect(s.x - r, cy - r, r * 2, r * 2);
      }
      ctx.restore();
      ctx.fillStyle = "#f8fafc";
      ctx.textAlign = "center";
      fit(ctx, s.name, family, 30, 340);
      ctx.fillText(s.name, s.x, 300);
    }
    // قلب كبير فيه نسبة الحب
    heart(ctx, W / 2, 178, 62, "#f43f5e");
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `700 34px "${family}"`;
    ctx.fillText(`${d.love}%`, W / 2, 172);
    ctx.fillStyle = "#fbcfe8";
    ctx.font = `700 18px "${family}"`;
    ctx.fillText("نسبة الحب", W / 2, 262);

    const stats: [string, string][] = [["تاريخ الزواج", d.since], ["مدة الزواج", `${fmt(d.days)} يوم`], ["عدد الهدايا", fmt(d.gifts)]];
    stats.forEach(([label, value], i) => {
      const w = 280, gap = 24;
      const x = W / 2 - (w * 3 + gap * 2) / 2 + (2 - i) * (w + gap);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      rr(ctx, x, 345, w, 110, 20);
      ctx.fill();
      ctx.textAlign = "center";
      ctx.fillStyle = "#f9a8d4";
      ctx.font = `700 20px "${family}"`;
      ctx.fillText(label, x + w / 2, 378);
      ctx.fillStyle = "#f8fafc";
      fit(ctx, value, family, 32, w - 30);
      ctx.fillText(value, x + w / 2, 420);
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
