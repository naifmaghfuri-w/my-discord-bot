import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export interface ThiefMenuRow {
  place: string;
  max: number;
  /** null = جاهزة، غير كذا نص الانتظار */
  wait: string | null;
}

const W = 1000;
const PAD = 36;
const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
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
  while (s > 16 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}

/** قائمة السرقة: اسم المكان • الحد الأقصى • جاهزة أو لا */
export async function renderThiefMenu(rows: ThiefMenuRow[]): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 232 + rows.length * 84 + 20;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(239,68,68,0.12)");

    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 46px "${family}"`;
    ctx.fillText("اختر سرقتك", W - PAD, 66);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 21px "${family}"`;
    ctx.fillText("اضغط على الزر اللي تحت للمكان اللي تبي تسرقه", W - PAD, 112);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    rr(ctx, PAD, 146, W - PAD * 2, 52, 16);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 21px "${family}"`;
    ctx.textAlign = "right";
    ctx.fillText("المكان", W - PAD - 24, 172);
    ctx.textAlign = "center";
    ctx.fillText("الحد الأقصى", 520, 172);
    ctx.fillText("الحالة", 190, 172);

    rows.forEach((r, i) => {
      const y = 214 + i * 84;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      rr(ctx, PAD, y, W - PAD * 2, 72, 18);
      ctx.fill();

      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      fit(ctx, r.place, family, 30, 380);
      ctx.fillText(r.place, W - PAD - 24, y + 36);

      ctx.textAlign = "center";
      ctx.fillStyle = "#fbbf24";
      ctx.font = `700 32px "${family}"`;
      ctx.fillText(fmt(r.max), 520, y + 36);

      const ready = r.wait === null;
      ctx.fillStyle = ready ? "#16a34a" : "#b45309";
      rr(ctx, 190 - 80, y + 16, 160, 40, 20);
      ctx.fill();
      ctx.fillStyle = "#fff";
      fit(ctx, ready ? "جاهزة" : r.wait!, family, 21, 148);
      ctx.fillText(ready ? "جاهزة" : r.wait!, 190, y + 37);
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/** نتيجة السرقة: نجحت (أخضر) أو انمسكت (أحمر) */
export async function renderThiefResult(kind: "success" | "caught", place: string, amount: number): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 360;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    const ok = kind === "success";
    const accent = ok ? "#22c55e" : "#ef4444";
    bg(ctx, H, ok ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)");

    // دائرة الحالة (علامة صح / إكس مرسومة)
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(W - 130, 120, 62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (ok) {
      ctx.moveTo(W - 160, 122);
      ctx.lineTo(W - 138, 146);
      ctx.lineTo(W - 100, 96);
    } else {
      ctx.moveTo(W - 156, 94);
      ctx.lineTo(W - 104, 146);
      ctx.moveTo(W - 104, 94);
      ctx.lineTo(W - 156, 146);
    }
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 52px "${family}"`;
    ctx.fillText(ok ? "نجحت السرقة" : "انمسكت!", W - 230, 98);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText(ok ? "من" : "حارس البوابة في", W - 230, 146);
    ctx.fillStyle = "#e2e8f0";
    fit(ctx, place, family, 34, 560);
    ctx.fillText(place, W - 230 - (ok ? 44 : 150), 146);

    // لوحة المبلغ
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, PAD, 216, W - PAD * 2, 108, 24);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText(ok ? "المبلغ" : "التعويض", W - PAD - 28, 270);
    ctx.textAlign = "left";
    ctx.fillStyle = accent;
    ctx.font = `700 64px "${family}"`;
    ctx.fillText(`${ok ? "+" : "-"}${fmt(amount)}`, PAD + 32, 268);
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/** صورة السجن */
export async function renderThiefJail(timeLeft: string, bail: number): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 360;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(239,68,68,0.14)");
    // رمز القضبان
    ctx.fillStyle = "#ef4444";
    rr(ctx, W - 192, 58, 124, 124, 28);
    ctx.fill();
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 4; i++) {
      rr(ctx, W - 176 + i * 30, 72, 12, 96, 6);
      ctx.fill();
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 52px "${family}"`;
    ctx.fillText("أنت مسجون", W - 230, 96);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText("انمسكت مرتين ورا بعض", W - 230, 146);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, PAD, 216, W - PAD * 2, 108, 24);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText("باقي على خروجك", W - PAD - 28, 252);
    ctx.fillStyle = "#fca5a5";
    ctx.font = `700 40px "${family}"`;
    ctx.fillText(timeLeft, W - PAD - 28, 292);
    ctx.textAlign = "left";
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText("أو اطلع بكفالة", PAD + 32, 252);
    ctx.fillStyle = "#fbbf24";
    ctx.font = `700 40px "${family}"`;
    ctx.fillText(`${fmt(bail)} Jenny`, PAD + 32, 292);
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
