import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

type Badge = { label: string; color: string };

export interface CardMember {
  name: string;
  avatar?: string;
  badge: Badge;
  title: string;
  salary: number;
  active: boolean;
}

export interface CompanyCardData {
  name: string;
  ownerName: string;
  createdAt: string;
  budget: number;
  payroll: number;
  memberCount: number;
  payrollIn: string;
  logo?: Buffer | null;
  members: CardMember[];
  me: { badge: Badge; title: string; salary: number; penalty: number; shiftReady: boolean; shiftIn: string };
}

const W = 1000;
const PAD = 36;

const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

const avatarCache = new Map<string, { img: Image | null; at: number }>();
async function avatar(url?: string): Promise<Image | null> {
  if (!url) return null;
  const hit = avatarCache.get(url);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.img;
  const img = await Promise.race([loadImage(url).catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  avatarCache.set(url, { img, at: Date.now() });
  return img;
}

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

function drawAvatar(ctx: SKRSContext2D, img: Image | null, cx: number, cy: number, r: number, fallback: string, letter: string, family: string): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
  else {
    ctx.fillStyle = fallback;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${Math.round(r)}px "${family}"`;
    ctx.fillText(letter, cx, cy);
  }
  ctx.restore();
}

/** بطاقة الشركة (PNG). ترجع null لو تعذّر الرسم */
export async function renderCompanyCard(d: CompanyCardData): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const rows = d.members.length;
    const extra = d.memberCount - rows;
    const H = 560 + rows * 72 + (extra > 0 ? 44 : 0);
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    const imgs = await Promise.all(d.members.map((m) => avatar(m.avatar)));

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

    // شعار + اسم
    const logoImg = d.logo ? await loadImage(Buffer.from(d.logo)).catch(() => null) : null;
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(W - PAD - 56, 90, 56, 0, Math.PI * 2);
    ctx.fill();
    if (logoImg) {
      drawAvatar(ctx, logoImg, W - PAD - 56, 90, 56, "#3b82f6", "", family);
    } else {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 56px "${family}"`;
      ctx.fillText([...d.name][0] ?? "؟", W - PAD - 56, 92);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    fit(ctx, d.name, family, 54, 600);
    ctx.fillText(d.name, W - PAD - 132, 72);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText(`المالك: ${d.ownerName}  •  تأسست ${d.createdAt}`, W - PAD - 132, 120);

    const role = d.me.badge;
    ctx.fillStyle = role.color;
    rr(ctx, PAD, 62, 170, 46, 23);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText(role.label, PAD + 85, 86);

    // البطاقات
    const tiles = [
      { label: "الميزانية", value: fmt(d.budget), color: "#22c55e" },
      { label: "رواتب اليوم", value: fmt(d.payroll), color: "#f59e0b" },
      { label: "الأعضاء", value: String(d.memberCount), color: "#3b82f6" },
      { label: "الرواتب بعد", value: d.payrollIn, color: "#a855f7" },
    ];
    const tw = (W - PAD * 2 - 16 * 3) / 4;
    tiles.forEach((t, i) => {
      const x = W - PAD - tw * (i + 1) - 16 * i;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      rr(ctx, x, 170, tw, 112, 18);
      ctx.fill();
      ctx.fillStyle = t.color;
      rr(ctx, x + 14, 170, tw - 28, 6, 3);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 19px "${family}"`;
      ctx.fillText(t.label, x + tw - 18, 208);
      ctx.fillStyle = "#f8fafc";
      fit(ctx, t.value, family, 38, tw - 36);
      ctx.fillText(t.value, x + tw - 18, 252);
    });

    // تغطية الرواتب
    const ratio = d.payroll > 0 ? Math.min(1, d.budget / d.payroll) : 1;
    const barColor = ratio >= 1 ? "#22c55e" : ratio >= 0.5 ? "#f59e0b" : "#ef4444";
    ctx.textAlign = "right";
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText("تغطية الرواتب من الميزانية", W - PAD, 318);
    ctx.textAlign = "left";
    ctx.fillStyle = barColor;
    ctx.fillText(d.payroll > 0 ? `${Math.round(ratio * 100)}%` : "لا رواتب", PAD, 318);
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    rr(ctx, PAD, 336, W - PAD * 2, 18, 9);
    ctx.fill();
    const bw = Math.max(18, (W - PAD * 2) * ratio);
    ctx.fillStyle = barColor;
    rr(ctx, W - PAD - bw, 336, bw, 18, 9);
    ctx.fill();

    // أنت
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    rr(ctx, PAD, 378, W - PAD * 2, 92, 20);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    fit(ctx, `أنت: ${d.me.title}`, family, 30, 560);
    ctx.fillText(`أنت: ${d.me.title}`, W - PAD - 24, 412);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 20px "${family}"`;
    ctx.fillText(`راتبك اليومي: ${fmt(d.me.salary)}${d.me.penalty > 0 ? `  •  خصم قادم: ${fmt(d.me.penalty)}` : ""}`, W - PAD - 24, 448);
    ctx.fillStyle = d.me.shiftReady ? "#22c55e" : "#475569";
    rr(ctx, PAD + 20, 400, 250, 46, 23);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `700 21px "${family}"`;
    ctx.fillText(d.me.shiftReady ? "الدوام جاهز" : `الدوام بعد ${d.me.shiftIn}`, PAD + 145, 424);

    // الفريق
    ctx.textAlign = "right";
    ctx.fillStyle = "#e2e8f0";
    ctx.font = `700 28px "${family}"`;
    ctx.fillText("الموظفين", W - PAD, 510);

    d.members.forEach((m, i) => {
      const y = 540 + i * 72;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      rr(ctx, PAD, y, W - PAD * 2, 64, 16);
      ctx.fill();
      const r = m.badge;
      drawAvatar(ctx, imgs[i], W - PAD - 40, y + 32, 24, r.color, [...m.name][0] ?? "؟", family);
      ctx.textBaseline = "middle";
      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      fit(ctx, m.name, family, 24, 330);
      ctx.fillText(m.name, W - PAD - 76, y + 24);
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 18px "${family}"`;
      ctx.fillText(m.title, W - PAD - 76, y + 47);

      ctx.fillStyle = r.color;
      rr(ctx, 400, y + 16, 96, 32, 16);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 18px "${family}"`;
      ctx.fillText(r.label, 448, y + 33);

      ctx.fillStyle = m.active ? "#22c55e" : "#475569";
      ctx.beginPath();
      ctx.arc(330, y + 32, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = m.active ? "#86efac" : "#94a3b8";
      ctx.font = `700 18px "${family}"`;
      ctx.fillText(m.active ? "داوم" : "لم يداوم", 316, y + 33);

      ctx.fillStyle = "#fbbf24";
      ctx.textAlign = "left";
      ctx.font = `700 26px "${family}"`;
      ctx.fillText(fmt(m.salary), PAD + 22, y + 33);
    });

    if (extra > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 20px "${family}"`;
      ctx.fillText(`+ ${extra} أعضاء آخرين`, W / 2, 540 + rows * 72 + 20);
    }
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/** يصغّر الصورة لمربع 256 (قص من المنتصف) ويرجعها JPEG للتخزين */
export async function makeLogo(buf: Buffer): Promise<Buffer | null> {
  try {
    const img = await loadImage(buf);
    const s = Math.min(img.width, img.height);
    if (!s) return null;
    const canvas = createCanvas(256, 256);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
    return await canvas.encode("jpeg", 85);
  } catch {
    return null;
  }
}
