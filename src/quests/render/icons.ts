import type { SKRSContext2D } from "@napi-rs/canvas";
import type { QuestId } from "../definitions";

/**
 * أيقونات بسيطة مرسومة بالكود (بدون ملفات خارجية) لكل مهمة.
 * كل دالة ترسم داخل دائرة مركزها (cx, cy) ونصف قطرها r، بلون moonlight.
 */
type IconFn = (ctx: SKRSContext2D, cx: number, cy: number, r: number, color: string) => void;

function ring(ctx: SKRSContext2D, cx: number, cy: number, r: number) {
  ctx.fillStyle = "#12151a";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

const mention: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  ctx.fillStyle = color;
  const w = r * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55, cy - w * 0.18);
  ctx.lineTo(cx + w * 0.05, cy - w * 0.42);
  ctx.lineTo(cx + w * 0.05, cy + w * 0.42);
  ctx.lineTo(cx - w * 0.55, cy + w * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - w * 0.62, cy - w * 0.18, w * 0.12, w * 0.36);
  ctx.beginPath();
  ctx.arc(cx + w * 0.08, cy, w * 0.42, -0.5, 0.5);
  ctx.strokeStyle = color;
  ctx.lineWidth = w * 0.1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.42, cy + w * 0.18);
  ctx.quadraticCurveTo(cx - w * 0.38, cy + w * 0.55, cx - w * 0.15, cy + w * 0.6);
  ctx.lineWidth = w * 0.12;
  ctx.strokeStyle = color;
  ctx.stroke();
};

const reply: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.85;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w * 0.16;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.45, cy - w * 0.35);
  ctx.lineTo(cx - w * 0.15, cy - w * 0.35);
  ctx.quadraticCurveTo(cx - w * 0.55, cy - w * 0.35, cx - w * 0.55, cy + w * 0.05);
  ctx.lineTo(cx - w * 0.55, cy + w * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55, cy + w * 0.55);
  ctx.lineTo(cx - w * 0.22, cy + w * 0.22);
  ctx.lineTo(cx - w * 0.55, cy - w * 0.1);
  ctx.closePath();
  ctx.fill();
};

const media: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.95;
  ctx.fillStyle = color;
  const rectW = w * 1.0;
  const rectH = w * 0.72;
  const x = cx - rectW / 2;
  const y = cy - rectH / 2 + w * 0.06;
  const rr = w * 0.1;
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + rectW, y, x + rectW, y + rectH, rr);
  ctx.arcTo(x + rectW, y + rectH, x, y + rectH, rr);
  ctx.arcTo(x, y + rectH, x, y, rr);
  ctx.arcTo(x, y, x + rectW, y, rr);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(cx - w * 0.16, y - w * 0.16, w * 0.32, w * 0.16);
  ctx.fillStyle = "#12151a";
  ctx.beginPath();
  ctx.arc(cx, cy + w * 0.06, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy + w * 0.06, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
};

const reactions: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.95;
  ctx.fillStyle = color;
  const top = cy - w * 0.15;
  ctx.beginPath();
  ctx.moveTo(cx, top + w * 0.55);
  ctx.bezierCurveTo(cx - w * 0.65, top, cx - w * 0.35, top - w * 0.55, cx, top - w * 0.05);
  ctx.bezierCurveTo(cx + w * 0.35, top - w * 0.55, cx + w * 0.65, top, cx, top + w * 0.55);
  ctx.closePath();
  ctx.fill();
};

const counting: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.85;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * 0.13;
  ctx.lineCap = "round";
  for (const dx of [-w * 0.18, w * 0.18]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, cy - w * 0.5);
    ctx.lineTo(cx + dx, cy + w * 0.5);
    ctx.stroke();
  }
  for (const dy of [-w * 0.18, w * 0.18]) {
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.5, cy + dy);
    ctx.lineTo(cx + w * 0.5, cy + dy);
    ctx.stroke();
  }
};

const messages: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.95;
  const rectW = w * 1.05;
  const rectH = w * 0.72;
  const x = cx - rectW / 2;
  const y = cy - rectH / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, rectW, rectH, w * 0.08);
  ctx.fill();
  ctx.strokeStyle = "#12151a";
  ctx.lineWidth = w * 0.07;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(cx, cy + rectH * 0.12);
  ctx.lineTo(x + rectW, y);
  ctx.stroke();
};

const meow: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy + w * 0.06, w * 0.55, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * w * 0.42, cy - w * 0.28);
    ctx.lineTo(cx + s * w * 0.62, cy - w * 0.72);
    ctx.lineTo(cx + s * w * 0.18, cy - w * 0.38);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = "#12151a";
  ctx.beginPath();
  ctx.arc(cx - w * 0.2, cy, w * 0.07, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.2, cy, w * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#12151a";
  ctx.lineWidth = w * 0.06;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy + w * 0.12);
  ctx.quadraticCurveTo(cx - w * 0.14, cy + w * 0.3, cx - w * 0.28, cy + w * 0.16);
  ctx.moveTo(cx, cy + w * 0.12);
  ctx.quadraticCurveTo(cx + w * 0.14, cy + w * 0.3, cx + w * 0.28, cy + w * 0.16);
  ctx.stroke();
};

const emojis: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.95;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = w * 0.1;
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx - w * 0.18, cy - w * 0.1, w * 0.06, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.18, cy - w * 0.1, w * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy + w * 0.02, w * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
};

const stickers: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.95;
  const rectW = w * 1.15;
  const rectH = w * 0.62;
  const x = cx - rectW / 2;
  const y = cy - rectH / 2;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, rectW, rectH, w * 0.12);
  ctx.fill();
  ctx.fillStyle = "#12151a";
  ctx.beginPath();
  ctx.arc(x, cy, w * 0.1, 0, Math.PI * 2);
  ctx.arc(x + rectW, cy, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#12151a";
  ctx.lineWidth = w * 0.045;
  ctx.setLineDash([w * 0.06, w * 0.06]);
  ctx.beginPath();
  ctx.moveTo(cx, y + w * 0.1);
  ctx.lineTo(cx, y + rectH - w * 0.1);
  ctx.stroke();
  ctx.setLineDash([]);
};

const voice: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = w * 0.16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy - w * 0.05, w * 0.5, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(cx + s * w * 0.5 - w * 0.14, cy + w * 0.05, w * 0.28, w * 0.42, w * 0.1);
    ctx.fill();
  }
};

export const trophy: IconFn = (ctx, cx, cy, r, color) => {
  ring(ctx, cx, cy, r);
  const w = r * 0.9;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.35, cy - w * 0.45, w * 0.7, w * 0.5, w * 0.06);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = w * 0.09;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + s * w * 0.35, cy - w * 0.3, w * 0.18, s > 0 ? -0.6 : Math.PI - 2.5, s > 0 ? 2.5 : 0.6);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy + w * 0.05);
  ctx.lineTo(cx, cy + w * 0.28);
  ctx.lineWidth = w * 0.12;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(cx - w * 0.28, cy + w * 0.28, w * 0.56, w * 0.14, w * 0.05);
  ctx.fill();
};

export const QUEST_ICONS: Record<QuestId, IconFn> = {
  mention,
  reply,
  media,
  reactions,
  counting,
  messages,
  meow,
  emojis,
  stickers,
  voice,
};

/** لون مميز لكل مهمة (حلقة الدائرة ولون الأيقونة) */
export const QUEST_COLORS: Record<QuestId, string> = {
  mention: "#f87171",
  reply: "#38bdf8",
  media: "#c084fc",
  reactions: "#60a5fa",
  counting: "#fbbf24",
  messages: "#34d399",
  meow: "#f472b6",
  emojis: "#facc15",
  stickers: "#f87171",
  voice: "#4ade80",
};
