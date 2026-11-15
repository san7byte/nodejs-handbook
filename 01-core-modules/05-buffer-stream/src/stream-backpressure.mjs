import { Readable, Writable } from 'node:stream';

// Normal: membuat Readable stream dari generator asinkron via Readable.from
async function* generateData() {
  yield 'chunk-A\n';
  yield 'chunk-B\n';
}

const readable = Readable.from(generateData());
console.log('--- Reading from Readable Stream ---');
for await (const chunk of readable) {
  process.stdout.write('Read: ' + chunk);
}

// Normal: membuat Writable kustom dengan batas buffer kecil (highWaterMark) untuk memantau backpressure
console.log('--- Writing with Backpressure Management ---');
const received = [];
const writer = new Writable({
  highWaterMark: 16, // Kapasitas buffer internal 16 byte
  write(chunk, encoding, callback) {
    received.push(chunk.toString());
    // Simulasi jeda pemrosesan asinkron ke I/O
    setTimeout(callback, 20);
  },
});

function writeSafely(data) {
  return new Promise((resolve) => {
    const canContinue = writer.write(data);
    if (!canContinue) {
      console.log(
        'Backpressure triggered: buffer full, waiting for drain event...',
      );
      writer.once('drain', () => {
        console.log('Drain event received: buffer cleared, resuming writes');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

await writeSafely('A'.repeat(20)); // Melebihi highWaterMark 16 byte
await writeSafely('B'.repeat(10));

// Normal: menutup writable stream secara bersih dengan end()
await new Promise((resolve) => writer.end(resolve));
console.log('Total written chunks received:', received.length);
console.log(received); // ['AA...', 'BB...']

// Edge-case: menulis data setelah stream ditutup memicu error ERR_STREAM_WRITE_AFTER_END
await new Promise((resolve) => {
  writer.write('C', (err) => {
    console.log('Write after end error caught:', err?.code);
    resolve();
  });
});
