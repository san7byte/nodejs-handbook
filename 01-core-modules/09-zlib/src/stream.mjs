import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Normal: alirkan data chunk melalui createGzip dan createGunzip
const sourceChunks = ['Stream chunk 1 | ', 'Stream chunk 2 | ', 'Stream chunk 3'];
const outputChunks = [];

await pipeline(
  Readable.from(sourceChunks),
  zlib.createGzip({ level: 6 }),
  zlib.createGunzip(),
  async function* (source) {
    for await (const chunk of source) {
      outputChunks.push(chunk.toString());
    }
  }
);

console.log('Streamed result:', outputChunks.join(''));

// Edge-case: penanganan error pipeline saat stream menerima chunk data rusak
const corruptSource = [Buffer.from([0x1f, 0x8b, 0xff, 0xff])];
try {
  await pipeline(
    Readable.from(corruptSource),
    zlib.createGunzip(),
    async function* (source) {
      for await (const chunk of source) {
        // Abaikan pemrosesan
      }
    }
  );
} catch (err) {
  console.log('Pipeline error caught:', err.code);
}
