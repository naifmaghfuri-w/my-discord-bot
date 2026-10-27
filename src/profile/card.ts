import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";
import { colorById } from "./styles";

export type IconKind = "coin" | "bank" | "chat" | "flame" | "bag" | "building" | "heart" | "home" | "level" | "dagger" | "star";

export interface Tile {
  label: string;
  value: string;
  sub?: string;
  /** 0..1 خط التقدم أسفل البطاقة */
  bar?: number;
  icon: IconKind;
}

export interface Tag {
  icon: IconKind;
  text: string;
}

export interface RankCell {
  label: string;
  value: string;
  icon: IconKind;
}

export interface ProfileData {
  name: string;
  avatar?: string;
  level: number;
  xp: number;
  need: number;
  tags: Tag[];
  ranks: RankCell[];
  tiles: Tile[];
  /** صورة الخلفية (لو العضو رفع وحدة) */
  bgImage?: Buffer | null;
  color: string;
}

const W = 1100;
const H = 660;

async function loadAvatar(url?: string): Promise<Image | null> {
  if (!url) return null;
  return Promise.race([loadImage(url).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

function fit(ctx: SKRSContext2D, text: string, family: string, size: number, maxW: number): void {
  let s = size;
  ctx.font = `700 ${s}px "${family}"`;
  while (s > 12 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}

function rrect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function glass(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r = 22): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  rrect(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(8,10,20,0.58)";
  ctx.fill();
  ctx.restore();
  rrect(ctx, x, y, w, h, r);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.stroke();
}

/* ───────────── الخلفية ───────────── */

/** خلفية افتراضية هادئة لو العضو ما رفع صورة */
function paintDefault(ctx: SKRSContext2D): void {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b1026");
  g.addColorStop(1, "#1b2147");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

async function paintBackground(ctx: SKRSContext2D, image?: Buffer | null): Promise<void> {
  const img = image ? await loadImage(Buffer.from(image)).catch(() => null) : null;
  if (!img) return paintDefault(ctx);
  // تعبئة كاملة (قص من المنتصف)
  const k = Math.max(W / img.width, H / img.height);
  const dw = img.width * k, dh = img.height * k;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
  // تعتيم خفيف يحافظ على وضوح الخطوط
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.fillRect(0, 0, W, H);
}

/** يجهّز صورة الخلفية: قص من المنتصف إلى 1100×660 وتخزين JPEG */
export async function makeBackground(buf: Buffer): Promise<Buffer | null> {
  try {
    const img = await loadImage(buf);
    if (!img.width || !img.height) return null;
    const canvas = createCanvas(W, H);
    const c = canvas.getContext("2d");
    const k = Math.max(W / img.width, H / img.height);
    const dw = img.width * k, dh = img.height * k;
    c.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return await canvas.encode("jpeg", 85);
  } catch {
    return null;
  }
}

/* ───────────── الأيقونات ───────────── */

function icon(ctx: SKRSContext2D, kind: IconKind, cx: number, cy: number, s: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, s / 9);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const h = s / 2;
  switch (kind) {
    case "coin":
      ctx.beginPath();
      ctx.arc(0, 0, h, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "star":
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? h : h * 0.45;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case "bank":
      ctx.beginPath();
      ctx.moveTo(-h, -h * 0.35);
      ctx.lineTo(0, -h);
      ctx.lineTo(h, -h * 0.35);
      ctx.closePath();
      ctx.stroke();
      for (const x of [-h * 0.6, 0, h * 0.6]) {
        ctx.beginPath();
        ctx.moveTo(x, -h * 0.15);
        ctx.lineTo(x, h * 0.6);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-h, h * 0.85);
      ctx.lineTo(h, h * 0.85);
      ctx.stroke();
      break;
    case "chat":
      ctx.beginPath();
      ctx.roundRect(-h, -h * 0.8, s, s * 0.7, 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-h * 0.4, 0);
      ctx.lineTo(-h * 0.6, h * 0.8);
      ctx.lineTo(h * 0.1, 0);
      ctx.stroke();
      break;
    case "flame":
      ctx.beginPath();
      ctx.moveTo(0, -h);
      ctx.bezierCurveTo(h * 0.9, -h * 0.2, h * 0.9, h * 0.9, 0, h);
      ctx.bezierCurveTo(-h * 0.9, h * 0.9, -h * 0.9, -h * 0.1, 0, -h);
      ctx.stroke();
      break;
    case "bag":
      ctx.beginPath();
      ctx.roundRect(-h, -h * 0.4, s, s * 0.8, 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -h * 0.4, h * 0.45, Math.PI, 0);
      ctx.stroke();
      break;
    case "building":
      ctx.beginPath();
      ctx.rect(-h * 0.7, -h, s * 0.7, s);
      ctx.stroke();
      for (const [x, y] of [[-0.3, -0.5], [0.3, -0.5], [-0.3, 0.1], [0.3, 0.1]] as const) ctx.fillRect(h * x - 2, h * y - 2, 4, 4);
      break;
    case "heart":
      ctx.beginPath();
      ctx.moveTo(0, h * 0.85);
      ctx.bezierCurveTo(-h * 1.4, -h * 0.1, -h * 0.5, -h * 1.1, 0, -h * 0.35);
      ctx.bezierCurveTo(h * 0.5, -h * 1.1, h * 1.4, -h * 0.1, 0, h * 0.85);
      ctx.stroke();
      break;
    case "home":
      ctx.beginPath();
      ctx.moveTo(-h, -h * 0.1);
      ctx.lineTo(0, -h);
      ctx.lineTo(h, -h * 0.1);
      ctx.moveTo(-h * 0.7, -h * 0.1);
      ctx.lineTo(-h * 0.7, h * 0.9);
      ctx.lineTo(h * 0.7, h * 0.9);
      ctx.lineTo(h * 0.7, -h * 0.1);
      ctx.stroke();
      break;
    case "level":
      for (const dy of [-h * 0.45, h * 0.35]) {
        ctx.beginPath();
        ctx.moveTo(-h * 0.8, dy + h * 0.4);
        ctx.lineTo(0, dy - h * 0.2);
        ctx.lineTo(h * 0.8, dy + h * 0.4);
        ctx.stroke();
      }
      break;
    case "dagger":
      ctx.beginPath();
      ctx.moveTo(h * 0.8, -h * 0.8);
      ctx.lineTo(-h * 0.5, h * 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-h * 0.1, -h * 0.1);
      ctx.lineTo(-h * 0.7, h * 0.5);
      ctx.moveTo(-h * 0.5, h * 0.5);
      ctx.lineTo(-h * 0.9, h * 0.9);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** خط تقدّم برأس متوهج */
function progressLine(ctx: SKRSContext2D, x: number, y: number, w: number, pct: number, color: string): void {
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  rrect(ctx, x, y - 2.5, w, 5, 3);
  ctx.fill();
  if (pct > 0) {
    const fw = Math.max(6, w * Math.min(1, pct));
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;
    rrect(ctx, x, y - 2.5, fw, 5, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + fw, y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export async function renderProfile(d: ProfileData): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const accent = colorById(d.color).hex;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    await paintBackground(ctx, d.bgImage);

    /* ── اللوحة اليسرى: الصورة + المستوى + الاسم + الألقاب ── */
    const lx = 36, ly = 36, lw = 320, lh = H - 72;
    glass(ctx, lx, ly, lw, lh, 30);
    const cx = lx + lw / 2;
    const ay = 176, ar = 82, gr = 106;

    // عداد المستوى (قوس 270° حول الصورة)
    const a0 = Math.PI * 0.75, sweep = Math.PI * 1.5;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.arc(cx, ay, gr, a0, a0 + sweep);
    ctx.stroke();
    const pct = Math.max(0, Math.min(1, d.need > 0 ? d.xp / d.need : 0));
    if (pct > 0) {
      ctx.save();
      ctx.strokeStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(cx, ay, gr, a0, a0 + sweep * pct);
      ctx.stroke();
      ctx.restore();
    }

    const img = await loadAvatar(d.avatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, ay, ar, 0, Math.PI * 2);
    ctx.clip();
    if (img) ctx.drawImage(img, cx - ar, ay - ar, ar * 2, ar * 2);
    else {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(cx - ar, ay - ar, ar * 2, ar * 2);
    }
    ctx.restore();

    // شارة المستوى بين طرفي القوس
    const bw = 168, bh = 46, by = ay + gr + 2;
    ctx.save();
    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = accent;
    rrect(ctx, cx - bw / 2, by - bh / 2, bw, bh, 23);
    ctx.fill();
    ctx.restore();
    ctx.textAlign = "center";
    ctx.fillStyle = "#0b0b10";
    ctx.font = `800 24px "${family}"`;
    ctx.fillText(`المستوى ${d.level}`, cx, by + 1);

    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 16px "${family}"`;
    ctx.fillText(`${d.xp.toLocaleString("en-US")} / ${d.need.toLocaleString("en-US")} XP`, cx, by + 40);

    // الاسم
    ctx.fillStyle = "#ffffff";
    fit(ctx, d.name, family, 36, lw - 40);
    ctx.fillText(d.name, cx, by + 84);

    // الألقاب (شرائح عمودية)
    const chipW = lw - 40, chipH = 44;
    d.tags.slice(0, 3).forEach((t, i) => {
      const y = by + 118 + i * (chipH + 10);
      rrect(ctx, lx + 20, y, chipW, chipH, 14);
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.fill();
      icon(ctx, t.icon, lx + 20 + chipW - 26, y + chipH / 2, 20, accent);
      ctx.textAlign = "right";
      ctx.fillStyle = "#f1f5f9";
      fit(ctx, t.text, family, 20, chipW - 66);
      ctx.fillText(t.text, lx + 20 + chipW - 50, y + chipH / 2 + 1);
    });

    /* ── المنطقة اليمنى ── */
    const rx = lx + lw + 20;
    const rw = W - 36 - rx;

    // التصنيفات (4 شرائح)
    const gapR = 12;
    const cw = (rw - gapR * 3) / 4;
    d.ranks.slice(0, 4).forEach((r, i) => {
      const x = rx + rw - (i + 1) * cw - i * gapR;
      glass(ctx, x, 36, cw, 92, 20);
      ctx.textAlign = "center";
      ctx.fillStyle = "#cbd5e1";
      ctx.font = `700 17px "${family}"`;
      ctx.fillText(r.label, x + cw / 2, 36 + 26);
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 32px "${family}"`;
      const vw = ctx.measureText(r.value).width;
      ctx.fillText(r.value, x + cw / 2 + 14, 36 + 64);
      icon(ctx, r.icon, x + cw / 2 - vw / 2 - 8, 36 + 64, 24, accent);
    });

    // البطاقات (2 عمود × 4 صفوف)
    const top = 144;
    const th = (H - 36 - top - 3 * gapR) / 4;
    const tw = (rw - gapR) / 2;
    d.tiles.slice(0, 8).forEach((t, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = rx + (1 - col) * (tw + gapR);
      const y = top + row * (th + gapR);
      glass(ctx, x, y, tw, th, 22);

      // مربع الأيقونة (يمين)
      const isz = 50;
      const ix = x + tw - 16 - isz, iy = y + 16;
      rrect(ctx, ix, iy, isz, isz, 14);
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fill();
      icon(ctx, t.icon, ix + isz / 2, iy + isz / 2, 26, accent);

      const textRight = ix - 14;
      const textW = textRight - (x + 16);
      ctx.textAlign = "right";
      ctx.fillStyle = "#cbd5e1";
      ctx.font = `700 18px "${family}"`;
      ctx.fillText(t.label, textRight, y + 25);
      ctx.fillStyle = "#ffffff";
      fit(ctx, t.value, family, 34, textW);
      ctx.fillText(t.value, textRight, y + 56);
      if (t.sub) {
        ctx.fillStyle = "#94a3b8";
        fit(ctx, t.sub, family, 16, tw - 32);
        ctx.fillText(t.sub, x + tw - 16, y + 81);
      }
      progressLine(ctx, x + 16, y + th - 13, tw - 32, t.bar ?? 0, accent);
    });

    return await canvas.encode("png");
  } catch {
    return null;
  }
}
