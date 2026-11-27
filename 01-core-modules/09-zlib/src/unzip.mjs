import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Fungsi bantu untuk menjalankan pipeline dekompresi dan mengumpulkan seluruh output stream
async function streamDecompress(stream, decompressor) {
  const chunks = [];
  await pipeline(stream, decompressor, async function* (source) {
    for await (const chunk of source) {
      chunks.push(chunk);
    }
  });
  return Buffer.concat(chunks).toString();
}

// Normal: createInflate untuk Deflate murni dan createUnzip untuk Deflate/Gzip otomatis
const sampleText = 'Universal decompression with createUnzip';

// 1. Kompresi stream Deflate
const deflateChunks = [];
await pipeline(
  Readable.from(sampleText),
  zlib.createDeflate(),
  async function* (source) {
    for await (const chunk of source) deflateChunks.push(chunk);
  },
);
const deflatedBuffer = Buffer.concat(deflateChunks);

// 2. Kompresi stream Gzip
const gzipChunks = [];
await pipeline(
  Readable.from(sampleText),
  zlib.createGzip(),
  async function* (source) {
    for await (const chunk of source) gzipChunks.push(chunk);
  },
);
const gzippedBuffer = Buffer.concat(gzipChunks);

const fromInflate = await streamDecompress(
  Readable.from(deflatedBuffer),
  zlib.createInflate(),
);
const fromDeflateUnzip = await streamDecompress(
  Readable.from(deflatedBuffer),
  zlib.createUnzip(),
);
const fromGzipUnzip = await streamDecompress(
  Readable.from(gzippedBuffer),
  zlib.createUnzip(),
);

console.log('Decompressed via createInflate:', fromInflate);
console.log('Decompressed Deflate via createUnzip:', fromDeflateUnzip);
console.log('Decompressed Gzip via createUnzip:', fromGzipUnzip);

// Edge-case: stream dengan header tidak valid dialirkan ke createUnzip
try {
  await streamDecompress(
    Readable.from(Buffer.from('not-a-valid-archive-header')),
    zlib.createUnzip(),
  );
} catch (err) {
  console.log('Auto-unzip error code:', err.code);
}
