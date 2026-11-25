import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Normal: kompresi dan dekompresi data buffer
const sourceText = 'Fast and scalable backend systems with Node.js';
const sourceBuffer = Buffer.from(sourceText);

const compressed = await gzip(sourceBuffer, { level: 6 });
const decompressed = await gunzip(compressed);

console.log('Original bytes:', sourceBuffer.length);
console.log('Compressed bytes:', compressed.length);
console.log('Decompressed text:', decompressed.toString());

// Edge-case: penanganan buffer terkompresi yang rusak atau tidak valid
const corruptedBuffer = Buffer.from('not-a-valid-gzip-stream');
try {
  await gunzip(corruptedBuffer);
} catch (err) {
  console.log('Corrupted data error code:', err.code);
}
