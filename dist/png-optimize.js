import initOxi, { optimise } from './vendor/oxipng/codec/pkg/squoosh_oxipng.js';
import decodePng from './vendor/png/decode.js';

const MAX_PIXELS = 24_000_000;
const text = new TextDecoder();
function pngInfo(buffer) {
  const bytes = new Uint8Array(buffer), view = new DataView(buffer);
  if (bytes.length < 33 || ![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) throw new Error('This file is not a valid PNG.');
  const chunks = new Map();
  let p = 8, end = false;
  while (p + 12 <= bytes.length) {
    const size = view.getUint32(p), type = text.decode(bytes.subarray(p+4,p+8));
    if (p + size + 12 > bytes.length) throw new Error('This PNG is incomplete or damaged.');
    if (!chunks.has(type)) chunks.set(type, bytes.slice(p+8,p+8+size));
    p += size + 12;
    if (type === 'IEND') { end = true; break; }
  }
  const header = chunks.get('IHDR');
  if (!end || !header || header.length !== 13 || !chunks.has('IDAT')) throw new Error('This PNG is incomplete or damaged.');
  if (chunks.has('acTL')) throw new Error('Animated PNGs are not supported yet. Your original is unchanged.');
  const h = new DataView(header.buffer), width = h.getUint32(0), height = h.getUint32(4);
  if (!width || !height || width * height > MAX_PIXELS) throw new Error('This image exceeds the 24-megapixel limit. Your original is unchanged.');
  return { chunks, width, height, bitDepth: header[8] };
}
function equalPixels(a,b) {
  if (a.width !== b.width || a.height !== b.height || a.data.length !== b.data.length) return false;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) return false;
  return true;
}
export async function optimizePng(buffer) {
    const info = pngInfo(buffer);
    await initOxi();
    const optimized = optimise(new Uint8Array(buffer), 3, false, false);
    let result = optimized.byteLength < buffer.byteLength ? optimized.buffer : buffer;
    if (result !== buffer) {
      const opts = { bitDepth: info.bitDepth === 16 ? 16 : 8 };
      const before = await decodePng(buffer, opts), after = await decodePng(result, opts);
      if (!equalPixels(before, after)) result = buffer;
    }
    return {buffer:result,width:info.width,height:info.height};
}
