import { deflateSync } from 'zlib';

const W = 1080;
const H = 560;
const BG = [11, 15, 12];
const GOLD = [201, 168, 76];
const EMERALD = [26, 107, 74];
const INK = [237, 230, 214];
const MUTED = [138, 143, 134];

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}

function encodePng(pixels: Buffer, w: number, h: number): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const dest = y * (w * 3 + 1);
    raw[dest] = 0;
    pixels.copy(raw, dest + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function px(buf: Buffer, x: number, y: number, rgb: number[]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = rgb[0];
  buf[i + 1] = rgb[1];
  buf[i + 2] = rgb[2];
}

function fill(buf: Buffer, x: number, y: number, w: number, h: number, rgb: number[]) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) px(buf, xx, yy, rgb);
  }
}

function diamond(buf: Buffer, cx: number, cy: number, r: number, rgb: number[]) {
  for (let y = -r; y <= r; y++) {
    const span = r - Math.abs(y);
    for (let x = -span; x <= span; x++) px(buf, cx + x, cy + y, rgb);
  }
}

// 5x7 glyphs, bit rows
const G: Record<string, number[]> = {
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 2, 4, 8, 31],
  '3': [14, 17, 1, 6, 1, 17, 14],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 30, 17, 17, 17, 14],
  '7': [31, 1, 2, 4, 4, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 17, 14],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  K: [17, 18, 20, 24, 20, 18, 17],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  S: [14, 17, 16, 14, 1, 17, 14],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  '.': [0, 0, 0, 0, 0, 4, 4],
  ',': [0, 0, 0, 0, 0, 4, 8],
  ':': [0, 4, 4, 0, 4, 4, 0],
  ' ': [0, 0, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0],
  '#': [10, 31, 10, 31, 10, 0, 0],
};

function glyph(buf: Buffer, ch: string, x: number, y: number, s: number, rgb: number[]) {
  const rows = G[ch] || G[' '];
  for (let gy = 0; gy < 7; gy++) {
    for (let gx = 0; gx < 5; gx++) {
      if (rows[gy] & (16 >> gx)) fill(buf, x + gx * s, y + gy * s, s, s, rgb);
    }
  }
}

function text(buf: Buffer, str: string, x: number, y: number, s: number, rgb: number[]) {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    glyph(buf, ch, cx, y, s, rgb);
    cx += 6 * s;
  }
}

export function renderHeroPng(kind: 'vault' | 'locked' | 'settled', d: {
  hero: string;
  sub?: string;
  meta?: string;
}): Buffer {
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < buf.length; i += 3) {
    buf[i] = BG[0]; buf[i + 1] = BG[1]; buf[i + 2] = BG[2];
  }
  fill(buf, 0, 0, 8, H, EMERALD);
  diamond(buf, 72, 72, 22, GOLD);
  text(buf, 'CT', 110, 50, 5, INK);
  const tag = kind === 'vault' ? 'VAULT' : kind === 'locked' ? 'LOCKED' : 'SETTLED';
  text(buf, tag, 110, 92, 2, MUTED);
  fill(buf, 48, 140, W - 96, 2, EMERALD);
  text(buf, d.hero.replace(/,/g, ''), 48, 200, 10, GOLD);
  if (d.sub) text(buf, d.sub.replace(/,/g, ''), 48, 310, 4, INK);
  if (d.meta) text(buf, d.meta.replace(/,/g, ''), 48, 460, 3, MUTED);
  return encodePng(buf, W, H);
}
