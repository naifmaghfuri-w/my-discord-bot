import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

const W = 1000;
const H = 380;

function card(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, c1: string, c2: string): void {
  ctx.save();
  ctx.shadowColor = c1;
  ctx.shadowBlur = 28;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, c1 + "55");
  g.addColorStop(1, c2 + "22");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 34);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = c1 + "aa";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 34);
  ctx.stroke();
}

/** رمز الذكر ♂ أو الأنثى ♀ مرسوم بالخطوط */
function symbol(ctx: SKRSContext2D, kind: "he" | "she", cx: number, cy: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  const r = 42;
  if (kind === "he") {
    const bx = cx - 12, by = cy + 12;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.stroke();
    const a = -Math.PI / 4;
    const sx = bx + Math.cos(a) * r, sy = by + Math.sin(a) * r;
    const ex = cx + 52, ey = cy - 52;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.moveTo(ex - 30, ey);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex, ey + 30);
    ctx.stroke();
  } else {
    const by = cy - 14;
    ctx.beginPath();
    ctx.arc(cx, by, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, by + r);
    ctx.lineTo(cx, cy + 66);
    ctx.moveTo(cx - 24, cy + 44);
    ctx.lineTo(cx + 24, cy + 44);
    ctx.stroke();
  }
  ctx.restore();
}

export async function renderGenderBanner(): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0d1030");
    bg.addColorStop(0.5, "#1a1040");
    bg.addColorStop(1, "#2a0f3a");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 30);
    ctx.fill();

    // توهج خلفي
    for (const [x, y, c] of [[240, 220, "rgba(56,189,248,0.22)"], [760, 220, "rgba(244,114,182,0.22)"]] as const) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 260);
      g.addColorStop(0, c);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    // نجوم صغيرة
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.15 + ((i * 37) % 10) / 20})`;
      ctx.fillRect((i * 193) % W, (i * 71) % H, 2, 2);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 46px "${family}"`;
    ctx.fillText("اختر جنسك", W / 2, 58);
    ctx.fillStyle = "#a5b4fc";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText("CHOOSE YOUR ROLE", W / 2, 98);

    const cw = 380, ch = 220, cy = 126;
    // ذكر يمين، أنثى يسار (ترتيب عربي)
    const he = { x: W / 2 + 36, c1: "#38bdf8", c2: "#6366f1" };
    const she = { x: W / 2 - 36 - cw, c1: "#f472b6", c2: "#a855f7" };
    card(ctx, he.x, cy, cw, ch, he.c1, he.c2);
    card(ctx, she.x, cy, cw, ch, she.c1, she.c2);

    symbol(ctx, "he", he.x + cw / 2, cy + 92, he.c1);
    symbol(ctx, "she", she.x + cw / 2, cy + 92, she.c1);

    ctx.fillStyle = "#ffffff";
    ctx.font = `800 36px "${family}"`;
    ctx.fillText("ذكر", he.x + cw / 2, cy + ch - 34);
    ctx.fillText("أنثى", she.x + cw / 2, cy + ch - 34);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `700 18px "${family}"`;
    ctx.fillText("HE / HIM", he.x + cw / 2, cy + ch - 8);
    ctx.fillText("SHE / HER", she.x + cw / 2, cy + ch - 8);

    // رابط المنتصف
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(W / 2, cy + ch / 2, 6, 0, Math.PI * 2);
    ctx.fill();

    return await canvas.encode("png");
  } catch {
    return null;
  }
}
