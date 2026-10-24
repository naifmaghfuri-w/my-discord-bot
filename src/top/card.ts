import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

export type TopKind = "level" | "rich" | "thief";

export interface TopRow {
  name: string;
  /** level: المستوى • rich: المجموع • thief: المسروق */
  value: number;
  /** level فقط: عدد الرسائل */
  extra?: number;
}

const W = 1000;
const PAD = 36;
const STEP = 64;
const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

const META: Record<TopKind, { title: string; sub: string; accent: string; valueHead: string }> = {
  level: { title: "توب المستويات", sub: "أعلى الأعضاء مستوى في السيرفر", accent: "rgba(59,130,246,0.14)", valueHead: "المستوى" },
  rich: { title: "أغنى الأشخاص", sub: "مجموع المحفظة والبنك", accent: "rgba(245,158,11,0.14)", valueHead: "المجموع" },
  thief: { title: "أشهر الحرامية", sub: "مجموع اللي سرقوه", accent: "rgba(239,68,68,0.14)", valueHead: "المسروق" },
};

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

const MEDAL = ["#fbbf24", "#cbd5e1", "#d97706"];

export async function renderTop(kind: TopKind, rows: TopRow[]): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const meta = META[kind];
    const empty = rows.length === 0;
    const H = empty ? 340 : 222 + rows.length * STEP + 24;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0b1220");
    g.addColorStop(1, "#1b2a4a");
    ctx.fillStyle = g;
    rr(ctx, 0, 0, W, H, 32);
    ctx.fill();
    ctx.fillStyle = meta.accent;
    ctx.beginPath();
    ctx.arc(120, 40, 220, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 46px "${family}"`;
    ctx.fillText(meta.title, W - PAD, 62);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 21px "${family}"`;
    ctx.fillText(meta.sub, W - PAD, 108);

    // رأس الجدول
    const col = kind === "level" ? { rank: W - PAD - 40, nameR: W - PAD - 90, value: 380, extra: 160 } : { rank: W - PAD - 40, nameR: W - PAD - 90, value: 170, extra: -1 };
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    rr(ctx, PAD, 146, W - PAD * 2, 52, 16);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 21px "${family}"`;
    ctx.textAlign = "center";
    ctx.fillText("التصنيف", col.rank, 172);
    ctx.textAlign = "right";
    ctx.fillText("الاسم", col.nameR, 172);
    ctx.textAlign = "center";
    ctx.fillText(meta.valueHead, col.value, 172);
    if (kind === "level") ctx.fillText("الرسائل", col.extra, 172);

    if (empty) {
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.font = `700 34px "${family}"`;
      ctx.fillText("لا توجد بيانات حالياً", W / 2, 270);
      return await canvas.encode("png");
    }

    rows.forEach((r, i) => {
      const y = 214 + i * STEP;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      rr(ctx, PAD, y, W - PAD * 2, 58, 16);
      ctx.fill();

      // رقم التصنيف (ميدالية للثلاثة الأوائل)
      const medal = MEDAL[i];
      if (medal) {
        ctx.fillStyle = medal;
        ctx.beginPath();
        ctx.arc(col.rank, y + 29, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0b1220";
      } else ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.font = `700 24px "${family}"`;
      ctx.fillText(String(i + 1), col.rank, y + 30);

      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      fit(ctx, r.name, family, 26, 400);
      ctx.fillText(r.name, col.nameR, y + 30);

      ctx.textAlign = "center";
      ctx.fillStyle = kind === "level" ? "#60a5fa" : "#fbbf24";
      fit(ctx, fmt(r.value), family, 28, 250);
      ctx.fillText(fmt(r.value), col.value, y + 30);
      if (kind === "level") {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `700 26px "${family}"`;
        ctx.fillText(fmt(r.extra ?? 0), col.extra, y + 30);
      }
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
