/**
 * مشفّر GIF بسيط بدون أي مكتبة خارجية.
 * - لوحة ألوان ثابتة 252 لون (6×7×6) مع تنعيم Bayer لتقليل التدرج المتقطع
 * - يشتغل مرة واحدة (بدون امتداد التكرار)
 */
export interface GifFrame {
  /** بيانات RGBA بطول width*height*4 */
  rgba: Uint8Array | Uint8ClampedArray;
  /** مدة الإطار بالمللي ثانية */
  delayMs: number;
}

const R_LEVELS = 6;
const G_LEVELS = 7;
const B_LEVELS = 6;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function buildPalette(): Uint8Array {
  const pal = new Uint8Array(256 * 3);
  for (let r = 0; r < R_LEVELS; r++) {
    for (let g = 0; g < G_LEVELS; g++) {
      for (let b = 0; b < B_LEVELS; b++) {
        const i = (r * G_LEVELS * B_LEVELS + g * B_LEVELS + b) * 3;
        pal[i] = Math.round((r * 255) / (R_LEVELS - 1));
        pal[i + 1] = Math.round((g * 255) / (G_LEVELS - 1));
        pal[i + 2] = Math.round((b * 255) / (B_LEVELS - 1));
      }
    }
  }
  return pal;
}

function quantize(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  const stepR = 255 / (R_LEVELS - 1);
  const stepG = 255 / (G_LEVELS - 1);
  const stepB = 255 / (B_LEVELS - 1);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const t = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5; // -0.5..0.5
      const r = Math.min(R_LEVELS - 1, Math.max(0, Math.round(rgba[p] / stepR + t * 0.9)));
      const g = Math.min(G_LEVELS - 1, Math.max(0, Math.round(rgba[p + 1] / stepG + t * 0.9)));
      const b = Math.min(B_LEVELS - 1, Math.max(0, Math.round(rgba[p + 2] / stepB + t * 0.9)));
      out[y * w + x] = r * G_LEVELS * B_LEVELS + g * B_LEVELS + b;
    }
  }
  return out;
}

class ByteSink {
  private chunks: number[] = [];
  push(...b: number[]) {
    for (const x of b) this.chunks.push(x & 255);
  }
  word(v: number) {
    this.push(v & 255, (v >> 8) & 255);
  }
  bytes(arr: ArrayLike<number>) {
    for (let i = 0; i < arr.length; i++) this.chunks.push(arr[i]);
  }
  toBuffer(): Buffer {
    return Buffer.from(this.chunks);
  }
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): number[] {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  const out: number[] = [];
  let bitBuf = 0;
  let bitCount = 0;
  let codeSize = minCodeSize + 1;
  let next = eoi + 1;
  let dict = new Map<number, number>();

  const write = (code: number) => {
    bitBuf |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      out.push(bitBuf & 255);
      bitBuf >>>= 8;
      bitCount -= 8;
    }
  };

  write(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (prefix << 8) | k; // prefix < 4096 → مفتاح فريد
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    write(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next - 1 === 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      write(clear);
      dict = new Map();
      codeSize = minCodeSize + 1;
      next = eoi + 1;
    }
    prefix = k;
  }
  write(prefix);
  write(eoi);
  if (bitCount > 0) out.push(bitBuf & 255);
  return out;
}

export function encodeGif(frames: GifFrame[], width: number, height: number): Buffer {
  const s = new ByteSink();
  const palette = buildPalette();

  s.bytes(Buffer.from("GIF89a", "ascii"));
  s.word(width);
  s.word(height);
  s.push(0xf7, 0, 0); // جدول ألوان عام 256
  s.bytes(palette);

  for (const frame of frames) {
    // Graphic Control Extension
    s.push(0x21, 0xf9, 4, 0x00);
    s.word(Math.max(2, Math.round(frame.delayMs / 10)));
    s.push(0, 0);

    // Image Descriptor
    s.push(0x2c);
    s.word(0);
    s.word(0);
    s.word(width);
    s.word(height);
    s.push(0);

    const indices = quantize(frame.rgba, width, height);
    s.push(8);
    const data = lzwEncode(indices, 8);
    for (let i = 0; i < data.length; i += 255) {
      const len = Math.min(255, data.length - i);
      s.push(len);
      for (let j = 0; j < len; j++) s.push(data[i + j]);
    }
    s.push(0);
  }
  s.push(0x3b);
  return s.toBuffer();
}
