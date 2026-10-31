import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";
import { drawCar } from "../shop/card";
import { STAT_KEYS, STAT_LABEL, type Stats } from "./data";

const W = 1000;
const PAD = 36;
const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, r);
}
function bg(ctx: SKRSContext2D, h: number, glow: string): void {
  const g = ctx.createLinearGradient(0, 0, W, h);
  g.addColorStop(0, "#0b0b10");
  g.addColorStop(1, "#1a1a24");
  ctx.fillStyle = g;
  rr(ctx, 0, 0, W, h, 32);
  ctx.fill();
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(140, 30, 230, 0, Math.PI * 2);
  ctx.fill();
}
function fit(ctx: SKRSContext2D, text: string, family: string, size: number, maxW: number): void {
  let s = size;
  ctx.font = `700 ${s}px "${family}"`;
  while (s > 14 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}
const fam = (): string => (ensureFontsRegistered() ? FONT_BOLD : "sans-serif");

/* ───────── بطاقة التعديل + شريط الإحصائيات ───────── */

export interface TuneData {
  title: string;
  sub: string;
  carId: string;
  stats: Stats;
  /** معاينة بعد التبديل (يظهر الفرق أخضر/أحمر) */
  preview?: Stats;
  /** القطع المركّبة: اسم الفئة + اسم القطعة */
  slots: { cat: string; part: string; stock: boolean }[];
}

export async function renderTune(d: TuneData): Promise<Buffer | null> {
  try {
    const family = fam();
    const H = 640;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(56,189,248,0.12)");

    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    fit(ctx, d.title, family, 44, 600);
    ctx.fillText(d.title, W - PAD, 62);
    ctx.fillStyle = "#94a3b8";
    fit(ctx, d.sub, family, 21, 600);
    ctx.fillText(d.sub, W - PAD, 108);
    drawCar(ctx, d.carId, 150, 100, 0.62);

    // شريط الإحصائيات
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    rr(ctx, PAD, 156, W - PAD * 2, 266, 24);
    ctx.fill();
    const barX = 170;
    const barW = 560;
    STAT_KEYS.forEach((k, i) => {
      const y = 196 + i * 62;
      const cur = d.stats[k];
      const pv = d.preview?.[k] ?? cur;
      ctx.textAlign = "right";
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `700 25px "${family}"`;
      ctx.fillText(STAT_LABEL[k], W - PAD - 28, y);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      rr(ctx, barX, y - 12, barW, 24, 12);
      ctx.fill();
      const lo = Math.min(cur, pv);
      const hi = Math.max(cur, pv);
      ctx.fillStyle = "#38bdf8";
      rr(ctx, barX, y - 12, (barW * lo) / 100, 24, 12);
      ctx.fill();
      if (hi > lo) {
        ctx.fillStyle = pv > cur ? "#22c55e" : "#ef4444";
        ctx.fillRect(barX + (barW * lo) / 100, y - 12, (barW * (hi - lo)) / 100, 24);
      }
      ctx.textAlign = "left";
      ctx.font = `700 28px "${family}"`;
      if (pv !== cur) {
        ctx.fillStyle = pv > cur ? "#4ade80" : "#f87171";
        ctx.fillText(`${pv}  (${pv > cur ? "+" : ""}${pv - cur})`, PAD + 20, y);
      } else {
        ctx.fillStyle = "#f8fafc";
        ctx.fillText(String(cur), PAD + 20, y);
      }
    });

    // القطع المركّبة
    const cw = (W - PAD * 2 - 24) / 3;
    d.slots.forEach((s, i) => {
      const col = i % 3;
      const r = Math.floor(i / 3);
      const x = W - PAD - cw - col * (cw + 12);
      const y = 442 + r * 92;
      ctx.fillStyle = s.stock ? "rgba(255,255,255,0.05)" : "rgba(34,197,94,0.16)";
      rr(ctx, x, y, cw, 80, 18);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 20px "${family}"`;
      ctx.fillText(s.cat, x + cw - 18, y + 26);
      ctx.fillStyle = s.stock ? "#cbd5e1" : "#f8fafc";
      fit(ctx, s.part, family, 25, cw - 36);
      ctx.fillText(s.part, x + cw - 18, y + 56);
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/* ───────── محل سبير بارتس ───────── */

export interface PartRow {
  name: string;
  effects: string;
  price: number;
  state: "installed" | "owned" | "buy";
}

export async function renderPartsShop(title: string, sub: string, carId: string, rows: PartRow[]): Promise<Buffer | null> {
  try {
    const family = fam();
    const H = 232 + rows.length * 84 + 20;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(251,191,36,0.1)");
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    fit(ctx, title, family, 44, 640);
    ctx.fillText(title, W - PAD, 66);
    ctx.fillStyle = "#94a3b8";
    fit(ctx, sub, family, 21, 640);
    ctx.fillText(sub, W - PAD, 112);
    drawCar(ctx, carId, 140, 96, 0.55);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    rr(ctx, PAD, 146, W - PAD * 2, 52, 16);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 21px "${family}"`;
    ctx.textAlign = "right";
    ctx.fillText("القطعة", W - PAD - 24, 172);
    ctx.textAlign = "center";
    ctx.fillText("التأثير", 500, 172);
    ctx.fillText("السعر", 270, 172);
    ctx.fillText("الحالة", 130, 172);

    rows.forEach((r, i) => {
      const y = 214 + i * 84;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      rr(ctx, PAD, y, W - PAD * 2, 72, 18);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      fit(ctx, r.name, family, 28, 300);
      ctx.fillText(r.name, W - PAD - 24, y + 36);
      ctx.textAlign = "center";
      ctx.fillStyle = "#4ade80";
      fit(ctx, r.effects, family, 22, 280);
      ctx.fillText(r.effects, 500, y + 36);
      ctx.fillStyle = "#fbbf24";
      ctx.font = `700 28px "${family}"`;
      ctx.fillText(r.price > 0 ? fmt(r.price) : "—", 270, y + 36);
      const color = r.state === "installed" ? "#2563eb" : r.state === "owned" ? "#16a34a" : "#b45309";
      ctx.fillStyle = color;
      rr(ctx, 130 - 70, y + 16, 140, 40, 20);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `700 21px "${family}"`;
      ctx.fillText(r.state === "installed" ? "مركّبة" : r.state === "owned" ? "عندك" : "للبيع", 130, y + 37);
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/* ───────── حلبة السباق ───────── */

export interface TrackRacer {
  name: string;
  carId: string;
  /** 0 → 1 */
  pos: number;
  rank?: number;
}

export async function renderTrack(title: string, sub: string, racers: TrackRacer[]): Promise<Buffer | null> {
  try {
    const family = fam();
    const laneH = 100;
    const H = 170 + racers.length * (laneH + 10) + 14;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(239,68,68,0.1)");
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 44px "${family}"`;
    ctx.fillText(title, W - PAD, 56);
    ctx.fillStyle = "#94a3b8";
    fit(ctx, sub, family, 21, W - PAD * 2);
    ctx.fillText(sub, W - PAD, 106);

    const x0 = PAD + 110;
    const x1 = W - PAD - 90;
    racers.forEach((r, i) => {
      const y = 140 + i * (laneH + 10);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      rr(ctx, PAD, y, W - PAD * 2, laneH, 22);
      ctx.fill();
      // خط النهاية
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 === 0 ? "#f8fafc" : "#0f172a";
        ctx.fillRect(x1 + 40, y + 10 + k * ((laneH - 20) / 6), 12, (laneH - 20) / 6);
      }
      ctx.textAlign = "left";
      ctx.fillStyle = "#e2e8f0";
      fit(ctx, r.name, family, 22, 260);
      ctx.fillText(r.name, PAD + 20, y + 20);
      drawCar(ctx, r.carId, x0 + r.pos * (x1 - x0), y + 62, 0.3);
      if (r.rank) {
        ctx.fillStyle = r.rank === 1 ? "#fbbf24" : r.rank === 2 ? "#cbd5e1" : "#b45309";
        ctx.beginPath();
        ctx.arc(W - PAD - 24, y + laneH / 2, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0b0b10";
        ctx.textAlign = "center";
        ctx.font = `700 26px "${family}"`;
        ctx.fillText(String(r.rank), W - PAD - 24, y + laneH / 2 + 1);
      }
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

export { fmt };
