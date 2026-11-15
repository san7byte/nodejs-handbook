import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Normal: menghubungkan Readable, Transform, dan Writable menggunakan pipeline
const source = Readable.from(['item-1\n', 'item-2\n', 'item-3\n']);

const prefixTransform = new Transform({
  transform(chunk, enc, cb) {
    cb(null, `[PREFIX] ${chunk}`);
  },
});

const output = [];
const destination = new Writable({
  write(chunk, enc, cb) {
    output.push(chunk.toString());
    cb();
  },
});

console.log('--- Normal Pipeline Execution ---');
await pipeline(source, prefixTransform, destination);
console.log('Pipeline finished successfully. Collected output:');
process.stdout.write(output.join(''));

// Edge-case: membatalkan stream yang sedang berjalan di tengah jalan via AbortSignal
console.log('--- Aborted Pipeline Execution ---');
async function* infiniteSource() {
  let count = 1;
  while (true) {
    yield `data-${count++}\n`;
    await new Promise((r) => setTimeout(r, 200));
  }
}

const abortingDestination = new Writable({
  write(chunk, enc, cb) {
    process.stdout.write('Received: ' + chunk);
    cb();
  },
});

try {
  // Batalkan pipeline secara otomatis setelah 150 milidetik
  await pipeline(infiniteSource, abortingDestination, {
    signal: AbortSignal.timeout(1000),
  });
} catch (err) {
  console.log('Pipeline aborted as expected with error name:', err.name);
}
