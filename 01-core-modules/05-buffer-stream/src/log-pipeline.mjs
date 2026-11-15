import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Data simulasi log transaksi NDJSON berukuran besar
const sampleLogs = [
  '{"id":"TX-101","action":"LOGIN","token":"secret-auth-token-123","amount":0}\n',
  '{"id":"TX-102","action":"PAYMENT","cardNumber":"4111222233334444","amount":150000}\n',
  '{"id":"TX-103","action":"LOGOUT","token":"secret-token-456","amount":0}\n',
];

// Transform stream untuk parsing per baris dan masking data sensitif (PII) on-the-fly
class LogSanitizerStream extends Transform {
  constructor(options = {}) {
    super({ ...options, objectMode: false });
    this._buffer = '';
  }

  _transform(chunk, encoding, callback) {
    // Normal: kumpulkan chunk teks untuk menangani potongan baris antar chunk
    this._buffer += chunk.toString('utf8');
    const lines = this._buffer.split('\n');

    // Sisakan baris terakhir yang belum lengkap di buffer
    this._buffer = lines.pop();

    for (const line of lines) {
      if (line.trim()) {
        try {
          const entry = JSON.parse(line);

          // Masking token otorisasi
          if (entry.token) {
            entry.token = '***REDACTED***';
          }
          // Masking nomor kartu kredit (hanya sisakan 4 digit awal dan akhir)
          if (entry.cardNumber) {
            const num = String(entry.cardNumber);
            entry.cardNumber = num.slice(0, 4) + '********' + num.slice(-4);
          }

          this.push(JSON.stringify(entry) + '\n');
        } catch (err) {
          // Edge-case: baris NDJSON tidak valid dilaporkan via callback error
          return callback(new Error(`Invalid NDJSON line: ${err.message}`));
        }
      }
    }
    callback();
  }

  _flush(callback) {
    // Edge-case: proses sisa data terakhir jika tidak diakhiri newline
    if (this._buffer.trim()) {
      try {
        const entry = JSON.parse(this._buffer);
        if (entry.token) entry.token = '***REDACTED***';
        this.push(JSON.stringify(entry) + '\n');
      } catch (err) {
        return callback(new Error(`Invalid NDJSON tail: ${err.message}`));
      }
    }
    callback();
  }
}

const source = Readable.from(sampleLogs);
const sanitizer = new LogSanitizerStream();
const collectedLogs = [];

const destination = new Writable({
  write(chunk, encoding, callback) {
    collectedLogs.push(chunk.toString('utf8'));
    callback();
  },
});

console.log('--- Processing Ingestion Pipeline ---');
await pipeline(source, sanitizer, destination, {
  signal: AbortSignal.timeout(3000),
});
process.stdout.write(collectedLogs.join(''));
