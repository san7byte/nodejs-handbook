// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gzipSync = zlib.gzipSync;
const gunzip = promisify(zlib.gunzip);
const deflateSync = zlib.deflateSync;
const brotliCompressSync = zlib.brotliCompressSync;
const brotliDecompress = promisify(zlib.brotliDecompress);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper timeout untuk mencegah loop tak terbatas
function withTimeout(promise, ms = 2000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Test timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Helper untuk memverifikasi error
function assertError(err, ExpectedErrorClass, expectedMessage) {
  if (!err) {
    throw new Error(`Expected error [${ExpectedErrorClass.name}: ${expectedMessage}], but nothing was thrown`);
  }
  if (err.message === 'Not implemented') {
    throw new Error('Stub belum diimplementasikan (Error: Not implemented)');
  }
  if (!(err instanceof ExpectedErrorClass) && err.name !== ExpectedErrorClass.name) {
    throw new Error(`Expected error type ${ExpectedErrorClass.name}, received ${err.constructor.name || err.name} (${err.message})`);
  }
  if (err.message !== expectedMessage) {
    throw new Error(`Expected error message "${expectedMessage}", received "${err.message}"`);
  }
}

// Cari file soal berdasarkan prefix
function findQuestionFile(questionNum) {
  const files = fs.readdirSync(__dirname);
  const prefix = questionNum.padStart(2, '0');
  const matched = files.find((f) => f.startsWith(`${prefix}-`) && (f.endsWith('.mjs') || f.endsWith('.js')));
  return matched ? path.join(__dirname, matched) : null;
}

// Runner Soal 01
async function testQuestion01() {
  console.log('\n--- Soal 01: Asynchronous Payload Compressor ---');
  const filePath = findQuestionFile('01');
  if (!filePath) {
    console.log('  [FAIL] File soal 01 tidak ditemukan');
    return { passed: 0, failed: 11 };
  }

  let mod;
  try {
    mod = await import(pathToFileURL(filePath).href);
  } catch (err) {
    console.log(`  [FAIL] Gagal mengimpor file soal 01: ${err.message}`);
    return { passed: 0, failed: 11 };
  }

  const { compressPayload } = mod;
  if (typeof compressPayload !== 'function') {
    console.log('  [FAIL] Export compressPayload tidak ditemukan');
    return { passed: 0, failed: 11 };
  }

  const tests = [
    {
      name: 'Normal 1: compress string "Hello World"',
      fn: async () => {
        const res = await compressPayload('Hello World');
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        const decomp = await gunzip(res);
        if (decomp.toString() !== 'Hello World') throw new Error('Decompressed data mismatch');
      },
    },
    {
      name: 'Normal 2: compress Buffer.from("Binary content")',
      fn: async () => {
        const input = Buffer.from('Binary content');
        const res = await compressPayload(input);
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        const decomp = await gunzip(res);
        if (decomp.toString() !== 'Binary content') throw new Error('Decompressed data mismatch');
      },
    },
    {
      name: 'Normal 3: compress with custom level 9',
      fn: async () => {
        const res = await compressPayload('Configured level text', { level: 9 });
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        const decomp = await gunzip(res);
        if (decomp.toString() !== 'Configured level text') throw new Error('Decompressed data mismatch');
      },
    },
    {
      name: 'Edge 1: compress with empty options fallback to default level 6',
      fn: async () => {
        const res = await compressPayload('Default level fallback', {});
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        const decomp = await gunzip(res);
        if (decomp.toString() !== 'Default level fallback') throw new Error('Decompressed data mismatch');
      },
    },
    {
      name: 'Error 1: number input throws TypeError',
      fn: async () => {
        let thrown;
        try {
          await compressPayload(12345);
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, TypeError, 'Input must be a string or Buffer');
      },
    },
    {
      name: 'Error 2: null input throws TypeError',
      fn: async () => {
        let thrown;
        try {
          await compressPayload(null);
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, TypeError, 'Input must be a string or Buffer');
      },
    },
    {
      name: 'Error 3: empty string throws Error',
      fn: async () => {
        let thrown;
        try {
          await compressPayload('');
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Data cannot be empty');
      },
    },
    {
      name: 'Error 4: empty Buffer throws Error',
      fn: async () => {
        let thrown;
        try {
          await compressPayload(Buffer.alloc(0));
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Data cannot be empty');
      },
    },
    {
      name: 'Error 5: level 10 throws RangeError',
      fn: async () => {
        let thrown;
        try {
          await compressPayload('Data', { level: 10 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, RangeError, 'Invalid compression level');
      },
    },
    {
      name: 'Error 6: level 0 throws RangeError',
      fn: async () => {
        let thrown;
        try {
          await compressPayload('Data', { level: 0 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, RangeError, 'Invalid compression level');
      },
    },
    {
      name: 'Error 7: non-integer level 4.5 throws RangeError',
      fn: async () => {
        let thrown;
        try {
          await compressPayload('Data', { level: 4.5 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, RangeError, 'Invalid compression level');
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await withTimeout(t.fn());
      console.log(`  [PASS] ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`  [FAIL] ${t.name} - ${err.message}`);
      failed++;
    }
  }

  console.log(`Soal 01: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Runner Soal 02
async function testQuestion02() {
  console.log('\n--- Soal 02: Safe Multi-Format Decompressor with Zip-Bomb Protection ---');
  const filePath = findQuestionFile('02');
  if (!filePath) {
    console.log('  [FAIL] File soal 02 tidak ditemukan');
    return { passed: 0, failed: 11 };
  }

  let mod;
  try {
    mod = await import(pathToFileURL(filePath).href);
  } catch (err) {
    console.log(`  [FAIL] Gagal mengimpor file soal 02: ${err.message}`);
    return { passed: 0, failed: 11 };
  }

  const { safeDecompress } = mod;
  if (typeof safeDecompress !== 'function') {
    console.log('  [FAIL] Export safeDecompress tidak ditemukan');
    return { passed: 0, failed: 11 };
  }

  const sampleGzip = gzipSync('Gzip decompressed content');
  const sampleDeflate = deflateSync('Deflate decompressed content');
  const largePayloadGzip = gzipSync('Z'.repeat(1000));
  const exact25Gzip = gzipSync('A'.repeat(25));

  const tests = [
    {
      name: 'Normal 1: decompress Gzip buffer',
      fn: async () => {
        const res = await safeDecompress(sampleGzip);
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        if (res.toString() !== 'Gzip decompressed content') throw new Error('Decompressed text mismatch');
      },
    },
    {
      name: 'Normal 2: decompress Deflate buffer',
      fn: async () => {
        const res = await safeDecompress(sampleDeflate);
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        if (res.toString() !== 'Deflate decompressed content') throw new Error('Decompressed text mismatch');
      },
    },
    {
      name: 'Normal 3: decompress within safe maxBytes limit',
      fn: async () => {
        const res = await safeDecompress(sampleGzip, { maxBytes: 500 });
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        if (res.toString() !== 'Gzip decompressed content') throw new Error('Decompressed text mismatch');
      },
    },
    {
      name: 'Edge 1: decompress exactly at maxBytes limit boundary',
      fn: async () => {
        const res = await safeDecompress(exact25Gzip, { maxBytes: 25 });
        if (!Buffer.isBuffer(res)) throw new Error('Result must be a Buffer');
        if (res.length !== 25) throw new Error('Result length mismatch');
      },
    },
    {
      name: 'Error 1: string input throws TypeError',
      fn: async () => {
        let thrown;
        try {
          await safeDecompress('not-a-buffer');
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, TypeError, 'Input must be a Buffer');
      },
    },
    {
      name: 'Error 2: empty buffer throws Error',
      fn: async () => {
        let thrown;
        try {
          await safeDecompress(Buffer.alloc(0));
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Buffer cannot be empty');
      },
    },
    {
      name: 'Error 3: maxBytes 0 throws RangeError',
      fn: async () => {
        let thrown;
        try {
          await safeDecompress(sampleGzip, { maxBytes: 0 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, RangeError, 'maxBytes must be a positive integer');
      },
    },
    {
      name: 'Error 4: negative maxBytes throws RangeError',
      fn: async () => {
        let thrown;
        try {
          await safeDecompress(sampleGzip, { maxBytes: -10 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, RangeError, 'maxBytes must be a positive integer');
      },
    },
    {
      name: 'Error 5: non-number maxBytes string throws RangeError',
      fn: async () => {
        let thrown;
        try {
          await safeDecompress(sampleGzip, { maxBytes: '100' });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, RangeError, 'maxBytes must be a positive integer');
      },
    },
    {
      name: 'Error 6: output exceeding maxBytes throws Error',
      fn: async () => {
        let thrown;
        try {
          await safeDecompress(largePayloadGzip, { maxBytes: 50 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Decompressed size exceeds limit');
      },
    },
    {
      name: 'Error 7: corrupted compressed buffer throws Error',
      fn: async () => {
        let thrown;
        try {
          await safeDecompress(Buffer.from('corrupted-archive-header'));
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Corrupted or invalid compressed data');
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await withTimeout(t.fn());
      console.log(`  [PASS] ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`  [FAIL] ${t.name} - ${err.message}`);
      failed++;
    }
  }

  console.log(`Soal 02: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Runner Soal 03
async function testQuestion03() {
  console.log('\n--- Soal 03: Tamper-Evident Archive Packer with Native CRC32 Integrity ---');
  const filePath = findQuestionFile('03');
  if (!filePath) {
    console.log('  [FAIL] File soal 03 tidak ditemukan');
    return { passed: 0, failed: 14 };
  }

  let mod;
  try {
    mod = await import(pathToFileURL(filePath).href);
  } catch (err) {
    console.log(`  [FAIL] Gagal mengimpor file soal 03: ${err.message}`);
    return { passed: 0, failed: 14 };
  }

  const { ArchivePacker } = mod;
  if (!ArchivePacker || typeof ArchivePacker.pack !== 'function' || typeof ArchivePacker.unpack !== 'function') {
    console.log('  [FAIL] Export ArchivePacker dengan method pack dan unpack tidak ditemukan');
    return { passed: 0, failed: 14 };
  }

  // Siapkan paket referensi valid untuk pengujian unpack
  const rawGzipText = 'Archived JSON Data';
  const gzPayload = gzipSync(rawGzipText);
  const gzCrc = zlib.crc32(rawGzipText);
  const sampleGzipPacket = {
    algorithm: 'gzip',
    originalSize: Buffer.byteLength(rawGzipText),
    compressedSize: gzPayload.length,
    crc32: gzCrc,
    payload: gzPayload,
  };

  const rawBrotliText = 'High compression text';
  const brPayload = brotliCompressSync(rawBrotliText);
  const brCrc = zlib.crc32(rawBrotliText);
  const sampleBrotliPacket = {
    algorithm: 'brotli',
    originalSize: Buffer.byteLength(rawBrotliText),
    compressedSize: brPayload.length,
    crc32: brCrc,
    payload: brPayload,
  };

  const tests = [
    {
      name: 'Normal 1: pack string with gzip algorithm',
      fn: async () => {
        const packet = await ArchivePacker.pack('Archived JSON Data', 'gzip');
        if (!packet || typeof packet !== 'object') throw new Error('Result must be an object');
        if (packet.algorithm !== 'gzip') throw new Error('Algorithm must be "gzip"');
        if (packet.originalSize !== 18) throw new Error('originalSize mismatch');
        if (!Buffer.isBuffer(packet.payload)) throw new Error('Payload must be a Buffer');
        if (packet.compressedSize !== packet.payload.length) throw new Error('compressedSize mismatch');
        if (typeof packet.crc32 !== 'number') throw new Error('crc32 must be a number');
        const restored = await gunzip(packet.payload);
        if (restored.toString() !== 'Archived JSON Data') throw new Error('Payload decompression mismatch');
      },
    },
    {
      name: 'Normal 2: pack string with brotli algorithm',
      fn: async () => {
        const packet = await ArchivePacker.pack('High compression text', 'brotli');
        if (!packet || typeof packet !== 'object') throw new Error('Result must be an object');
        if (packet.algorithm !== 'brotli') throw new Error('Algorithm must be "brotli"');
        if (packet.originalSize !== 21) throw new Error('originalSize mismatch');
        if (!Buffer.isBuffer(packet.payload)) throw new Error('Payload must be a Buffer');
        if (packet.compressedSize !== packet.payload.length) throw new Error('compressedSize mismatch');
        const restored = await brotliDecompress(packet.payload);
        if (restored.toString() !== 'High compression text') throw new Error('Payload decompression mismatch');
      },
    },
    {
      name: 'Normal 3: unpack valid gzip packet',
      fn: async () => {
        const res = await ArchivePacker.unpack(sampleGzipPacket);
        if (!Buffer.isBuffer(res)) throw new Error('Unpack must return a Buffer');
        if (res.toString() !== rawGzipText) throw new Error('Unpack text mismatch');
      },
    },
    {
      name: 'Normal 4: unpack valid brotli packet',
      fn: async () => {
        const res = await ArchivePacker.unpack(sampleBrotliPacket);
        if (!Buffer.isBuffer(res)) throw new Error('Unpack must return a Buffer');
        if (res.toString() !== rawBrotliText) throw new Error('Unpack text mismatch');
      },
    },
    {
      name: 'Edge 1: pack binary Buffer with default algorithm fallback',
      fn: async () => {
        const binaryInput = Buffer.from([0x01, 0x02, 0x03]);
        const packet = await ArchivePacker.pack(binaryInput);
        if (packet.algorithm !== 'gzip') throw new Error('Default algorithm must be "gzip"');
        if (packet.originalSize !== 3) throw new Error('originalSize mismatch');
      },
    },
    {
      name: 'Error 1: pack number input throws TypeError',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.pack(12345);
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, TypeError, 'Data must be a string or Buffer');
      },
    },
    {
      name: 'Error 2: pack empty string throws Error',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.pack('');
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Data cannot be empty');
      },
    },
    {
      name: 'Error 3: pack unsupported algorithm throws Error',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.pack('Data', 'deflate');
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Unsupported algorithm');
      },
    },
    {
      name: 'Error 4: unpack null packet throws TypeError',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.unpack(null);
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, TypeError, 'Invalid packet structure');
      },
    },
    {
      name: 'Error 5: unpack non-Buffer payload throws TypeError',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.unpack({ ...sampleGzipPacket, payload: 'bad-payload' });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, TypeError, 'Invalid payload Buffer');
      },
    },
    {
      name: 'Error 6: unpack compressedSize mismatch throws Error',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.unpack({ ...sampleGzipPacket, compressedSize: 9999 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Compressed size mismatch');
      },
    },
    {
      name: 'Error 7: unpack unsupported algorithm throws Error',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.unpack({ ...sampleGzipPacket, algorithm: 'tar' });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Unsupported algorithm');
      },
    },
    {
      name: 'Error 8: unpack altered crc32 throws Error',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.unpack({ ...sampleGzipPacket, crc32: 12345678 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Checksum integrity check failed');
      },
    },
    {
      name: 'Error 9: unpack altered originalSize throws Error',
      fn: async () => {
        let thrown;
        try {
          await ArchivePacker.unpack({ ...sampleGzipPacket, originalSize: 9999 });
        } catch (err) {
          thrown = err;
        }
        assertError(thrown, Error, 'Original size mismatch');
      },
    },
  ];

  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await withTimeout(t.fn());
      console.log(`  [PASS] ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`  [FAIL] ${t.name} - ${err.message}`);
      failed++;
    }
  }

  console.log(`Soal 03: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Main execution
async function main() {
  const arg = process.argv[2];

  let selected;
  if (!arg) {
    selected = ['01', '02', '03'];
  } else if (arg === '01' || arg === '1') {
    selected = ['01'];
  } else if (arg === '02' || arg === '2') {
    selected = ['02'];
  } else if (arg === '03' || arg === '3') {
    selected = ['03'];
  } else {
    console.error('Penggunaan:');
    console.error('  node test.mjs       -> Menjalankan semua test (01, 02, 03)');
    console.error('  node test.mjs 01    -> Hanya menjalankan test Soal 01');
    console.error('  node test.mjs 02    -> Hanya menjalankan test Soal 02');
    console.error('  node test.mjs 03    -> Hanya menjalankan test Soal 03');
    process.exitCode = 2;
    return;
  }

  let totalPassed = 0;
  let totalFailed = 0;

  for (const q of selected) {
    let res;
    if (q === '01') res = await testQuestion01();
    else if (q === '02') res = await testQuestion02();
    else if (q === '03') res = await testQuestion03();

    totalPassed += res.passed;
    totalFailed += res.failed;
  }

  if (selected.length > 1) {
    console.log(`\n========================================`);
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed across ${selected.length} soal`);
    console.log(`========================================`);
  }

  if (totalFailed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exitCode = 1;
});
