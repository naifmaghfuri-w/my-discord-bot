import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export interface Tile {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

export interface ProfileData {
  name: string;
  avatar?: string;
  level: number;
  rank: number;
  xp: number;
  need: number;
  wealth: number;
  tiles: Tile[];
}

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

function fit(ctx: SKRSContext2D, text: string, family: string, size: number, maxW: number): void {
  let s = size;
  ctx.font = `700 ${s}px "${family}"`;
  while (s > 14 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}

export async function renderProfile(d: ProfileData): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const rowsN = Math.ceil(d.tiles.length / 2);
    const H = 270 + rowsN * 140 + 10;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0b1220");
    g.addColorStop(1, "#1b2a4a");
    ctx.fillStyle = g;
    rr(ctx, 0, 0, W, H, 32);
    ctx.fill();
    ctx.fillStyle = "rgba(99,102,241,0.12)";
    ctx.beginPath();
    ctx.arc(150, 40, 240, 0, Math.PI * 2);
    ctx.fill();

    // الصورة
    const cx = W - PAD - 80, cy = 112, r = 74;
    const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    const hue = (d.level * 28) % 360;
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

    // الاسم والمستوى
    const right = cx - r - 28;
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    fit(ctx, d.name, family, 44, 560);
    ctx.fillText(d.name, right, 76);
    ctx.fillStyle = "#a5b4fc";
    ctx.font = `700 26px "${family}"`;
    ctx.fillText(`المستوى ${d.level}  ·  الترتيب #${d.rank}`, right, 122);

    // شريط التقدم
    const bx = PAD, bw = right - PAD - 160, by = 150, bh = 20;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    rr(ctx, bx, by, bw + 160, bh, bh / 2);
    ctx.fill();
    const pct = Math.max(0, Math.min(1, d.need > 0 ? d.xp / d.need : 0));
    const fw = Math.max(bh, (bw + 160) * pct);
    ctx.fillStyle = "#818cf8";
    rr(ctx, bx + (bw + 160) - fw, by, fw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 16px "${family}"`;
    ctx.textAlign = "left";
    ctx.fillText(`${fmt(d.xp)} / ${fmt(d.need)} XP`, bx, by + 40);

    // الثروة
    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 18px "${family}"`;
    ctx.fillText("إجمالي الثروة", right, by + 40);
    ctx.fillStyle = "#fbbf24";
    ctx.textAlign = "center";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText(`${fmt(d.wealth)} Jenny`, W / 2 - 40, by + 40);

    // البطاقات (عمودين)
    const tw = (W - PAD * 2 - 20) / 2;
    d.tiles.forEach((t, i) => {
      const col = i % 2, rw = Math.floor(i / 2);
      const x = col === 0 ? PAD + tw + 20 : PAD;
      const y = 250 + rw * 140;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      rr(ctx, x, y, tw, 120, 22);
      ctx.fill();
      ctx.fillStyle = t.accent;
      rr(ctx, x + tw - 8, y + 18, 5, 84, 3);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 19px "${family}"`;
      ctx.fillText(t.label, x + tw - 28, y + 28);
      ctx.fillStyle = "#f8fafc";
      fit(ctx, t.value, family, 30, tw - 56);
      ctx.fillText(t.value, x + tw - 28, y + 66);
      if (t.sub) {
        ctx.fillStyle = "#cbd5e1";
        fit(ctx, t.sub, family, 18, tw - 56);
        ctx.fillText(t.sub, x + tw - 28, y + 98);
      }
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
