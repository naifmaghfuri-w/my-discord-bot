import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export type VendItem = "espresso" | "water" | "cheese";

export const VEND_DEFAULTS: Record<VendItem, number> = { water: 2, espresso: 28, cheese: 50 };

export const VEND: Record<VendItem, { name: string; pct: number; bonus: number; effect: string; color: string; soft: string }> = {
  espresso: { name: "الإسبريسو", pct: 0.2, bonus: 0, effect: "يقلل وقت الدوام بنسبة 20٪", color: "#d4894a", soft: "#e8b27f" },
  cheese: { name: "تشيز كيك", pct: 0, bonus: 0.02, effect: "يزيد الميزانية 2٪ مع الدوام", color: "#e9879f", soft: "#f6b3c4" },
  water: { name: "قارورة ماء", pct: 0.05, bonus: 0, effect: "يقلل وقت الدوام بنسبة 5٪", color: "#6cb6f0", soft: "#9fd0f5" },
};

const W = 1098;
const H = 700;

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function sparkle(ctx: SKRSContext2D, x: number, y: number, s: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}

function glow(ctx: SKRSContext2D, cx: number, cy: number, tint: string): void {
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(cx, cy, 138, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.arc(cx, cy, 98, 0, Math.PI * 2);
  ctx.fill();
}

function drawCup(ctx: SKRSContext2D, cx: number, cy: number): void {
  glow(ctx, cx, cy, "rgba(212,137,74,0.16)");
  // بخار
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  for (const dx of [-34, 0, 34]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy - 50);
    ctx.bezierCurveTo(cx + dx - 14, cy - 75, cx + dx + 14, cy - 95, cx + dx, cy - 118);
    ctx.stroke();
  }
  // الصحن
  ctx.fillStyle = "#e4e0d8";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 96, 128, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  // المقبض
  ctx.strokeStyle = "#f3efe8";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(cx + 62, cy + 42, 28, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  // الكوب
  ctx.fillStyle = "#f4f1ea";
  ctx.beginPath();
  ctx.moveTo(cx - 80, cy - 8);
  ctx.lineTo(cx + 80, cy - 8);
  ctx.quadraticCurveTo(cx + 74, cy + 100, cx, cy + 100);
  ctx.quadraticCurveTo(cx - 74, cy + 100, cx - 80, cy - 8);
  ctx.fill();
  // القهوة
  ctx.fillStyle = "#4a2e1c";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 80, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b07d4f";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 7, 66, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  sparkle(ctx, cx + 100, cy - 70, 18, "#ffe2c2");
  sparkle(ctx, cx - 120, cy - 40, 10, "#ffe2c2");
}

function drawBottle(ctx: SKRSContext2D, cx: number, cy: number): void {
  glow(ctx, cx, cy, "rgba(108,182,240,0.14)");
  // ظل
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 112, 70, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  // الغطاء والعنق
  ctx.fillStyle = "#3f6fd0";
  rr(ctx, cx - 24, cy - 128, 48, 28, 8);
  ctx.fill();
  ctx.fillStyle = "#d6ecff";
  rr(ctx, cx - 17, cy - 102, 34, 36, 4);
  ctx.fill();
  // الجسم
  ctx.fillStyle = "#cfe8fb";
  ctx.strokeStyle = "#8fbbe6";
  ctx.lineWidth = 4;
  rr(ctx, cx - 50, cy - 70, 100, 184, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#6fb4e6";
  ctx.fillRect(cx - 48, cy - 34, 96, 40);
  ctx.fillRect(cx - 48, cy + 48, 96, 62);
  // الملصق
  ctx.fillStyle = "#f2f8ff";
  ctx.fillRect(cx - 48, cy + 6, 96, 42);
  ctx.fillStyle = "#4a90d0";
  ctx.beginPath();
  ctx.moveTo(cx, cy + 14);
  ctx.quadraticCurveTo(cx + 12, cy + 30, cx, cy + 42);
  ctx.quadraticCurveTo(cx - 12, cy + 30, cx, cy + 14);
  ctx.fill();
  // لمعة
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  rr(ctx, cx - 40, cy - 56, 7, 150, 4);
  ctx.fill();
  sparkle(ctx, cx + 92, cy - 76, 18, "#ffffff");
  sparkle(ctx, cx - 100, cy - 36, 10, "#ffffff");
}

function drawCheese(ctx: SKRSContext2D, cx: number, cy: number): void {
  glow(ctx, cx, cy, "rgba(233,135,159,0.16)");
  // الصحن
  ctx.fillStyle = "#e4e0d8";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 96, 118, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  const poly = (pts: number[][], fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx + pts[0][0], cy + pts[0][1]);
    for (const [dx, dy] of pts.slice(1)) ctx.lineTo(cx + dx, cy + dy);
    ctx.closePath();
    ctx.fill();
  };
  // الجنب الأيمن، الواجهة، الوجه العلوي
  poly([[62, 14], [92, -26], [92, 52], [62, 92]], "#e8cf94");
  poly([[-70, 14], [62, 14], [62, 92], [-70, 92]], "#f7e6b8");
  poly([[-70, 14], [62, 14], [92, -26], [-40, -26]], "#fff3d2");
  // القاعدة (بسكويت)
  ctx.fillStyle = "#9a6a3a";
  ctx.fillRect(cx - 70, cy + 70, 132, 22);
  poly([[62, 70], [92, 30], [92, 52], [62, 92]], "#7d5430");
  // صوص الفراولة على الوجه
  ctx.fillStyle = "#e23d4b";
  ctx.beginPath();
  ctx.moveTo(cx - 40, cy - 26);
  ctx.lineTo(cx + 92, cy - 26);
  ctx.lineTo(cx + 84, cy - 14);
  ctx.quadraticCurveTo(cx + 60, cy + 4, cx + 40, cy - 10);
  ctx.quadraticCurveTo(cx + 10, cy + 12, cx - 20, cy - 8);
  ctx.quadraticCurveTo(cx - 36, cy - 12, cx - 40, cy - 26);
  ctx.fill();
  // فراولة فوق
  ctx.fillStyle = "#ef4a5b";
  ctx.beginPath();
  ctx.moveTo(cx + 20, cy - 62);
  ctx.quadraticCurveTo(cx + 52, cy - 62, cx + 40, cy - 28);
  ctx.quadraticCurveTo(cx + 30, cy - 18, cx + 20, cy - 16);
  ctx.quadraticCurveTo(cx + 6, cy - 22, cx + 0, cy - 40);
  ctx.quadraticCurveTo(cx - 2, cy - 62, cx + 20, cy - 62);
  ctx.fill();
  ctx.fillStyle = "#3f9d4a";
  ctx.beginPath();
  ctx.moveTo(cx + 20, cy - 64);
  ctx.lineTo(cx + 8, cy - 74);
  ctx.lineTo(cx + 20, cy - 70);
  ctx.lineTo(cx + 32, cy - 76);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd9a8";
  for (const [dx, dy] of [[14, -46], [26, -42], [20, -32], [32, -52]]) ctx.fillRect(cx + dx, cy + dy, 3, 4);
  sparkle(ctx, cx + 96, cy - 70, 18, "#ffd6e0");
  sparkle(ctx, cx - 108, cy - 30, 10, "#ffd6e0");
}

function card(ctx: SKRSContext2D, x: number, item: VendItem, price: number, family: string): void {
  const d = VEND[item];
  const cw = 330, ch = 640, y = 30;
  ctx.fillStyle = "#171033";
  rr(ctx, x, y, cw, ch, 36);
  ctx.fill();
  ctx.strokeStyle = d.color;
  ctx.lineWidth = 6;
  rr(ctx, x, y, cw, ch, 36);
  ctx.stroke();
  ctx.strokeStyle = `${d.color}66`;
  ctx.lineWidth = 2;
  rr(ctx, x + 14, y + 14, cw - 28, ch - 28, 26);
  ctx.stroke();

  const cx = x + cw / 2;
  if (item === "espresso") drawCup(ctx, cx, y + 235);
  else if (item === "cheese") drawCheese(ctx, cx, y + 235);
  else drawBottle(ctx, cx, y + 235);

  // لوحة الاسم والتأثير
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  rr(ctx, x + 24, y + 440, cw - 48, 168, 22);
  ctx.fill();
  ctx.strokeStyle = `${d.color}55`;
  ctx.lineWidth = 2;
  rr(ctx, x + 24, y + 440, cw - 48, 168, 22);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `700 34px "${family}"`;
  ctx.fillText(d.name, cx, y + 482);
  ctx.fillStyle = d.soft;
  ctx.font = `700 17px "${family}"`;
  ctx.fillText(d.effect, cx, y + 527);

  // السعر
  ctx.fillStyle = d.color;
  rr(ctx, cx - 70, y + 553, 140, 40, 20);
  ctx.fill();
  ctx.fillStyle = "#1a1030";
  ctx.font = `700 22px "${family}"`;
  ctx.fillText(`${price.toLocaleString("en-US")} Jenny`, cx, y + 574);
}

export async function renderVending(prices: Record<VendItem, number>): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d0820");
    bg.addColorStop(1, "#150f30");
    ctx.fillStyle = bg;
    rr(ctx, 0, 0, W, H, 30);
    ctx.fill();
    card(ctx, 30, "espresso", prices.espresso, family);
    card(ctx, 384, "cheese", prices.cheese, family);
    card(ctx, 738, "water", prices.water, family);
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
