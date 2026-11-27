import zlib from 'node:zlib';
import { promisify } from 'node:util';

const deflate = promisify(zlib.deflate);
const inflate = promisify(zlib.inflate);
const gzip = promisify(zlib.gzip);

// Normal: kompresi dan dekompresi dengan algoritma Deflate serta perbandingan overhead Gzip
const sourceText = 'Node.js compression '.repeat(5);
const sourceBuffer = Buffer.from(sourceText);

const deflated = await deflate(sourceBuffer, { level: 6 });
const gzipped = await gzip(sourceBuffer, { level: 6 });
const inflated = await inflate(deflated);

console.log('Original bytes:', sourceBuffer.length);
console.log('Deflate bytes:', deflated.length);
console.log('Gzip bytes:', gzipped.length);
console.log('Inflated matches:', inflated.toString() === sourceText);

// Edge-case: tangani buffer Deflate yang rusak atau tidak valid
try {
  await inflate(Buffer.from('invalid-deflate-data'));
} catch (err) {
  console.log('Invalid deflate error code:', err.code);
}
