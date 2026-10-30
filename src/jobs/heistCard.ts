import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { ensureFontsRegistered, FONT_BOLD } from "../quests/render/fonts";

const W = 1000;
const PAD = 36;
const fmt = (n: number): string => Math.round(n).toLocaleString("en-US");

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(0, w), h, r);
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
  while (s > 14 && ctx.measureText(text).width > maxW) {
    s -= 2;
    ctx.font = `700 ${s}px "${family}"`;
  }
}

function pill(ctx: SKRSContext2D, cx: number, cy: number, w: number, color: string, text: string, family: string): void {
  ctx.fillStyle = color;
  rr(ctx, cx - w / 2, cy - 20, w, 40, 20);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  fit(ctx, text, family, 21, w - 12);
  ctx.fillText(text, cx, cy + 1);
}

/* ───────────────── بطاقة الفريق (الإعداد + الدعوات) ───────────────── */

export interface RosterRow {
  name: string;
  role: string | null;
  pct: number | null;
  /** none = بدون حالة (وقت الإعداد) */
  status: "wait" | "yes" | "no" | "none";
  current?: boolean;
}

export async function renderHeistRoster(title: string, sub: string, rows: RosterRow[]): Promise<Buffer | null> {
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
    ctx.fillText(title, W - PAD, 66);
    ctx.fillStyle = "#94a3b8";
    fit(ctx, sub, family, 21, W - PAD * 2);
    ctx.fillText(sub, W - PAD, 112);

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    rr(ctx, PAD, 146, W - PAD * 2, 52, 16);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = `700 21px "${family}"`;
    ctx.textAlign = "right";
    ctx.fillText("الاسم", W - PAD - 24, 172);
    ctx.textAlign = "center";
    ctx.fillText("الدور", 520, 172);
    ctx.fillText("النسبة", 320, 172);
    ctx.fillText("الحالة", 150, 172);

    rows.forEach((r, i) => {
      const y = 214 + i * 84;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
      rr(ctx, PAD, y, W - PAD * 2, 72, 18);
      ctx.fill();
      if (r.current) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 3;
        rr(ctx, PAD + 1, y + 1, W - PAD * 2 - 2, 70, 18);
        ctx.stroke();
      }
      ctx.textAlign = "right";
      ctx.fillStyle = "#f8fafc";
      fit(ctx, r.name, family, 30, 340);
      ctx.fillText(r.name, W - PAD - 24, y + 36);

      ctx.textAlign = "center";
      ctx.fillStyle = r.role ? "#e2e8f0" : "#64748b";
      fit(ctx, r.role ?? "—", family, 28, 200);
      ctx.fillText(r.role ?? "—", 520, y + 36);

      ctx.fillStyle = r.pct !== null ? "#fbbf24" : "#64748b";
      ctx.font = `700 32px "${family}"`;
      ctx.fillText(r.pct !== null ? `${r.pct}%` : "—", 320, y + 36);

      if (r.status === "yes") pill(ctx, 150, y + 36, 140, "#16a34a", "وافق", family);
      else if (r.status === "wait") pill(ctx, 150, y + 36, 140, "#b45309", "ينتظر", family);
      else if (r.status === "no") pill(ctx, 150, y + 36, 140, "#b91c1c", "رفض", family);
    });
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/* ───────────────── اللوحة الحية (استعداد / خزنة / هروب) ───────────────── */

export interface BoardData {
  phase: "prep" | "vault" | "escape";
  leftMs: number;
  totalMs: number;
  boxes: { state: "pending" | "open" | "fail"; amount: number }[];
  boxIdx: number;
  code: string;
  typed: string;
  loot: number;
  misses: number;
  missPct: number;
  cam: { alert: boolean; leftMs: number };
  thr: { alert: boolean; leftMs: number };
  esc: { step: number; order: string[]; car: string };
  names: { hacker: string; threat: string; driver: string };
  log: string;
}

export async function renderHeistBoard(d: BoardData): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const H = 610;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    bg(ctx, H, "rgba(239,68,68,0.12)");

    // العنوان
    ctx.textAlign = "right";
    ctx.fillStyle = "#f8fafc";
    ctx.font = `700 46px "${family}"`;
    ctx.fillText("سطو البنك", W - PAD, 58);
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 22px "${family}"`;
    ctx.fillText(d.phase === "prep" ? "استعدوا..." : d.phase === "vault" ? "الحرامي يفتح الصناديق" : "اهربوا! السائق يشغّل السيارة", W - PAD, 104);

    // المؤقت
    const secs = Math.max(0, Math.ceil(d.leftMs / 1000));
    ctx.textAlign = "left";
    ctx.fillStyle = secs <= 8 && d.phase !== "prep" ? "#f87171" : "#fbbf24";
    ctx.font = `700 56px "${family}"`;
    ctx.fillText(`${secs}ث`, PAD + 4, 62);
    const frac = Math.max(0, Math.min(1, d.leftMs / d.totalMs));
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    rr(ctx, PAD, 134, W - PAD * 2, 14, 7);
    ctx.fill();
    if (frac > 0.01) {
      ctx.fillStyle = frac > 0.4 ? "#22c55e" : frac > 0.2 ? "#f59e0b" : "#ef4444";
      rr(ctx, PAD, 134, (W - PAD * 2) * frac, 14, 7);
      ctx.fill();
    }

    // اللوحة الرئيسية
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, PAD, 168, W - PAD * 2, 168, 24);
    ctx.fill();

    if (d.phase === "prep") {
      ctx.textAlign = "center";
      ctx.fillStyle = "#f8fafc";
      ctx.font = `700 54px "${family}"`;
      ctx.fillText(`تبدأ بعد ${secs}`, W / 2, 232);
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 22px "${family}"`;
      ctx.fillText("كل واحد يجهز زره حسب دوره", W / 2, 290);
    } else if (d.phase === "vault") {
      const done = d.boxIdx >= d.boxes.length;
      ctx.textAlign = "right";
      ctx.fillStyle = "#cbd5e1";
      ctx.font = `700 26px "${family}"`;
      ctx.fillText(done ? "خلصت الصناديق" : `صندوق ${d.boxIdx + 1} / ${d.boxes.length}`, W - PAD - 28, 202);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`الغنيمة: ${fmt(d.loot)}`, PAD + 28, 202);
      const size = 96;
      const gap = 18;
      const x0 = (W - (size * 4 + gap * 3)) / 2;
      for (let k = 0; k < 4; k++) {
        const typed = k < d.typed.length;
        ctx.fillStyle = typed ? "#16a34a" : "rgba(255,255,255,0.12)";
        rr(ctx, x0 + k * (size + gap), 224, size, size - 6, 18);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = `700 64px "${family}"`;
        ctx.fillText(done ? "-" : (d.code[k] ?? "-"), x0 + k * (size + gap) + size / 2, 224 + (size - 6) / 2 + 2);
      }
    } else {
      ctx.textAlign = "center";
      const cw = 270;
      d.esc.order.forEach((label, k) => {
        const x = W - PAD - 28 - cw / 2 - k * (cw + 18);
        const ok = k < d.esc.step;
        const cur = k === d.esc.step;
        ctx.fillStyle = ok ? "#16a34a" : "rgba(255,255,255,0.1)";
        rr(ctx, x - cw / 2, 206, cw, 84, 20);
        ctx.fill();
        if (cur) {
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 4;
          rr(ctx, x - cw / 2 + 2, 208, cw - 4, 80, 20);
          ctx.stroke();
        }
        ctx.fillStyle = "#fff";
        fit(ctx, `${k + 1}. ${label}`, family, 30, cw - 20);
        ctx.fillText(`${k + 1}. ${label}`, x, 249);
      });
      ctx.fillStyle = "#94a3b8";
      ctx.font = `700 22px "${family}"`;
      ctx.fillText(`السيارة: ${d.esc.car} — اضغط الأزرار بالترتيب`, W / 2, 312);
    }

    // شبكة الصناديق
    const bw = 84;
    d.boxes.forEach((b, k) => {
      const x = W - PAD - bw - k * (bw + 8);
      const y = 356;
      const cur = d.phase === "vault" && k === d.boxIdx;
      ctx.fillStyle = b.state === "open" ? "#16a34a" : b.state === "fail" ? "#b91c1c" : "rgba(255,255,255,0.08)";
      rr(ctx, x, y, bw, 70, 14);
      ctx.fill();
      if (cur) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 4;
        rr(ctx, x + 2, y + 2, bw - 4, 66, 14);
        ctx.stroke();
      }
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      if (b.state === "open") {
        ctx.font = `700 26px "${family}"`;
        ctx.fillText(String(b.amount), x + bw / 2, y + 36);
      } else if (b.state === "fail") {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x + 28, y + 22);
        ctx.lineTo(x + bw - 28, y + 48);
        ctx.moveTo(x + bw - 28, y + 22);
        ctx.lineTo(x + 28, y + 48);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.font = `700 26px "${family}"`;
        ctx.fillText(String(k + 1), x + bw / 2, y + 36);
      }
    });

    // الكاميرا + المهدد (أو السائق في الهروب)
    const py = 448;
    if (d.phase === "escape") {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      rr(ctx, PAD, py, W - PAD * 2, 64, 20);
      ctx.fill();
      ctx.textAlign = "right";
      ctx.fillStyle = "#e2e8f0";
      ctx.font = `700 24px "${family}"`;
      ctx.fillText(`السائق: ${d.names.driver}`, W - PAD - 24, py + 33);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(`الغنيمة: ${fmt(d.loot)}`, PAD + 24, py + 33);
    } else {
      const pw = 452;
      const panel = (x: number, alert: boolean, role: string, who: string, status: string) => {
        ctx.fillStyle = alert ? "#b91c1c" : "rgba(34,197,94,0.16)";
        rr(ctx, x, py, pw, 70, 20);
        ctx.fill();
        ctx.textAlign = "right";
        ctx.fillStyle = "#e2e8f0";
        fit(ctx, `${role}: ${who}`, family, 19, pw - 40);
        ctx.fillText(`${role}: ${who}`, x + pw - 20, py + 23);
        ctx.fillStyle = "#fff";
        fit(ctx, status, family, 26, pw - 40);
        ctx.fillText(status, x + pw - 20, py + 51);
      };
      panel(W - PAD - pw, d.cam.alert, "الهكر", d.names.hacker, d.cam.alert ? `عطّل الكاميرا الحين! ${Math.max(1, Math.ceil(d.cam.leftMs / 1000))}ث` : "الكاميرا شغالة وما انتبهت");
      const thrStatus = d.thr.alert ? `هدّد المواطن! ${Math.max(1, Math.ceil(d.thr.leftMs / 1000))}ث` : d.misses > 0 ? `المواطن اتصل بالشرطة (−${d.missPct}%)` : "المواطن ساكت";
      panel(PAD, d.thr.alert, "المهدد", d.names.threat, thrStatus);
    }

    // آخر حدث
    if (d.log) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#e2e8f0";
      fit(ctx, d.log, family, 24, W - PAD * 2);
      ctx.fillText(d.log, W / 2, 566);
    }
    return await canvas.encode("png");
  } catch {
    return null;
  }
}

/* ───────────────── النتيجة ───────────────── */

export interface ResultRow {
  name: string;
  role: string;
  pct: number;
  amount: number;
}

export async function renderHeistResult(
  kind: "success" | "caught",
  d: { total: number; misses: number; missPct: number; reason: string; jail: string; rows: ResultRow[] },
): Promise<Buffer | null> {
  try {
    const family = ensureFontsRegistered() ? FONT_BOLD : "sans-serif";
    const ok = kind === "success";
    const H = ok ? 350 + d.rows.length * 76 : 360;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "middle";
    const accent = ok ? "#22c55e" : "#ef4444";
    bg(ctx, H, ok ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)");

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
    ctx.fillText(ok ? "نجح السطو!" : "انمسكتوا!", W - 230, 98);
    ctx.fillStyle = "#94a3b8";
    fit(ctx, ok ? "سطو البنك" : d.reason, family, 24, 640);
    ctx.fillText(ok ? "سطو البنك" : d.reason, W - 230, 146);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    rr(ctx, PAD, 216, W - PAD * 2, 108, 24);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#94a3b8";
    ctx.font = `700 24px "${family}"`;
    ctx.fillText(ok ? "إجمالي الغنيمة" : "العقوبة", W - PAD - 28, ok && d.misses > 0 ? 252 : 270);
    if (ok && d.misses > 0) {
      ctx.fillStyle = "#fca5a5";
      ctx.font = `700 22px "${family}"`;
      ctx.fillText(`خصم المواطن −${d.missPct}%`, W - PAD - 28, 292);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = accent;
    if (ok) {
      ctx.font = `700 64px "${family}"`;
      ctx.fillText(`+${fmt(d.total)}`, PAD + 32, 268);
    } else {
      ctx.font = `700 34px "${family}"`;
      ctx.fillText(`سجن ${d.jail} للكل`, PAD + 32, 268);
    }

    if (ok) {
      d.rows.forEach((r, i) => {
        const y = 342 + i * 76;
        ctx.fillStyle = i % 2 === 0 ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)";
        rr(ctx, PAD, y, W - PAD * 2, 66, 18);
        ctx.fill();
        ctx.textAlign = "right";
        ctx.fillStyle = "#f8fafc";
        fit(ctx, r.name, family, 28, 360);
        ctx.fillText(r.name, W - PAD - 24, y + 33);
        ctx.textAlign = "center";
        ctx.fillStyle = "#cbd5e1";
        ctx.font = `700 24px "${family}"`;
        ctx.fillText(`${r.role} • ${r.pct}%`, 470, y + 33);
        ctx.textAlign = "left";
        ctx.fillStyle = "#22c55e";
        ctx.font = `700 32px "${family}"`;
        ctx.fillText(`+${fmt(r.amount)}`, PAD + 28, y + 33);
      });
    }
    return await canvas.encode("png");
  } catch {
    return null;
  }
}
