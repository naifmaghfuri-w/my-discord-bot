import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

let bannerCache: Buffer | null = null;

function pill(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** بنر اللوبي: «برا السالفة» (يُرسم مرة وحدة ويُخزّن) */
export async function salfaBanner(): Promise<Buffer | null> {
  if (bannerCache) return bannerCache;
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const W = 900;
    const H = 330;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#2a0712");
    bg.addColorStop(1, "#5c1024");
    ctx.fillStyle = bg;
    pill(ctx, 0, 0, W, H, 28);
    ctx.fill();

    // زخرفة جانبية
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 10;
    for (const side of [0, 1]) {
      ctx.beginPath();
      const x0 = side === 0 ? 70 : W - 70;
      const dir = side === 0 ? 1 : -1;
      ctx.moveTo(x0, 40);
      ctx.bezierCurveTo(x0 + 120 * dir, 80, x0 + 120 * dir, 220, x0, 290);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 40px "${family}"`;
    ctx.fillText("🕵️", W / 2, 70);
    ctx.font = `700 88px "${family}"`;
    ctx.fillText("برا السالفة", W / 2, 165);

    ctx.fillStyle = "#3a0a18";
    pill(ctx, 190, 235, 520, 56, 28);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#fbe5ea";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText("اضغط على زر دخول للانضمام إلى اللعبة", W / 2, 264);

    bannerCache = await canvas.encode("png");
    return bannerCache;
  } catch {
    return null;
  }
}

async function drawAvatar(ctx: SKRSContext2D, url: string | undefined, cx: number, cy: number, r: number): Promise<void> {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    if (!url) throw new Error("no avatar");
    const img = await loadImage(url);
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  } catch {
    ctx.fillStyle = "#64748b";
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#1f1f1f";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/** بطاقة VS: يمين = يسأل، يسار = يجاوب */
export async function vsCard(askerAvatar: string | undefined, answererAvatar: string | undefined): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const W = 880;
    const H = 262;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#2f2f2f";
    pill(ctx, 0, 0, W, H, 44);
    ctx.fill();

    await drawAvatar(ctx, answererAvatar, 170, 125, 105);
    await drawAvatar(ctx, askerAvatar, W - 170, 125, 105);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 110px "${family}"`;
    ctx.fillText("VS", W / 2, 125);

    ctx.font = `700 30px "${family}"`;
    ctx.fillText("يجاوب", 170 + 95, 218);
    ctx.fillText("يسأل", W - 170 - 95, 218);

    return await canvas.encode("png");
  } catch {
    return null;
  }
}
