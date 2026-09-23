import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { join } from "node:path";
import { FONT_BOLD, FONT_REGULAR, ensureFontsRegistered } from "./fonts";
import { QUEST_COLORS, QUEST_ICONS, trophy } from "./icons";
import type { QuestId } from "../definitions";

const WIDTH = 920;
const HEIGHT = 260;
const ASSETS = join(__dirname, "..", "..", "assets", "currency");

let jennyImg: Image | null = null;
let xpImg: Image | null = null;

async function getCurrencyImages() {
  if (!jennyImg) jennyImg = await loadImage(join(ASSETS, "jenny.png"));
  if (!xpImg) xpImg = await loadImage(join(ASSETS, "xp.png"));
  return { jennyImg, xpImg };
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** خلفية داكنة متدرّجة بلمسة دخان بسيطة، مولّدة بالكامل بالكود */
function drawBackground(ctx: SKRSContext2D, accent: string) {
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, "#161b22");
  grad.addColorStop(1, "#0b0f14");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // لمسات دخان خفيفة (دوائر شفافة كبيرة)
  const blobs: [number, number, number][] = [
    [WIDTH * 0.15, HEIGHT * 0.3, 180],
    [WIDTH * 0.5, HEIGHT * 0.8, 220],
    [WIDTH * 0.85, HEIGHT * 0.2, 200],
  ];
  for (const [bx, by, br] of blobs) {
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, "rgba(255,255,255,0.035)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // توهج خفيف بلون العنصر أعلى يمين البطاقة (خلف الدائرة)
  const glow = ctx.createRadialGradient(WIDTH - 130, HEIGHT / 2, 0, WIDTH - 130, HEIGHT / 2, 170);
  glow.addColorStop(0, `${accent}33`);
  glow.addColorStop(1, `${accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(WIDTH - 320, 0, 320, HEIGHT);
}

function drawPill(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  image: Image,
  value: number,
  borderColor: string,
) {
  const h = 46;
  const text = value.toLocaleString("en-US");
  ctx.font = `700 24px "${FONT_BOLD}"`;
  const textW = ctx.measureText(text).width;
  const w = h + 18 + textW + 18;

  ctx.fillStyle = "#0d1117";
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.stroke();

  const iconSize = h - 6;
  const iconAspect = image.width / image.height;
  const iconW = iconSize * iconAspect;
  ctx.drawImage(image, x + 3, y + 3, iconW, iconSize);

  ctx.fillStyle = "#f5f5f5";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 3 + iconW + 10, y + h / 2 + 1);

  return w;
}

export interface QuestCardOptions {
  title: string;
  description: string;
  coins: number;
  xp: number;
  icon: QuestId | "trophy";
  badgeText?: string;
}

/** يولّد صورة بطاقة إنجاز مهمة (920x260 PNG). يرجع null إذا الخط العربي غير مسجّل بعد. */
export async function renderQuestCard(opts: QuestCardOptions): Promise<Buffer | null> {
  if (!ensureFontsRegistered()) return null;

  const accent =
    opts.icon === "trophy" ? "#fbbf24" : QUEST_COLORS[opts.icon];
  const iconFn = opts.icon === "trophy" ? trophy : QUEST_ICONS[opts.icon];

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // البطاقة بحواف دائرية
  roundRect(ctx, 0, 0, WIDTH, HEIGHT, 22);
  ctx.save();
  ctx.clip();
  drawBackground(ctx, accent);
  ctx.restore();

  // إطار أخضر (لون النجاح)
  roundRect(ctx, 2, 2, WIDTH - 4, HEIGHT - 4, 20);
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 3;
  ctx.stroke();

  // شارة "اكتملت بنجاح"
  ctx.font = `700 20px "${FONT_BOLD}"`;
  ctx.fillStyle = "#4ade80";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(opts.badgeText ?? "اكتملت بنجاح", 34, 30);

  // الدائرة + الأيقونة (أقصى اليمين)
  const cx = WIDTH - 110;
  const cy = HEIGHT / 2;
  const radius = 62;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  iconFn(ctx, cx, cy, radius, accent);

  // العنوان والوصف (محاذاة يمين لأنه عربي)
  const rightEdge = cx - radius - 34;
  ctx.textAlign = "right";
  ctx.fillStyle = "#f8fafc";
  ctx.font = `800 34px "${FONT_BOLD}"`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.title, rightEdge, 98);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = `400 22px "${FONT_REGULAR}"`;
  ctx.fillText(opts.description, rightEdge, 132);

  // شارتا المكافأة (يسار البطاقة)
  const { jennyImg, xpImg } = await getCurrencyImages();
  let x = 34;
  const y = HEIGHT - 46 - 34;
  x += drawPill(ctx, x, y, jennyImg, opts.coins, "#eab308") + 14;
  drawPill(ctx, x, y, xpImg, opts.xp, "#38bdf8");

  return canvas.encode("png");
}
