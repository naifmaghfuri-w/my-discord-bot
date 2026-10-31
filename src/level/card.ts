import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD, FONT_REGULAR } from "../quests/render/fonts";
import { MAX_LEVEL } from "../services/economy";

export interface LevelCardData {
  name: string;
  avatar?: string;
  level: number;
  rank: number;
  messages: number;
  xp: number;
  need: number;
}

const W = 900;
const H = 230;
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
    const maxed = d.level >= MAX_LEVEL;

    // اللوحة بكامل الصورة (الزوايا شفافة، بدون إطار أسود حولها)
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#17171c");
    bg.addColorStop(1, "#0f0f13");
    ctx.fillStyle = bg;
    rr(ctx, 0, 0, W, H, 30);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 2;
    rr(ctx, 1, 1, W - 2, H - 2, 29);
    ctx.stroke();

    // الصورة (يمين) مع حلقة تتدرج بحسب المستوى
    const cx = 770, cy = 108, r = 70;
    const hue = (d.level * 28) % 360;
    const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ring.addColorStop(0, `hsl(${hue}, 85%, 70%)`);
    ring.addColorStop(1, `hsl(${(hue + 60) % 360}, 85%, 60%)`);
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
    ctx.fill();
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
    ctx.fillText(d.name, right, 70);

    ctx.font = `700 28px "${bold}"`;
    ctx.fillText(`المستوى ${d.level}`, right, 110);

    ctx.fillStyle = "#8b8b95";
    ctx.font = `400 19px "${reg}"`;
    ctx.fillText(`الترتيب #${d.rank}  ·  ${fmt(d.messages)} رسالة`, right, 139);

    // شريط التقدم (يتعبّى من اليمين)
    const bx = 60, bw = 600, by = 160, bh = 26;
    ctx.fillStyle = "#2a2a31";
    rr(ctx, bx, by, bw, bh, bh / 2);
    ctx.fill();
    const pct = maxed ? 1 : Math.max(0, Math.min(1, d.need > 0 ? d.xp / d.need : 0));
    const fw = Math.max(bh, bw * pct);
    const bar = ctx.createLinearGradient(bx + bw - fw, 0, bx + bw, 0);
    bar.addColorStop(0, maxed ? "#fbbf24" : "#d9d9e0");
    bar.addColorStop(1, "#ffffff");
    ctx.fillStyle = bar;
    rr(ctx, bx + bw - fw, by, fw, bh, bh / 2);
    ctx.fill();

    // نصوص تحت الشريط: كل جزء لحاله عشان ما ينعكس ترتيب الأرقام
    ctx.fillStyle = "#7c7c87";
    ctx.font = `400 16px "${reg}"`;
    ctx.textAlign = "right";
    ctx.fillText(maxed ? "وصلت للمستوى الأقصى" : `للمستوى ${d.level + 1}  ·  ${Math.round(pct * 100)}%`, right, 211);
    ctx.textAlign = "left";
    ctx.fillText(maxed ? "MAX" : `${fmt(d.xp)} / ${fmt(d.need)} XP`, bx, 211);

    return await canvas.encode("png");
  } catch {
    return null;
  }
}
