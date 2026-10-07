import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";
import { ELEMENT_MAP } from "./elements";
import { TEMP } from "./compounds";

const WIDTH = 480;
const HEIGHT = 520;

function tempColor(temp: number): string {
  const ratio = Math.min(1, Math.max(0, (temp - TEMP.min) / (TEMP.max - TEMP.min)));
  const hue = 220 - ratio * 220;
  return `hsl(${hue}, 85%, 55%)`;
}

function drawFlask(ctx: SKRSContext2D, mix: Record<string, number>, temp: number, pressure: number) {
  const cx = WIDTH / 2;
  const neckTop = 60;
  const neckBottom = 180;
  const bulbCenterY = 300;
  const bulbRadius = 130;

  ctx.beginPath();
  ctx.moveTo(cx - 22, neckTop);
  ctx.lineTo(cx - 22, neckBottom);
  ctx.lineTo(cx - bulbRadius * 0.85, bulbCenterY - bulbRadius * 0.4);
  ctx.arc(cx, bulbCenterY, bulbRadius, Math.PI * 0.78, Math.PI * 0.22, false);
  ctx.lineTo(cx + 22, neckBottom);
  ctx.lineTo(cx + 22, neckTop);
  ctx.closePath();

  ctx.save();
  ctx.clip();

  const fillTopY = bulbCenterY + bulbRadius - 40 - pressure * 8;
  const liquidColor = tempColor(temp);
  const grad = ctx.createLinearGradient(0, fillTopY, 0, bulbCenterY + bulbRadius);
  grad.addColorStop(0, liquidColor);
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, fillTopY, WIDTH, HEIGHT - fillTopY);

  const bubbleCount = Math.round(pressure * 1.8);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (let i = 0; i < bubbleCount; i++) {
    const bx = cx + (((i * 37) % (bulbRadius * 1.4)) - bulbRadius * 0.7);
    const by = fillTopY + 20 + ((i * 53) % Math.max(20, HEIGHT - fillTopY - 30));
    const r = 3 + (i % 3) * 2;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  ctx.lineWidth = 5;
  ctx.strokeStyle = "#e2e8f0";
  ctx.stroke();

  ctx.fillStyle = "#64748b";
  ctx.fillRect(cx - 26, neckTop - 14, 52, 16);

  const ids = Object.keys(mix).filter((id) => mix[id] > 0);
  ctx.font = "28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ids.slice(0, 8).forEach((id, i) => {
    const icon = ELEMENT_MAP[id]?.icon ?? "✨";
    const angle = (i / Math.max(1, ids.length)) * Math.PI * 2 - Math.PI / 2;
    const ix = cx + Math.cos(angle) * 40;
    const iy = neckTop - 40 + Math.sin(angle) * 14;
    ctx.fillText(icon, ix, iy);
  });
}

export async function renderFlask(mix: Record<string, number>, temp: number, pressure: number): Promise<Buffer | null> {
  if (!ensureFontsRegistered()) return null;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bg.addColorStop(0, "#1e293b");
  bg.addColorStop(1, "#0b1220");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawFlask(ctx, mix, temp, pressure);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f8fafc";
  ctx.font = `700 26px "${FONT_BOLD}"`;
  ctx.fillText(`🌡️ ${temp}°`, WIDTH / 2 - 90, HEIGHT - 24);
  ctx.fillText(`💨 ${pressure}`, WIDTH / 2 + 90, HEIGHT - 24);

  return canvas.encode("png");
}
