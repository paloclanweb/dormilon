/**
 * Genera los iconos de Dormilón (luna creciente y dos estrellas) sin dependencias.
 * Uso: npm run icons  →  escribe los PNG en assets/.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'assets');
const MOON = [0xf4, 0xc9, 0x79];
const SKY_TOP = [0x1d, 0x24, 0x3f];
const SKY_BOTTOM = [0x0c, 0x0e, 0x13];

// Diseño en unidades: el centro es (0, 0) y todo cabe en un círculo de radio 0.5.
const OUTER = { x: 0.03, y: 0.03, r: 0.36 };
const CUT = { x: 0.2, y: -0.13, r: 0.3 };
const STARS = [
  { x: 0.2, y: -0.25, r: 0.06 },
  { x: 0.36, y: -0.06, r: 0.035 },
];

// --- PNG ------------------------------------------------------------------

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // sin filtro
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Dibujo ---------------------------------------------------------------

const inCircle = (x, y, c) => (x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r;
const inMoon = (x, y) => inCircle(x, y, OUTER) && !inCircle(x, y, CUT);
/** Estrella de cuatro puntas (astroide). */
const inStar = (x, y, s) => {
  const dx = Math.abs(x - s.x);
  const dy = Math.abs(y - s.y);
  if (dx > s.r || dy > s.r) return false;
  return dx ** (2 / 3) + dy ** (2 / 3) <= s.r ** (2 / 3);
};

const SAMPLES = 4; // 4 × 4 muestras por píxel para suavizar los bordes

function render(size, { scale, background, color = MOON }) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let moon = 0;
      let star = 0;
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const x = ((px + (sx + 0.5) / SAMPLES) / size - 0.5) / scale;
          const y = ((py + (sy + 0.5) / SAMPLES) / size - 0.5) / scale;
          if (inMoon(x, y)) moon++;
          else if (STARS.some((s) => inStar(x, y, s))) star++;
        }
      }
      const total = SAMPLES * SAMPLES;
      const coverage = (moon + star * 0.85) / total;

      let [r, g, b, a] = [0, 0, 0, 0];
      if (background) {
        const t = py / (size - 1);
        [r, g, b] = SKY_TOP.map((top, i) => Math.round(top + (SKY_BOTTOM[i] - top) * t));
        a = 255;
      }
      const i = (py * size + px) * 4;
      if (a === 255) {
        pixels[i] = Math.round(r + (color[0] - r) * coverage);
        pixels[i + 1] = Math.round(g + (color[1] - g) * coverage);
        pixels[i + 2] = Math.round(b + (color[2] - b) * coverage);
        pixels[i + 3] = 255;
      } else {
        pixels[i] = color[0];
        pixels[i + 1] = color[1];
        pixels[i + 2] = color[2];
        pixels[i + 3] = Math.round(255 * coverage);
      }
    }
  }
  return encodePng(size, pixels);
}

const outputs = [
  // Icono clásico (y el de la tienda): cielo de noche a sangre
  { file: 'icon.png', size: 1024, scale: 0.78, background: true },
  // Icono adaptable: la luna dentro de la zona segura (66/108 del lienzo)
  { file: 'adaptive-icon.png', size: 1024, scale: 0.58 },
  // Iconos temáticos de Android 13+: solo la forma, el sistema la colorea
  { file: 'adaptive-icon-monochrome.png', size: 1024, scale: 0.58, color: [255, 255, 255] },
  { file: 'splash-icon.png', size: 1024, scale: 0.9 },
];

for (const output of outputs) {
  fs.writeFileSync(path.join(OUT, output.file), render(output.size, output));
  console.log(`assets/${output.file}`);
}
