import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export type IconKind = "coin" | "bank" | "chat" | "flame" | "bag" | "building" | "heart" | "home" | "level" | "dagger" | "star";

export interface Tile {
  label: string;
  value: string;
  sub?: string;
  /** 0..1 شريط صغير أسفل البطاقة */
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
}

const W = 1100;
const H = 640;
const RED = "#ef4444";
const RED_D = "#b91c1c";
const TXT = "#fde8e8";
const MUTED = "#e9a3a3";
const fmtN = (n: number): string => Math.round(n).toLocaleString("en-US");
void fmtN;

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

/** مستطيل بزوايا مقصوصة (طابع HUD) */
function chamfer(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, c = 12): void {
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function panel(ctx: SKRSContext2D, x: number, y: number, w: number, h: number): void {
  chamfer(ctx, x, y, w, h);
  ctx.fillStyle = "rgba(24,6,10,0.62)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(239,68,68,0.45)";
  ctx.stroke();
}

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
    case "star": {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? h : h * 0.45;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
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
      ctx.moveTo(-h * 0.4, h * 0.0);
      ctx.lineTo(-h * 0.6, h * 0.8);
      ctx.lineTo(h * 0.1, h * 0.0);
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
      ctx.lineTo(-h * 0.7, -h * 0.1 + h * 0.6);
      ctx.moveTo(-h * 0.5, h * 0.5);
      ctx.lineTo(-h * 0.9, h * 0.9);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function bat(ctx: SKRSContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "rgba(10,2,4,0.85)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-8, -9, -22, -4);
  ctx.quadraticCurveTo(-16, -1, -14, 5);
  ctx.quadraticCurveTo(-9, 1, -5, 4);
  ctx.quadraticCurveTo(-2, 2, 0, 6);
  ctx.quadraticCurveTo(2, 2, 5, 4);
  ctx.quadraticCurveTo(9, 1, 14, 5);
  ctx.quadraticCurveTo(16, -1, 22, -4);
  ctx.quadraticCurveTo(8, -9, 0, 0);
  ctx.fill();
  ctx.restore();
}

function castle(ctx: SKRSContext2D): void {
  ctx.fillStyle = "rgba(8,1,3,0.72)";
  const base = 600;
  const block = (x: number, y: number, w: number) => ctx.fillRect(x, y, w, base - y);
  const tower = (x: number, y: number, w: number, roof: number) => {
    block(x, y, w);
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + w / 2, y - roof);
    ctx.lineTo(x + w + 6, y);
    ctx.closePath();
    ctx.fill();
  };
  block(430, 300, 240);
  tower(400, 210, 50, 90);
  tower(650, 230, 50, 80);
  tower(500, 150, 70, 120);
  tower(590, 190, 46, 90);
  block(470, 250, 160);
  // نوافذ
  ctx.fillStyle = "rgba(251,146,60,0.35)";
  for (const [x, y] of [[525, 210], [545, 210], [608, 250], [414, 270], [664, 290], [480, 340], [560, 340], [610, 340]] as const) ctx.fillRect(x, y, 6, 12);
}

export async function renderProfile(d: ProfileData): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    // ── الخلفية ──
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#140408");
    g.addColorStop(0.5, "#1d0509");
    g.addColorStop(1, "#0a0204");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const moon = ctx.createRadialGradient(760, 150, 10, 760, 150, 230);
    moon.addColorStop(0, "rgba(220,38,38,0.55)");
    moon.addColorStop(0.45, "rgba(153,27,27,0.28)");
    moon.addColorStop(1, "rgba(153,27,27,0)");
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(185,28,28,0.38)";
    ctx.beginPath();
    ctx.arc(760, 150, 92, 0, Math.PI * 2);
    ctx.fill();

    castle(ctx);
    for (const [x, y, s] of [[300, 90, 1], [380, 130, 0.7], [860, 70, 0.9], [980, 190, 0.6], [180, 250, 0.8], [700, 260, 0.6]] as const) bat(ctx, x, y, s);

    const vg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 700);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // ── أقواس الزوايا ──
    ctx.save();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 4;
    ctx.shadowColor = RED;
    ctx.shadowBlur = 12;
    const m = 18, L = 52;
    for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * L);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * L, y);
      ctx.stroke();
    }
    ctx.restore();

    // ── الصورة (يسار) ──
    const ax = 138, ay = 122, ar = 76;
    ctx.strokeStyle = "rgba(239,68,68,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, ar + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = RED;
    ctx.shadowBlur = 18;
    ctx.fillStyle = RED;
    ctx.beginPath();
    ctx.arc(ax, ay, ar + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const img = await loadAvatar(d.avatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, ar, 0, Math.PI * 2);
    ctx.clip();
    if (img) ctx.drawImage(img, ax - ar, ay - ar, ar * 2, ar * 2);
    else {
      ctx.fillStyle = "#2a0a0f";
      ctx.fillRect(ax - ar, ay - ar, ar * 2, ar * 2);
    }
    ctx.restore();

    // ── الاسم ──
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    icon(ctx, "level", 262, 70, 26, "#ffffff");
    fit(ctx, d.name, family, 46, 470);
    ctx.save();
    ctx.shadowColor = "rgba(239,68,68,0.6)";
    ctx.shadowBlur = 10;
    ctx.fillText(d.name, 290, 70);
    ctx.restore();

    // ── شريط الألقاب (وظيفة/شركة/زواج) ──
    const sx = 238, sy = 120, sw = 558, sh = 54;
    panel(ctx, sx, sy, sw, sh);
    const cw = sw / Math.max(1, d.tags.length);
    d.tags.forEach((t, i) => {
      const cx = sx + sw - cw * i - cw / 2;
      if (i > 0) {
        ctx.strokeStyle = "rgba(239,68,68,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sx + sw - cw * i, sy + 10);
        ctx.lineTo(sx + sw - cw * i, sy + sh - 10);
        ctx.stroke();
      }
      ctx.textAlign = "right";
      ctx.fillStyle = TXT;
      fit(ctx, t.text, family, 20, cw - 56);
      const tw = ctx.measureText(t.text).width;
      const total = tw + 30;
      ctx.fillText(t.text, cx + total / 2 - 28, sy + sh / 2 + 1);
      icon(ctx, t.icon, cx + total / 2 - 10, sy + sh / 2, 20, RED);
    });

    // ── حلقة المستوى (يمين) ──
    const rx = 950, ry = 122, rr0 = 80;
    ctx.lineWidth = 13;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.arc(rx, ry, rr0, 0, Math.PI * 2);
    ctx.stroke();
    const pct = Math.max(0, Math.min(1, d.need > 0 ? d.xp / d.need : 0));
    if (pct > 0) {
      ctx.save();
      const rg = ctx.createLinearGradient(rx - rr0, ry - rr0, rx + rr0, ry + rr0);
      rg.addColorStop(0, "#f87171");
      rg.addColorStop(1, RED_D);
      ctx.strokeStyle = rg;
      ctx.lineCap = "round";
      ctx.shadowColor = RED;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(rx, ry, rr0, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    fit(ctx, String(d.level), family, 58, 100);
    ctx.fillText(String(d.level), rx, ry - 12);
    ctx.fillStyle = "#f87171";
    ctx.font = `700 18px "${family}"`;
    ctx.fillText("المستوى", rx, ry + 26);
    ctx.fillStyle = MUTED;
    ctx.font = `700 13px "${family}"`;
    ctx.fillText(`${d.xp.toLocaleString("en-US")} / ${d.need.toLocaleString("en-US")}`, rx, ry + 46);

    // ── شريط التصنيفات ──
    const ry0 = 218, rh = 72, rx0 = 40, rw = W - 80;
    panel(ctx, rx0, ry0, rw, rh);
    const rcw = rw / Math.max(1, d.ranks.length);
    d.ranks.forEach((r, i) => {
      const cx = rx0 + rw - rcw * i - rcw / 2;
      if (i > 0) {
        ctx.strokeStyle = "rgba(239,68,68,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx0 + rw - rcw * i, ry0 + 10);
        ctx.lineTo(rx0 + rw - rcw * i, ry0 + rh - 10);
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.fillStyle = TXT;
      ctx.font = `700 19px "${family}"`;
      ctx.fillText(r.label, cx, ry0 + 22);
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 34px "${family}"`;
      const vw = ctx.measureText(r.value).width;
      ctx.fillText(r.value, cx + 14, ry0 + 52);
      icon(ctx, r.icon, cx - vw / 2 - 12, ry0 + 52, 26, RED);
    });

    // ── البطاقات (4 × صفين) ──
    const gap = 14;
    const tw = (W - 80 - gap * 3) / 4;
    const th = 146;
    d.tiles.slice(0, 8).forEach((t, i) => {
      const col = i % 4, rw2 = Math.floor(i / 4);
      const x = 40 + (3 - col) * (tw + gap);
      const y = 308 + rw2 * (th + gap);
      panel(ctx, x, y, tw, th);
      icon(ctx, t.icon, x + 28, y + 30, 24, RED);
      ctx.textAlign = "right";
      ctx.fillStyle = TXT;
      ctx.font = `700 21px "${family}"`;
      ctx.fillText(t.label, x + tw - 20, y + 30);
      ctx.fillStyle = "#ffffff";
      fit(ctx, t.value, family, 38, tw - 40);
      ctx.fillText(t.value, x + tw - 20, y + 74);
      if (t.sub) {
        ctx.fillStyle = MUTED;
        fit(ctx, t.sub, family, 18, tw - 40);
        ctx.fillText(t.sub, x + tw - 20, y + 104);
      }
      // الشريط
      const bx = x + 20, bw = tw - 40, by = y + th - 22;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(bx, by, bw, 6);
      if (t.bar && t.bar > 0) {
        const bg2 = ctx.createLinearGradient(bx, 0, bx + bw, 0);
        bg2.addColorStop(0, RED_D);
        bg2.addColorStop(1, "#f87171");
        ctx.fillStyle = bg2;
        ctx.fillRect(bx, by, bw * Math.min(1, t.bar), 6);
      }
    });

    return await canvas.encode("png");
  } catch {
    return null;
  }
}
