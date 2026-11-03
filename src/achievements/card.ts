import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export interface AchTile {
  id: string;
  name: string;
  desc: string;
  unlocked: boolean;
  /** تقدم الإنجازات اللي لها عدّاد */
  progress?: { cur: number; need: number };
  /** تاريخ الفتح (نص جاهز) */
  at?: string;
}

const W = 1000;
const PAD = 36;
const GOLD = "#fbbf24";
const GREY = "#64748b";

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, r);
}
function fit(ctx: SKRSContext2D, text: string, family: string, size: number, maxW: number): void {
  let s = size;
  ctx.font = `700 ${s}px "${family}"`;
  while (s > 14 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}
/** نقسم النص لسطور حسب العرض */
function wrap(ctx: SKRSContext2D, text: string, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/* ───────── أيقونات مرسومة (بدون إيموجي) ───────── */

function icon(ctx: SKRSContext2D, id: string, cx: number, cy: number, k: number, color: string, family: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (id === "miser") {
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 40px "${family}"`;
    ctx.fillText("1", 0, 3);
  } else if (id === "generous") {
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.bezierCurveTo(-58, -8, -34, -50, 0, -22);
    ctx.bezierCurveTo(34, -50, 58, -8, 0, 32);
    ctx.fill();
  } else if (id === "city_guardian") {
    ctx.beginPath();
    ctx.moveTo(0, -42);
    ctx.lineTo(34, -28);
    ctx.lineTo(34, 4);
    ctx.quadraticCurveTo(34, 30, 0, 44);
    ctx.quadraticCurveTo(-34, 30, -34, 4);
    ctx.lineTo(-34, -28);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0b0b10";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-14, 2);
    ctx.lineTo(-3, 14);
    ctx.lineTo(16, -12);
    ctx.stroke();
  } else if (id === "professor") {
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(50, -12);
    ctx.lineTo(0, 10);
    ctx.lineTo(-50, -12);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-28, 4);
    ctx.lineTo(-28, 24);
    ctx.quadraticCurveTo(0, 40, 28, 24);
    ctx.lineTo(28, 4);
    ctx.lineTo(0, 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(46, -9);
    ctx.lineTo(46, 24);
    ctx.stroke();
  } else if (id === "too_fast") {
    ctx.beginPath();
    ctx.moveTo(10, -46);
    ctx.lineTo(-26, 6);
    ctx.lineTo(-2, 6);
    ctx.lineTo(-12, 46);
    ctx.lineTo(28, -10);
    ctx.lineTo(4, -10);
    ctx.closePath();
    ctx.fill();
  } else if (id === "too_slow") {
    ctx.beginPath();
    ctx.arc(-4, 14, 36, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(44, 14, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-26, 14, 14, 18);
    ctx.fillRect(10, 14, 14, 18);
    ctx.strokeStyle = "#0b0b10";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-20, 2);
    ctx.lineTo(12, 2);
    ctx.moveTo(-4, -16);
    ctx.lineTo(-4, 14);
    ctx.stroke();
  } else if (id === "bankrupt") {
    // سهم هابط فوق عملة فاضية
    ctx.beginPath();
    ctx.arc(0, 8, 30, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-8, -42);
    ctx.lineTo(8, -42);
    ctx.lineTo(8, -22);
    ctx.lineTo(18, -22);
    ctx.lineTo(0, -8);
    ctx.lineTo(-18, -22);
    ctx.lineTo(-8, -22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function lock(ctx: SKRSContext2D, x: number, y: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -4, 8, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = color;
  rr(ctx, -11, -4, 22, 17, 4);
  ctx.fill();
  ctx.restore();
}

/**
 * بطاقة الإنجازات: شبكة 3×2، مع حلقة تقدم عامة.
 * selected = إنجاز مختار: تتبرز بطاقته وتطلع لوحة تفاصيل تحت.
 */
export async function renderAchievements(name: string, tiles: AchTile[], selected?: string): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const sel = tiles.find((t) => t.id === selected);
    const cols = 3;
    const tw = (W - PAD * 2 - 2 * 18) / cols;
    const th = 214;
    const rows = Math.ceil(tiles.length / cols);
    const gridTop = 176;
    const gridH = rows * th + (rows - 1) * 18;
    const H = gridTop + gridH + (sel ? 214 : 28);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0b0b10");
    g.addColorStop(1, "#1a1a24");
    ctx.fillStyle = g;
    rr(ctx, 0, 0, W, H, 32);
    ctx.fill();
    const glow = ctx.createRadialGradient(W - 120, 20, 10, W - 120, 20, 380);
    glow.addColorStop(0, "rgba(251,191,36,0.16)");
    glow.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // العنوان + حلقة التقدم
    const done = tiles.filter((t) => t.unlocked).length;
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 48px "${family}"`;
    ctx.fillText("الإنجازات", W - PAD, 64);
    ctx.fillStyle = "#94a3b8";
    fit(ctx, name, family, 24, 560);
    ctx.fillText(name, W - PAD, 116);

    const rx = PAD + 70;
    const ry = 82;
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(rx, ry, 52, 0, Math.PI * 2);
    ctx.stroke();
    if (done > 0) {
      ctx.strokeStyle = GOLD;
      ctx.beginPath();
      ctx.arc(rx, ry, 52, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * done) / tiles.length);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 34px "${family}"`;
    ctx.fillText(`${done}/${tiles.length}`, rx, ry + 2);

    // البطاقات (الأول يمين)
    tiles.forEach((t, i) => {
      const col = i % cols;
      const r = Math.floor(i / cols);
      const x = W - PAD - tw - col * (tw + 18);
      const y = gridTop + r * (th + 18);
      const dim = Boolean(sel) && sel!.id !== t.id;
      ctx.globalAlpha = dim ? 0.45 : 1;
      ctx.fillStyle = t.unlocked ? "rgba(251,191,36,0.10)" : "rgba(255,255,255,0.05)";
      rr(ctx, x, y, tw, th, 26);
      ctx.fill();
      ctx.lineWidth = t.id === selected ? 4 : 2;
      ctx.strokeStyle = t.id === selected ? "#f8fafc" : t.unlocked ? "rgba(251,191,36,0.55)" : "rgba(255,255,255,0.08)";
      rr(ctx, x + 1, y + 1, tw - 2, th - 2, 25);
      ctx.stroke();

      const cx = x + tw / 2;
      // هالة الأيقونة
      ctx.fillStyle = t.unlocked ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.arc(cx, y + 76, 56, 0, Math.PI * 2);
      ctx.fill();
      icon(ctx, t.id, cx, y + 76, 0.9, t.unlocked ? GOLD : GREY, family);
      if (!t.unlocked) lock(ctx, x + tw - 28, y + 28, GREY);

      ctx.textAlign = "center";
      ctx.fillStyle = t.unlocked ? "#f8fafc" : "#cbd5e1";
      fit(ctx, t.name, family, 28, tw - 30);
      ctx.fillText(t.name, cx, y + 152);

      // حالة / تقدم
      if (t.unlocked) {
        ctx.fillStyle = "#16a34a";
        rr(ctx, cx - 50, y + 172, 100, 28, 14);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = `700 17px "${family}"`;
        ctx.fillText("مفتوح", cx, y + 187);
      } else if (t.progress) {
        const bw = tw - 70;
        const bx = x + 35;
        ctx.fillStyle = "rgba(255,255,255,0.1)";
        rr(ctx, bx, y + 176, bw, 14, 7);
        ctx.fill();
        const f = Math.min(1, t.progress.cur / t.progress.need);
        if (f > 0) {
          ctx.fillStyle = "#38bdf8";
          rr(ctx, bx + bw - bw * f, y + 176, Math.max(14, bw * f), 14, 7);
          ctx.fill();
        }
        ctx.fillStyle = "#94a3b8";
        ctx.font = `700 15px "${family}"`;
        ctx.fillText(`${t.progress.cur}/${t.progress.need}`, cx, y + 203);
      } else {
        ctx.fillStyle = "#64748b";
        ctx.font = `700 17px "${family}"`;
        ctx.fillText("مقفل", cx, y + 187);
      }
      ctx.globalAlpha = 1;
    });

    // لوحة التفاصيل
    if (sel) {
      const py = gridTop + gridH + 18;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      rr(ctx, PAD, py, W - PAD * 2, 178, 26);
      ctx.fill();
      ctx.fillStyle = sel.unlocked ? "rgba(251,191,36,0.2)" : "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.arc(W - PAD - 90, py + 89, 62, 0, Math.PI * 2);
      ctx.fill();
      icon(ctx, sel.id, W - PAD - 90, py + 89, 1, sel.unlocked ? GOLD : GREY, family);

      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      fit(ctx, sel.name, family, 38, 520);
      ctx.fillText(sel.name, W - PAD - 180, py + 46);
      ctx.fillStyle = "#cbd5e1";
      ctx.font = `700 23px "${family}"`;
      wrap(ctx, sel.desc, 520).slice(0, 2).forEach((l, k) => ctx.fillText(l, W - PAD - 180, py + 92 + k * 32));

      ctx.textAlign = "left";
      if (sel.unlocked) {
        ctx.fillStyle = "#4ade80";
        ctx.font = `700 26px "${family}"`;
        ctx.fillText("مفتوح", PAD + 36, py + 70);
        if (sel.at) {
          ctx.fillStyle = "#94a3b8";
          ctx.font = `700 20px "${family}"`;
          ctx.fillText(sel.at, PAD + 36, py + 108);
        }
      } else if (sel.progress) {
        ctx.fillStyle = "#38bdf8";
        ctx.font = `700 46px "${family}"`;
        ctx.fillText(`${sel.progress.cur}/${sel.progress.need}`, PAD + 36, py + 76);
        ctx.fillStyle = "#94a3b8";
        ctx.font = `700 20px "${family}"`;
        ctx.fillText("التقدم الحالي", PAD + 36, py + 120);
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.font = `700 26px "${family}"`;
        ctx.fillText("مقفل", PAD + 36, py + 89);
      }
    }
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
