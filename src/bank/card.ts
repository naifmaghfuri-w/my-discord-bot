import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD, FONT_REGULAR } from "../quests/render/fonts";

export interface BankCardData {
  name: string;
  avatar?: string;
  balance: number;
}

const W = 1000;
const H = 640;

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

async function loadAvatar(url?: string): Promise<Image | null> {
  if (!url) return null;
  return Promise.race([loadImage(url).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
}

export async function renderBankCard(d: BankCardData): Promise<Buffer | null> {
  try {
    const ok = ensureFontsRegistered();
    const bold = ok ? FONT_BOLD : "sans-serif";
    const reg = ok ? FONT_REGULAR : "sans-serif";
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "alphabetic";

    ctx.fillStyle = "#08080a";
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(20, 20, W - 20, H - 20);
    g.addColorStop(0, "#27272a");
    g.addColorStop(1, "#131315");
    ctx.fillStyle = g;
    rr(ctx, 20, 20, W - 40, H - 40, 44);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 2;
    rr(ctx, 21, 21, W - 42, H - 42, 43);
    ctx.stroke();

    // الشريحة
    ctx.fillStyle = "#c4a96f";
    rr(ctx, 820, 150, 111, 82, 18);
    ctx.fill();
    ctx.strokeStyle = "#9a7f4a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(876, 150);
    ctx.lineTo(876, 232);
    ctx.moveTo(820, 191);
    ctx.lineTo(931, 191);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.fillStyle = "#9a9aa3";
    ctx.font = `400 24px "${reg}"`;
    ctx.fillText("الرصيد", 930, 320);

    const text = Math.round(d.balance).toLocaleString("en-US");
    let size = 96;
    ctx.fillStyle = "#f4f4f6";
    ctx.font = `700 ${size}px "${bold}"`;
    while (size > 40 && ctx.measureText(text).width > 860) {
      size -= 4;
      ctx.font = `700 ${size}px "${bold}"`;
    }
    ctx.fillText(text, 930, 420);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(70, 500);
    ctx.lineTo(930, 500);
    ctx.stroke();

    ctx.fillStyle = "#6f6f79";
    ctx.font = `400 18px "${reg}"`;
    ctx.fillText("حامل البطاقة", 930, 555);
    ctx.fillStyle = "#f4f4f6";
    let ns = 32;
    ctx.font = `700 ${ns}px "${bold}"`;
    while (ns > 18 && ctx.measureText(d.name).width > 600) {
      ns -= 2;
      ctx.font = `700 ${ns}px "${bold}"`;
    }
    ctx.fillText(d.name, 930, 595);

    const r = 48;
    const img = await loadAvatar(d.avatar);
    ctx.save();
    ctx.beginPath();
    ctx.arc(118, 558, r, 0, Math.PI * 2);
    ctx.clip();
    if (img) ctx.drawImage(img, 118 - r, 558 - r, r * 2, r * 2);
    else {
      ctx.fillStyle = "#2a2a31";
      ctx.fillRect(118 - r, 558 - r, r * 2, r * 2);
    }
    ctx.restore();

    return await canvas.encode("png");
  } catch {
    return null;
  }
}
