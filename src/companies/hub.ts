import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export interface PayCell {
  value: string;
  unit: string;
}
export interface HubRegRow {
  name: string;
  pay: PayCell;
  promo: boolean;
}
export interface HubCorpRow {
  name: string;
  company: string;
  pay: PayCell;
  count: string;
  promo: boolean;
}

const W = 1000;
const PAD = 36;
const STEP = 64;
const NAME_R = W - PAD - 24;

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function fit(ctx: SKRSContext2D, text: string, family: string, size: number, maxW: number): void {
  let s = size;
  ctx.font = `700 ${s}px "${family}"`;
  while (s > 14 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}

function promoPill(ctx: SKRSContext2D, cx: number, cy: number, yes: boolean, family: string): void {
  ctx.fillStyle = yes ? "#16a34a" : "#475569";
  rr(ctx, cx - 36, cy - 17, 72, 34, 17);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = `700 19px "${family}"`;
  ctx.fillText(yes ? "نعم" : "لا", cx, cy + 1);
}

function payCell(ctx: SKRSContext2D, cx: number, y: number, pay: PayCell, family: string): void {
  ctx.textAlign = "center";
  ctx.fillStyle = "#fbbf24";
  fit(ctx, pay.value, family, 26, 190);
  ctx.fillText(pay.value, cx, y + 24);
  ctx.fillStyle = "#94a3b8";
  ctx.font = `700 16px "${family}"`;
  ctx.fillText(pay.unit, cx, y + 47);
}

/** صورة قائمة الوظائف: reg = الوظائف العادية، corp = وظائف الشركات */
export async function renderHub(kind: "reg" | "corp", reg: HubRegRow[], corp: HubCorpRow[]): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const rows = kind === "reg" ? reg.length : corp.length;
    const empty = kind === "corp" && rows === 0;
    const H = empty ? 360 : 222 + rows * STEP + 24;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0b1220");
    bg.addColorStop(1, "#1b2a4a");
    ctx.fillStyle = bg;
    rr(ctx, 0, 0, W, H, 32);
    ctx.fill();
    ctx.fillStyle = "rgba(59,130,246,0.10)";
    ctx.beginPath();
    ctx.arc(120, 40, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 46px "${family}"`;
    ctx.fillText(kind === "reg" ? "الوظائف العادية" : "وظائف الشركات", W - PAD, 62);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 21px "${family}"`;
    ctx.fillText(kind === "reg" ? "اختر وظيفتك من القائمة أسفل الصورة" : "طلبات التوظيف المفتوحة في شركات السيرفر", W - PAD, 108);

    // رأس الجدول
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    rr(ctx, PAD, 146, W - PAD * 2, 52, 16);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 21px "${family}"`;
    const cols = kind === "reg" ? { pay: 520, count: -1, promo: 190 } : { pay: 590, count: 400, promo: 190 };
    ctx.textAlign = "right";
    ctx.fillText("اسم الوظيفة", NAME_R, 172);
    ctx.textAlign = "center";
    ctx.fillText("الراتب", cols.pay, 172);
    if (kind === "corp") ctx.fillText("العدد", cols.count, 172);
    ctx.fillText("هل لها ترقية", cols.promo, 172);

    if (empty) {
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.font = `700 34px "${family}"`;
      ctx.fillText("لا توجد وظائف حالياً", W / 2, 270);
      return await canvas.encode("png");
    }

    const drawRowBg = (i: number, y: number) => {
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      rr(ctx, PAD, y, W - PAD * 2, 58, 16);
      ctx.fill();
    };

    if (kind === "reg") {
      reg.forEach((r, i) => {
        const y = 214 + i * STEP;
        drawRowBg(i, y);
        ctx.textAlign = "right";
        ctx.fillStyle = "#f8fafc";
        fit(ctx, r.name, family, 26, 300);
        ctx.fillText(r.name, NAME_R, y + 30);
        payCell(ctx, cols.pay, y + 3, r.pay, family);
        promoPill(ctx, cols.promo, y + 30, r.promo, family);
      });
    } else {
      corp.forEach((r, i) => {
        const y = 214 + i * STEP;
        drawRowBg(i, y);
        ctx.textAlign = "right";
        ctx.fillStyle = "#f8fafc";
        fit(ctx, r.name, family, 26, 300);
        ctx.fillText(r.name, NAME_R, y + 22);
        ctx.fillStyle = "#94a3b8";
        fit(ctx, r.company, family, 17, 300);
        ctx.fillText(r.company, NAME_R, y + 45);
        payCell(ctx, cols.pay, y + 3, r.pay, family);
        ctx.textAlign = "center";
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `700 26px "${family}"`;
        ctx.fillText(r.count, cols.count, y + 30);
        promoPill(ctx, cols.promo, y + 30, r.promo, family);
      });
    }
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
