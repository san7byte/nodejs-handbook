import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Fungsi bantu untuk membaca seluruh output stream hasil dekompresi
async function streamDecompress(stream) {
  const chunks = [];
  await pipeline(stream, zlib.createUnzip(), async function* (source) {
    for await (const chunk of source) {
      chunks.push(chunk);
    }
  });
  return Buffer.concat(chunks).toString();
}

// Normal: createUnzip mendekompresi stream Deflate dan Gzip secara transparan
const sampleText = 'Universal decompression with createUnzip';

// 1. Kompresi Deflate
const deflateChunks = [];
await pipeline(
  Readable.from(sampleText),
  zlib.createDeflate(),
  async function* (source) {
    for await (const chunk of source) deflateChunks.push(chunk);
  }
);
const deflatedBuffer = Buffer.concat(deflateChunks);

// 2. Kompresi Gzip
const gzipChunks = [];
await pipeline(
  Readable.from(sampleText),
  zlib.createGzip(),
  async function* (source) {
    for await (const chunk of source) gzipChunks.push(chunk);
  }
);
const gzippedBuffer = Buffer.concat(gzipChunks);

const fromDeflate = await streamDecompress(Readable.from(deflatedBuffer));
const fromGzip = await streamDecompress(Readable.from(gzippedBuffer));

console.log('Decompressed from Deflate:', fromDeflate);
console.log('Decompressed from Gzip:', fromGzip);

// Edge-case: stream dengan header tidak valid dialirkan ke createUnzip
try {
  await streamDecompress(Readable.from(Buffer.from('not-a-valid-archive-header')));
} catch (err) {
  console.log('Auto-unzip error code:', err.code);
}
