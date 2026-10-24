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

function heart(ctx: SKRSContext2D, cx: number, cy: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.6, cy - s * 0.2, cx - s * 0.7, cy - s * 1.3, cx, cy - s * 0.4);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s * 1.3, cx + s * 1.6, cy - s * 0.2, cx, cy + s * 0.9);
  ctx.fill();
}

/** قائمة المحلات */
export async function renderShops(shops: { name: string; sub: string }[]): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 300 + shops.length * 0;
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
      const y = 146 + i * 100;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      rr(ctx, PAD, y, W - PAD * 2, 120, 24);
      ctx.fill();
      drawRose(ctx, W - PAD - 70, y + 40, 0.6);
      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      ctx.font = `700 34px "${family}"`;
      ctx.fillText(s.name, W - PAD - 140, y + 46);
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 20px "${family}"`;
      ctx.fillText(s.sub, W - PAD - 140, y + 86);
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
    ctx.fillText("اشتر ورد وأهده لزوجك أو زوجتك من !مقتنياتي", W - 380, 150);
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

/** مقتنياتي */
export async function renderInventory(rows: { name: string; count: number }[]): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const empty = rows.length === 0;
    const H = empty ? 330 : 214 + rows.length * 84 + 20;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(168,85,247,0.12)");
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 46px "${family}"`;
    ctx.fillText("مقتنياتي", W - PAD, 62);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 21px "${family}"`;
    ctx.fillText("كل اللي تملكه من المحلات", W - PAD, 108);
    if (empty) {
      ctx.textAlign = "center";
      ctx.font = `700 34px "${family}"`;
      ctx.fillText("ما عندك مقتنيات. اكتب !محلات", W / 2, 230);
      return await canvas.encode("png");
    }
    rows.forEach((r, i) => {
      const y = 146 + i * 84;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      rr(ctx, PAD, y, W - PAD * 2, 72, 20);
      ctx.fill();
      drawRose(ctx, W - PAD - 54, y + 22, 0.38);
      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      ctx.font = `700 30px "${family}"`;
      ctx.fillText(r.name, W - PAD - 110, y + 36);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fbbf24";
      ctx.font = `700 34px "${family}"`;
      ctx.fillText(`× ${fmt(r.count)}`, PAD + 28, y + 36);
    });
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
