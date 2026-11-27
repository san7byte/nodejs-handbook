import zlib from 'node:zlib';
import { promisify } from 'node:util';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);

// Normal: kompresi rasio tinggi menggunakan mode teks Brotli
const payload =
  'Node.js handbook explains Brotli compression parameters '.repeat(10);
const inputBuffer = Buffer.from(payload);

const compressed = await brotliCompress(inputBuffer, {
  params: {
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]:
      zlib.constants.BROTLI_DEFAULT_QUALITY,
  },
});
const decompressed = await brotliDecompress(compressed);

console.log('Original length:', inputBuffer.length);
console.log('Brotli compressed length:', compressed.length);
console.log('Restored text matches:', decompressed.toString() === payload);

// Edge-case: perlindungan zip-bomb menggunakan batas memori maxOutputLength
try {
  await brotliDecompress(compressed, { maxOutputLength: 100 });
} catch (err) {
  console.log('Zip-bomb safeguard triggered:', err.code);
}
