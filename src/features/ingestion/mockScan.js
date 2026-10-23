/* Mock-only: draws a small grayscale "scanned sheet" and encodes it as a real
 * PNG (stored deflate blocks, no compression library), so GET /pages/{id}/image/
 * answers image/png like apps.instances.views.PageImageView. */

const W = 124;
const H = 176;

let crcTable;
function crc32(bytes) {
  crcTable ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const x of bytes) {
    a = (a + x) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const u32 = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function chunk(type, data) {
  const head = [...type].map((ch) => ch.charCodeAt(0));
  return [...u32(data.length), ...head, ...data, ...u32(crc32([...head, ...data]))];
}

/** zlib stream made of stored (uncompressed) deflate blocks. */
function zlibStored(raw) {
  const out = [0x78, 0x01];
  for (let i = 0; i < raw.length; i += 65535) {
    const block = raw.subarray(i, i + 65535);
    const last = i + 65535 >= raw.length ? 1 : 0;
    out.push(last, block.length & 0xff, block.length >> 8, ~block.length & 0xff, (~block.length >> 8) & 0xff, ...block);
  }
  return [...out, ...u32(adler32(raw))];
}

/** Gray value of pixel (x, y): header box, QR-like corner mark, a few answer lines. */
function pixel(x, y, seed) {
  if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) return 236; // scanner margin
  if (x >= W - 30 && x < W - 10 && y >= 10 && y < 30) return ((x * 7 + y * 13 + seed) >> 2) % 3 ? 40 : 250; // QR block
  if (y >= 12 && y < 16 && x >= 12 && x < 70) return 90; // title
  if (y >= 20 && y < 22 && x >= 12 && x < 52) return 150; // name field
  const line = (y - 44) % 12;
  if (y >= 44 && y < H - 16 && line === 0 && x >= 12 && x < W - 12) return 200; // ruled lines
  if (y >= 44 && y < H - 16 && line >= 4 && line < 6) {
    const len = 30 + ((seed * 31 + Math.floor((y - 44) / 12) * 17) % 70);
    if (x >= 14 && x < 14 + len) return 70; // handwriting
  }
  return 252;
}

/** PNG bytes of a synthetic scan; `seed` varies the handwriting per page. */
export function mockScanPng(seed = 0) {
  const raw = new Uint8Array(H * (W + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W + 1)] = 0; // filter: none
    for (let x = 0; x < W; x++) raw[y * (W + 1) + 1 + x] = pixel(x, y, seed);
  }
  const ihdr = [...u32(W), ...u32(H), 8, 0, 0, 0, 0]; // 8-bit grayscale
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', ihdr), ...chunk('IDAT', zlibStored(raw)), ...chunk('IEND', [])]);
}
