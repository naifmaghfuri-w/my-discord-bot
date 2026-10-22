import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD, FONT_REGULAR } from "../quests/render/fonts";

export interface LevelCardData {
  name: string;
  avatar?: string;
  level: number;
  rank: number;
  points: number;
  messages: number;
  xp: number;
  need: number;
}

const W = 900;
const H = 260;
const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

async function loadAvatar(url?: string): Promise<Image | null> {
  if (!url) return null;
  return Promise.race([loadImage(url).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function renderLevelCard(d: LevelCardData): Promise<Buffer | null> {
  try {
    const ok = ensureFontsRegistered();
    const bold = ok ? FONT_BOLD : "sans-serif";
    const reg = ok ? FONT_REGULAR : "sans-serif";
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#0b0b0d";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#141418";
    rr(ctx, 20, 20, W - 40, H - 40, 28);
    ctx.fill();

    // الصورة (يمين)
    const cx = 784, cy = 129, r = 66;
    const img = await loadAvatar(d.avatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    else {
      ctx.fillStyle = "#2a2a31";
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();

    const right = 660;
    ctx.textAlign = "right";
    ctx.fillStyle = "#f4f4f6";
    let size = 40;
    ctx.font = `700 ${size}px "${bold}"`;
    while (size > 20 && ctx.measureText(d.name).width > 520) {
      size -= 2;
      ctx.font = `700 ${size}px "${bold}"`;
    }
    ctx.fillText(d.name, right, 92);

    ctx.font = `700 28px "${bold}"`;
    ctx.fillText(`المستوى ${d.level}`, right, 132);

    ctx.fillStyle = "#8b8b95";
    ctx.font = `400 19px "${reg}"`;
    ctx.fillText(`الترتيب #${d.rank}  ·  ${fmt(d.points)} نقطة  ·  ${fmt(d.messages)} رسالة`, right, 161);

    // شريط التقدم (يتعبّى من اليمين)
    const bx = 60, bw = 600, by = 190, bh = 28;
    ctx.fillStyle = "#2a2a31";
    rr(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    const pct = Math.max(0, Math.min(1, d.need > 0 ? d.xp / d.need : 0));
    const fw = Math.max(bh, bw * pct);
    ctx.fillStyle = "#f1f1f4";
    rr(ctx, bx + bw - fw, by, fw, bh, bh / 2);
    ctx.fill();

    ctx.fillStyle = "#6f6f79";
    ctx.font = `400 16px "${reg}"`;
    ctx.fillText(`${fmt(d.xp)} / ${fmt(d.need)} للمستوى التالي`, right, 242);

    return await canvas.encode("png");
  } catch {
    return null;
  }
}
