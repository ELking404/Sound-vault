import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer: (width * 4 + 1) * height bytes
  const stride = width * 4;
  const rawData = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (stride + 1);
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pixelOffset] = r;
      rawData[pixelOffset + 1] = g;
      rawData[pixelOffset + 2] = b;
      rawData[pixelOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(len + 12);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.subarray(4, len + 8));
  chunk.writeUInt32BE(crc >>> 0, len + 8);
  return chunk;
}

// Simple CRC32 table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff);
}

// Icon Drawer: Rounded badge with Indigo theme and download arrow + music wave
function iconDrawer(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.sqrt(dx * dx + dy * dy);

  // Background circle / rounded rect
  const maxR = w * 0.44;
  if (r > maxR) {
    return [2, 6, 23, 0]; // Transparent outer
  }

  // Gradient background: Indigo to Violet (#4f46e5 to #7c3aed)
  const t = (x + y) / (w + h);
  const bgR = Math.floor(79 + (124 - 79) * t);
  const bgG = Math.floor(70 + (58 - 70) * t);
  const bgB = Math.floor(229 + (237 - 229) * t);

  // Center Arrow Symbol (Arrow pointing down into a bracket)
  const normX = (x - cx) / (w * 0.5);
  const normY = (y - cy) / (h * 0.5);

  // Arrow stem: vertical bar from y = -0.35 to 0.1
  const inStem = Math.abs(normX) <= 0.08 && normY >= -0.4 && normY <= 0.05;
  // Arrow head: triangle pointing down from y = -0.05 to 0.25
  const inHead = normY >= 0.0 && normY <= 0.28 && Math.abs(normX) <= (0.28 - normY) * 1.0;
  // Tray bar: horizontal bar at y = 0.35 with lips at ends
  const inTray = (normY >= 0.32 && normY <= 0.42 && Math.abs(normX) <= 0.4) ||
                 (normY >= 0.22 && normY <= 0.42 && (Math.abs(normX) >= 0.32 && Math.abs(normX) <= 0.42));

  if (inStem || inHead || inTray) {
    return [255, 255, 255, 255]; // Pure White icon
  }

  return [bgR, bgG, bgB, 255];
}

// Maskable Drawer: Full bleed background with 15% safe margin
function maskableDrawer(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const t = (x + y) / (w + h);
  const bgR = Math.floor(79 + (124 - 79) * t);
  const bgG = Math.floor(70 + (58 - 70) * t);
  const bgB = Math.floor(229 + (237 - 229) * t);

  const normX = (x - cx) / (w * 0.4);
  const normY = (y - cy) / (h * 0.4);

  const inStem = Math.abs(normX) <= 0.08 && normY >= -0.4 && normY <= 0.05;
  const inHead = normY >= 0.0 && normY <= 0.28 && Math.abs(normX) <= (0.28 - normY) * 1.0;
  const inTray = (normY >= 0.32 && normY <= 0.42 && Math.abs(normX) <= 0.4) ||
                 (normY >= 0.22 && normY <= 0.42 && (Math.abs(normX) >= 0.32 && Math.abs(normX) <= 0.42));

  if (inStem || inHead || inTray) {
    return [255, 255, 255, 255];
  }

  return [bgR, bgG, bgB, 255];
}

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/icon-192.png', createPng(192, 192, iconDrawer));
fs.writeFileSync('public/icon-512.png', createPng(512, 512, iconDrawer));
fs.writeFileSync('public/icon-maskable-512.png', createPng(512, 512, maskableDrawer));
console.log('Successfully generated public/icon-192.png, public/icon-512.png, and public/icon-maskable-512.png');
