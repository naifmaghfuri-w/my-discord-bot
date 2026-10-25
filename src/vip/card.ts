import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export const VIP_PLANS = [
  { id: "d3", days: 3, price: 300, label: "3 أيام" },
  { id: "d10", days: 10, price: 800, label: "10 أيام" },
  { id: "d15", days: 15, price: 1500, label: "15 يوم" },
] as const;

const fmt = (n: number): string => n.toLocaleString("en-US");

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** بانر لوحة الرتب الخاصة (يُستخدم لو المالك ما أرفق صورة) */
export async function renderVipBanner(): Promise<Buffer> {
  ensureFontsRegistered();
  const W = 1000;
  const H = 420;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#120b2b");
  g.addColorStop(0.55, "#2a1457");
  g.addColorStop(1, "#0b1a3a");
  ctx.fillStyle = g;
  rr(ctx, 0, 0, W, H, 30);
  ctx.fill();

  // توهج
  for (const [x, y, r, col] of [
    [120, 60, 220, "rgba(167,139,250,0.20)"],
    [880, 360, 260, "rgba(56,189,248,0.16)"],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 64px ${FONT_BOLD}`;
  ctx.fillText("الرتب الخاصة", W / 2, 95);

  const cw = 270;
  const gap = 30;
  const x0 = (W - (cw * 3 + gap * 2)) / 2;
  VIP_PLANS.forEach((p, i) => {
    const x = x0 + i * (cw + gap);
    const y = 180;
    rr(ctx, x, y, cw, 200, 22);
    ctx.fillStyle = i === 2 ? "rgba(250,204,21,0.16)" : "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = i === 2 ? "#facc15" : "rgba(255,255,255,0.22)";
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `800 44px ${FONT_BOLD}`;
    ctx.fillText(p.label, x + cw / 2, y + 70);
    ctx.fillStyle = i === 2 ? "#facc15" : "#a5b4fc";
    ctx.font = `800 52px ${FONT_BOLD}`;
    ctx.fillText(fmt(p.price), x + cw / 2, y + 145);
  });

  return c.toBuffer("image/png");
}
