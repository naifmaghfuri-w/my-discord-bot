import { logger } from "../utils/logger";

const W = 720;
const H = 250;

/**
 * يرسم مشهد الصيد: ماء + ظل السمكة + شريطين (التقدم والتوتر).
 * بدون أي نصوص (فما يحتاج خطوط). لو فشل الرسم يرجع null وتظهر الأشرطة النصية بدلها.
 */
export async function renderFishing(tension: number, progress: number): Promise<Buffer | null> {
  try {
    const { createCanvas } = await import("@napi-rs/canvas");
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    // الماء
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#2aa7bd");
    bg.addColorStop(1, "#0b4a68");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // تموجات ثابتة
    ctx.strokeStyle = "rgba(255,255,255,0.13)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const x = (i * 97) % W;
      const y = 20 + ((i * 53) % 130);
      ctx.beginPath();
      ctx.arc(x, y, 18 + (i % 4) * 8, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }

    // ظل السمكة: يقترب من الضفة (يمين) كلما زاد التقدم
    const fx = 90 + (Math.max(0, Math.min(100, progress)) / 100) * (W - 260);
    const fy = 92;
    ctx.fillStyle = "rgba(6,28,44,0.55)";
    ctx.save();
    ctx.translate(fx, fy);
    ctx.scale(2.6, 1);
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(fx - 50, fy);
    ctx.lineTo(fx - 78, fy - 20);
    ctx.lineTo(fx - 78, fy + 20);
    ctx.closePath();
    ctx.fill();

    // لوحة الأشرطة
    ctx.fillStyle = "rgba(5,20,32,0.62)";
    ctx.beginPath();
    ctx.roundRect(14, H - 78, W - 28, 64, 16);
    ctx.fill();

    const barY = H - 52;
    const barH = 22;
    const barW = 318;
    const track = (x: number) => {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.roundRect(x, barY, barW, barH, 11);
      ctx.fill();
    };

    // التقدم (يسار)
    const px = 32;
    track(px);
    const pw = Math.max(0, (progress / 100) * barW);
    if (pw > 0) {
      const g = ctx.createLinearGradient(px, 0, px + barW, 0);
      g.addColorStop(0, "#35c9a4");
      g.addColorStop(1, "#7be8cf");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(px, barY, Math.max(pw, 14), barH, 11);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px + Math.max(7, pw), barY + barH / 2, 9, 0, Math.PI * 2);
    ctx.fill();

    // التوتر (يمين) مع منطقة الخطر المخططة في آخر 15%
    const tx = W - 32 - barW;
    track(tx);
    const dangerStart = tx + barW * 0.85;
    ctx.strokeStyle = "rgba(255,80,80,0.55)";
    ctx.lineWidth = 2;
    for (let x = dangerStart; x < tx + barW - 4; x += 7) {
      ctx.beginPath();
      ctx.moveTo(x, barY + barH - 3);
      ctx.lineTo(x + 8, barY + 3);
      ctx.stroke();
    }
    const tw = Math.max(0, (tension / 100) * barW);
    if (tw > 0) {
      ctx.fillStyle = tension >= 80 ? "#e74c3c" : tension >= 50 ? "#f1c40f" : "#35c9a4";
      ctx.beginPath();
      ctx.roundRect(tx, barY, Math.max(tw, 14), barH, 11);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(tx + Math.max(7, tw), barY + barH / 2, 9, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toBuffer("image/png");
  } catch (err) {
    logger.warn(`تعذّر رسم صورة الصيد، سيُستخدم النص بدلها: ${String(err)}`);
    return null;
  }
}
