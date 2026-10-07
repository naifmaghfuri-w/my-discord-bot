import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";
import { COMPOUND_MAP, PRESSURE, TEMP } from "./compounds";
import { ELEMENT_MAP } from "./elements";
import { encodeGif, type GifFrame } from "./gif";

const WIDTH = 520;
const HEIGHT = 540;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** يمزج ألوان مكونات الخليط (حسب الكمية) في لون سائل واحد */
function mixColor(mix: Record<string, number>): [number, number, number] | null {
  let r = 0, g = 0, b = 0, total = 0;
  for (const [id, qty] of Object.entries(mix)) {
    if (qty <= 0) continue;
    const hex = ELEMENT_MAP[id]?.color ?? (COMPOUND_MAP[id] ? "#c084fc" : "#94a3b8");
    const [cr, cg, cb] = hexToRgb(hex);
    r += cr * qty; g += cg * qty; b += cb * qty; total += qty;
  }
  return total === 0 ? null : [Math.round(r / total), Math.round(g / total), Math.round(b / total)];
}

function tempRatio(temp: number): number {
  return Math.min(1, Math.max(0, (temp - TEMP.min) / (TEMP.max - TEMP.min)));
}

function flaskPath(ctx: SKRSContext2D, cx: number) {
  const neckTop = 50;
  const bulbCenterY = 285;
  const bulbRadius = 120;
  const neckHalf = 24;
  // نقطة التقاء العنق مع الكرة
  const junctionY = bulbCenterY - Math.sqrt(bulbRadius * bulbRadius - neckHalf * neckHalf);
  const aLeft = Math.atan2(junctionY - bulbCenterY, -neckHalf);
  const aRight = Math.atan2(junctionY - bulbCenterY, neckHalf);

  ctx.beginPath();
  ctx.moveTo(cx - neckHalf, neckTop);
  ctx.lineTo(cx - neckHalf, junctionY);
  // القوس يلف من اليسار عبر القاع إلى اليمين (عكس عقارب الساعة)
  ctx.arc(cx, bulbCenterY, bulbRadius, aLeft, aRight, true);
  ctx.lineTo(cx + neckHalf, neckTop);
  ctx.closePath();
  return { neckTop, bulbCenterY, bulbRadius };
}

function drawBackground(ctx: SKRSContext2D, glow: string | null) {
  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#1e293b");
  bg.addColorStop(1, "#0b1220");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (glow) {
    const g = ctx.createRadialGradient(WIDTH / 2, 320, 20, WIDTH / 2, 320, 260);
    g.addColorStop(0, glow);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function drawThermometer(ctx: SKRSContext2D, temp: number) {
  const x = 52, top = 90, h = 300, w = 18;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.roundRect(x, top, w, h, 9);
  ctx.fill();

  const ratio = tempRatio(temp);
  const fill = Math.max(10, h * ratio);
  ctx.fillStyle = `hsl(${220 - ratio * 220}, 90%, 55%)`;
  ctx.beginPath();
  ctx.roundRect(x, top + h - fill, w, fill, 9);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x + w / 2, top + h + 10, 20, 0, Math.PI * 2);
  ctx.fill();
}

function drawPressureGauge(ctx: SKRSContext2D, pressure: number) {
  const cx = WIDTH - 62, cy = 240, r = 40;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.8, Math.PI * 2.2);
  ctx.stroke();

  const ratio = (pressure - PRESSURE.min) / (PRESSURE.max - PRESSURE.min);
  ctx.strokeStyle = ratio > 0.75 ? "#f43f5e" : ratio > 0.4 ? "#f59e0b" : "#38bdf8";
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * Math.max(0.02, ratio)));
  ctx.stroke();

  // الإبرة
  const angle = Math.PI * (0.8 + 1.4 * ratio);
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * (r - 12), cy + Math.sin(angle) * (r - 12));
  ctx.stroke();
}

function drawFlask(ctx: SKRSContext2D, mix: Record<string, number>, temp: number, pressure: number) {
  const cx = WIDTH / 2;
  const { neckTop, bulbCenterY, bulbRadius } = flaskPath(ctx, cx);
  const ids = Object.keys(mix).filter((id) => mix[id] > 0);
  const totalUnits = ids.reduce((a, id) => a + mix[id], 0);
  const color = mixColor(mix);

  ctx.save();
  ctx.clip();

  if (color) {
    // مستوى السائل يرتفع مع كمية الخليط
    const fillTopY = bulbCenterY + bulbRadius - 20 - Math.min(170, 35 + totalUnits * 20);
    const [r, g, b] = color;
    const ratio = tempRatio(temp);
    // الحرارة تفتّح اللون وتدفّيه
    const warm = (v: number, add: number) => Math.min(255, Math.round(v + add * ratio));
    const grad = ctx.createLinearGradient(0, fillTopY, 0, bulbCenterY + bulbRadius);
    grad.addColorStop(0, `rgb(${warm(r, 70)},${warm(g, 30)},${b})`);
    grad.addColorStop(1, `rgb(${Math.round(r * 0.35)},${Math.round(g * 0.35)},${Math.round(b * 0.35)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, fillTopY, WIDTH, HEIGHT - fillTopY);

    // فقاعات: تزيد مع الضغط والحرارة
    const bubbleCount = Math.round(pressure * 1.6 + ratio * 14);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < bubbleCount; i++) {
      const bx = cx + (((i * 37) % (bulbRadius * 1.5)) - bulbRadius * 0.75);
      const by = fillTopY + 14 + ((i * 53) % Math.max(20, bulbCenterY + bulbRadius - fillTopY - 24));
      ctx.beginPath();
      ctx.arc(bx, by, 3 + (i % 3) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "rgba(148,163,184,0.08)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  // لمعة الزجاج
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(cx - bulbRadius + 26, bulbCenterY - 70, 12, 120);
  ctx.restore();

  flaskPath(ctx, cx);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.fillRect(cx - 28, neckTop - 14, 56, 16);

  // بخار عند الحرارة العالية
  if (temp >= 100) {
    const puffs = Math.min(5, Math.floor(temp / 100));
    ctx.fillStyle = "rgba(226,232,240,0.28)";
    for (let i = 0; i < puffs; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - 2) * 14, neckTop - 30 - i * 14, 14 + i * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** نقاط ملوّنة تحت القارورة بعدد/لون كل مكون */
function drawIngredients(ctx: SKRSContext2D, mix: Record<string, number>, font: string) {
  const ids = Object.keys(mix).filter((id) => mix[id] > 0).slice(0, 8);
  if (ids.length === 0) return;
  const gap = 56;
  const startX = WIDTH / 2 - ((ids.length - 1) * gap) / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font;
  ids.forEach((id, i) => {
    const x = startX + i * gap;
    ctx.fillStyle = ELEMENT_MAP[id]?.color ?? "#c084fc";
    ctx.beginPath();
    ctx.arc(x, 462, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0b1220";
    ctx.fillText(String(mix[id]), x, 462);
  });
}

export async function renderFlask(mix: Record<string, number>, temp: number, pressure: number): Promise<Buffer | null> {
  const hasFont = ensureFontsRegistered();
  const family = hasFont ? FONT_BOLD : "sans-serif";

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const color = mixColor(mix);
  const ratio = tempRatio(temp);
  drawBackground(ctx, color ? `rgba(${color[0]},${color[1]},${color[2]},${0.12 + ratio * 0.28})` : null);
  drawThermometer(ctx, temp);
  drawPressureGauge(ctx, pressure);
  drawFlask(ctx, mix, temp, pressure);
  drawIngredients(ctx, mix, `700 16px "${family}"`);

  // الأرقام فقط (لاتينية) حتى تظهر سليمة حتى بدون الخط العربي
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 26px "${family}"`;
  ctx.fillText(`${temp}°C`, WIDTH / 2 - 90, HEIGHT - 24);
  ctx.fillText(`${pressure} atm`, WIDTH / 2 + 90, HEIGHT - 24);

  return canvas.encode("png");
}

/** صورة نتيجة التفاعل: توهّج بلون الندرة + كمية ظاهرة */
export async function renderResult(compoundId: string, color: number): Promise<Buffer> {
  const compound = COMPOUND_MAP[compoundId];
  const hasFont = ensureFontsRegistered();
  const family = hasFont ? FONT_BOLD : "sans-serif";

  const canvas = createCanvas(WIDTH, 300);
  const ctx = canvas.getContext("2d");
  const hex = `#${color.toString(16).padStart(6, "0")}`;
  const [r, g, b] = hexToRgb(hex);

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, WIDTH, 300);
  const glow = ctx.createRadialGradient(WIDTH / 2, 150, 10, WIDTH / 2, 150, 230);
  glow.addColorStop(0, `rgba(${r},${g},${b},0.55)`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, 300);

  // شرارات
  ctx.fillStyle = hex;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const d = 90 + ((i * 37) % 60);
    ctx.beginPath();
    ctx.arc(WIDTH / 2 + Math.cos(a) * d, 150 + Math.sin(a) * d * 0.7, 2 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  // حلقة مركزية بلون الندرة
  ctx.lineWidth = 8;
  ctx.strokeStyle = hex;
  ctx.beginPath();
  ctx.arc(WIDTH / 2, 150, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(${r},${g},${b},0.25)`;
  ctx.fill();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 34px "${family}"`;
  ctx.fillText(compound ? compound.icon : "✨", WIDTH / 2, 150);

  return canvas.encode("png");
}

/* ───────────── أنيميشن التفاعل (GIF) ───────────── */

export type ReactionOutcome =
  | { kind: "success"; color: number; name: string; rarityName: string }
  | { kind: "fail" };

const GIF_SCALE = 0.6;

function drawStar(ctx: SKRSContext2D, cx: number, cy: number, outer: number, inner: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * GIF قصير: الدورق يهتز وتكثر فقاعاته، وميض، ثم نتيجة (توهّج بلون الندرة أو دخان عند الفشل).
 * يرجع null إذا تعذّر التوليد (الرسالة تكمل بدون أنيميشن).
 */
export async function renderReactionGif(
  mix: Record<string, number>,
  temp: number,
  pressure: number,
  outcome: ReactionOutcome,
): Promise<Buffer | null> {
  try {
    const hasFont = ensureFontsRegistered();
    const family = hasFont ? FONT_BOLD : "sans-serif";
    const W = Math.round(WIDTH * GIF_SCALE);
    const H = Math.round(HEIGHT * GIF_SCALE);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    const frames: GifFrame[] = [];

    const hex = outcome.kind === "success" ? `#${outcome.color.toString(16).padStart(6, "0")}` : "#64748b";
    const [cr, cg, cb] = hexToRgb(hex);
    const liquid = mixColor(mix);

    const begin = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.scale(GIF_SCALE, GIF_SCALE);
    };
    const grab = (delayMs: number) => {
      const img = ctx.getImageData(0, 0, W, H);
      frames.push({ rgba: img.data, delayMs });
    };

    const flaskFrame = (i: number, total: number, flash = 0) => {
      begin();
      const k = i / total;
      const glow = liquid ? `rgba(${liquid[0]},${liquid[1]},${liquid[2]},${0.12 + k * 0.4})` : null;
      drawBackground(ctx, glow);
      drawThermometer(ctx, Math.min(TEMP.max, temp + k * 80));
      drawPressureGauge(ctx, Math.min(PRESSURE.max, pressure + k * 6));
      ctx.save();
      ctx.translate(Math.sin(i * 2.5) * (2 + i * 1.3), Math.cos(i * 3.1) * (1 + i * 0.5));
      drawFlask(ctx, mix, temp + k * 120, Math.min(PRESSURE.max, pressure + i * 2));
      ctx.restore();
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash})`;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      }
    };

    // 1) تسخين واهتزاز
    for (let i = 0; i < 9; i++) {
      flaskFrame(i, 8);
      grab(90);
    }
    // 2) وميض
    flaskFrame(8, 8, 0.85);
    grab(70);
    flaskFrame(8, 8, 0.45);
    grab(70);

    // 3) النتيجة
    for (let j = 0; j < 5; j++) {
      begin();
      const last = j === 4;
      if (outcome.kind === "success") {
        drawBackground(ctx, `rgba(${cr},${cg},${cb},${0.25 + j * 0.1})`);
        const cx = WIDTH / 2;
        const cy = 230;
        const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 120 + j * 45);
        glow.addColorStop(0, `rgba(${cr},${cg},${cb},0.65)`);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = hex;
        for (let k = 0; k < 28; k++) {
          const a = (k / 28) * Math.PI * 2 + j * 0.25;
          const d = (j + 1) * 36 + (k % 5) * 9;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 2 + (k % 3), 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.lineWidth = 8;
        ctx.strokeStyle = hex;
        ctx.beginPath();
        ctx.arc(cx, cy, 50 + j * 7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#f8fafc";
        drawStar(ctx, cx, cy, 34 + j * 3, 11 + j, 4);
        ctx.fill();

        if (hasFont && j >= 2) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#f8fafc";
          ctx.font = `700 30px "${family}"`;
          ctx.fillText(outcome.name, cx, 400);
          ctx.fillStyle = hex;
          ctx.font = `700 22px "${family}"`;
          ctx.fillText(outcome.rarityName, cx, 440);
        }
      } else {
        drawBackground(ctx, null);
        drawThermometer(ctx, temp);
        drawPressureGauge(ctx, pressure);
        drawFlask(ctx, {}, temp, 1);
        // دخان رمادي يتصاعد
        for (let k = 0; k < 7; k++) {
          const rise = (j + 1) * 22 + k * 14;
          ctx.fillStyle = `rgba(148,163,184,${Math.max(0.05, 0.38 - j * 0.05)})`;
          ctx.beginPath();
          ctx.arc(WIDTH / 2 + Math.sin(k * 1.7 + j) * 26, 150 - rise * 0.6 + k * 4, 16 + k * 3 + j * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      grab(last ? 1500 : 130);
    }

    return encodeGif(frames, W, H);
  } catch {
    return null;
  }
}
