import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export type VendItem = "espresso" | "water";

export const VEND_DEFAULTS: Record<VendItem, number> = { water: 2, espresso: 28 };

export const VEND: Record<VendItem, { name: string; pct: number; effect: string; color: string; soft: string }> = {
  espresso: { name: "الإسبريسو", pct: 0.2, effect: "يقلل وقت الدوام بنسبة 20٪", color: "#d4894a", soft: "#e8b27f" },
  water: { name: "قارورة ماء", pct: 0.05, effect: "يقلل وقت الدوام بنسبة 5٪", color: "#6cb6f0", soft: "#9fd0f5" },
};

const W = 980;
const H = 760;

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
  ctx.arc(cx, cy, 158, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.arc(cx, cy, 112, 0, Math.PI * 2);
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

function card(ctx: SKRSContext2D, x: number, item: VendItem, price: number, family: string): void {
  const d = VEND[item];
  const cw = 430, ch = 700, y = 30;
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
  if (item === "espresso") drawCup(ctx, cx, y + 245);
  else drawBottle(ctx, cx, y + 245);

  // لوحة الاسم والتأثير
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  rr(ctx, x + 32, y + 470, cw - 64, 176, 22);
  ctx.fill();
  ctx.strokeStyle = `${d.color}55`;
  ctx.lineWidth = 2;
  rr(ctx, x + 32, y + 470, cw - 64, 176, 22);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  ctx.font = `700 38px "${family}"`;
  ctx.fillText(d.name, cx, y + 515);
  ctx.fillStyle = d.soft;
  ctx.font = `700 20px "${family}"`;
  ctx.fillText(d.effect, cx, y + 562);

  // السعر
  ctx.fillStyle = d.color;
  rr(ctx, cx - 70, y + 590, 140, 40, 20);
  ctx.fill();
  ctx.fillStyle = "#1a1030";
  ctx.font = `700 22px "${family}"`;
  ctx.fillText(`${price.toLocaleString("en-US")} Jenny`, cx, y + 611);
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
    card(ctx, 520, "water", prices.water, family);
    card(ctx, 30, "espresso", prices.espresso, family);
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
