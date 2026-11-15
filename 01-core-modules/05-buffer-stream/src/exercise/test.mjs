// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

function printUsage() {
  console.log('Penggunaan:');
  console.log('  node test.mjs       -> Menjalankan semua test (01, 02, 03)');
  console.log('  node test.mjs 01    -> Hanya menjalankan test Soal 01');
  console.log('  node test.mjs 02    -> Hanya menjalankan test Soal 02');
  console.log('  node test.mjs 03    -> Hanya menjalankan test Soal 03');
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    return ['01', '02', '03'];
  }
  if (args.length === 1) {
    const raw = args[0].trim();
    const map = {
      '1': '01',
      '01': '01',
      '2': '02',
      '02': '02',
      '3': '03',
      '03': '03',
    };
    if (map[raw]) {
      return [map[raw]];
    }
  }
  return null;
}

function findExerciseFile(prefix) {
  const files = fs.readdirSync(currentDir);
  return files.find(
    (file) =>
      file.startsWith(`${prefix}-`) &&
      (file.endsWith('.mjs') || file.endsWith('.js')),
  );
}

async function loadExerciseModule(prefix) {
  const filename = findExerciseFile(prefix);
  if (!filename) {
    return { error: `File soal dengan prefix '${prefix}-' tidak ditemukan di ${currentDir}` };
  }
  const fullPath = path.join(currentDir, filename);
  try {
    const mod = await import(pathToFileURL(fullPath).href);
    return { mod, filename };
  } catch (err) {
    return { error: `Gagal mengimpor file '${filename}': ${err.message}` };
  }
}

async function runWithTimeout(fn, timeoutMs = 2000) {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(new Error(`Test timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    if (timerId.unref) timerId.unref();
  });

  try {
    return await Promise.race([Promise.resolve().then(() => fn()), timeoutPromise]);
  } finally {
    clearTimeout(timerId);
  }
}

function assertSyncError(fn, expectedType, expectedMessage) {
  let thrown = null;
  try {
    fn();
  } catch (err) {
    thrown = err;
  }

  if (!thrown) {
    throw new Error(`Expected ${expectedType.name} to be thrown, but nothing was thrown`);
  }
  if (thrown.message === 'Not implemented') {
    throw new Error('Not implemented');
  }
  if (!(thrown instanceof expectedType)) {
    throw new Error(`Expected ${expectedType.name}, got ${thrown.name}: ${thrown.message}`);
  }
  if (expectedMessage && !thrown.message.includes(expectedMessage)) {
    throw new Error(`Expected error message to include '${expectedMessage}', got: '${thrown.message}'`);
  }
}

async function assertAsyncError(fn, expectedType, expectedMessage) {
  let thrown = null;
  try {
    await fn();
  } catch (err) {
    thrown = err;
  }

  if (!thrown) {
    throw new Error(`Expected ${expectedType.name} to be thrown, but nothing was thrown`);
  }
  if (thrown.message === 'Not implemented') {
    throw new Error('Not implemented');
  }
  if (!(thrown instanceof expectedType)) {
    throw new Error(`Expected ${expectedType.name}, got ${thrown.name}: ${thrown.message}`);
  }
  if (expectedMessage && !thrown.message.includes(expectedMessage)) {
    throw new Error(`Expected error message to include '${expectedMessage}', got: '${thrown.message}'`);
  }
}

async function executeTestSuite() {
  const targetSuites = parseCliArgs();
  if (!targetSuites) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  let grandTotalPassed = 0;
  let grandTotalFailed = 0;

  // ==========================================================================
  // SECTION 01: encodeBinaryPayload
  // ==========================================================================
  if (targetSuites.includes('01')) {
    console.log('==================================================');
    console.log('SOAL 01: Buffer Payload Packer & Multi-Encoding Converter');
    console.log('==================================================');

    let suitePassed = 0;
    let suiteFailed = 0;

    const loaded = await loadExerciseModule('01');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      suiteFailed += 10;
    } else {
      const { encodeBinaryPayload } = loaded.mod;
      if (typeof encodeBinaryPayload !== 'function') {
        console.log("❌ ERROR: Function 'encodeBinaryPayload' tidak ditemukan atau belum di-export");
        suiteFailed += 10;
      } else {
        const tests = [
          {
            name: 'Normal 1: Encode string ASCII standar dengan default encoding UTF-8',
            fn: () => {
              const res = encodeBinaryPayload('hello');
              if (!Buffer.isBuffer(res?.buffer)) {
                throw new Error('Property buffer must be an instance of Buffer');
              }
              if (res.byteLength !== 5) {
                throw new Error(`Expected byteLength 5, got ${res.byteLength}`);
              }
              if (res.hex !== '68656c6c6f') {
                throw new Error(`Expected hex '68656c6c6f', got '${res.hex}'`);
              }
              if (res.base64 !== 'aGVsbG8=') {
                throw new Error(`Expected base64 'aGVsbG8=', got '${res.base64}'`);
              }
              if (res.buffer.toString('utf8') !== 'hello') {
                throw new Error(`Expected buffer content 'hello', got '${res.buffer.toString()}'`);
              }
            },
          },
          {
            name: 'Normal 2: Encode string multi-byte UTF-8 (karakter khusus / emoji)',
            fn: () => {
              const res = encodeBinaryPayload('Kopi ☕', 'utf8');
              if (res.byteLength !== 8) {
                throw new Error(`Expected byteLength 8, got ${res.byteLength}`);
              }
              if (res.hex !== '4b6f706920e29895') {
                throw new Error(`Expected hex '4b6f706920e29895', got '${res.hex}'`);
              }
              if (res.base64 !== 'S29waSDimJU=') {
                throw new Error(`Expected base64 'S29waSDimJU=', got '${res.base64}'`);
              }
            },
          },
          {
            name: 'Normal 3: Decode data hex string menjadi binary buffer',
            fn: () => {
              const res = encodeBinaryPayload('4e6f6465', 'hex');
              if (res.byteLength !== 4) {
                throw new Error(`Expected byteLength 4, got ${res.byteLength}`);
              }
              if (res.hex !== '4e6f6465') {
                throw new Error(`Expected hex '4e6f6465', got '${res.hex}'`);
              }
              if (res.base64 !== 'Tm9kZQ==') {
                throw new Error(`Expected base64 'Tm9kZQ==', got '${res.base64}'`);
              }
              if (res.buffer.toString('utf8') !== 'Node') {
                throw new Error(`Expected buffer content 'Node', got '${res.buffer.toString()}'`);
              }
            },
          },
          {
            name: 'Normal 4: Decode base64 string menjadi binary buffer',
            fn: () => {
              const res = encodeBinaryPayload('Tm9kZS5qcw==', 'base64');
              if (res.byteLength !== 7) {
                throw new Error(`Expected byteLength 7, got ${res.byteLength}`);
              }
              if (res.hex !== '4e6f64652e6a73') {
                throw new Error(`Expected hex '4e6f64652e6a73', got '${res.hex}'`);
              }
              if (res.base64 !== 'Tm9kZS5qcw==') {
                throw new Error(`Expected base64 'Tm9kZS5qcw==', got '${res.base64}'`);
              }
              if (res.buffer.toString('utf8') !== 'Node.js') {
                throw new Error(`Expected buffer content 'Node.js', got '${res.buffer.toString()}'`);
              }
            },
          },
          {
            name: 'Edge 1: Input string kosong menghasilkan buffer kosong 0-byte',
            fn: () => {
              const res = encodeBinaryPayload('');
              if (res.byteLength !== 0) {
                throw new Error(`Expected byteLength 0, got ${res.byteLength}`);
              }
              if (res.hex !== '') {
                throw new Error(`Expected empty hex string, got '${res.hex}'`);
              }
              if (res.base64 !== '') {
                throw new Error(`Expected empty base64 string, got '${res.base64}'`);
              }
              if (res.buffer.length !== 0) {
                throw new Error(`Expected 0-byte buffer, got length ${res.buffer.length}`);
              }
            },
          },
          {
            name: 'Edge 2: Input encoding dengan whitespace di-trim atau divalidasi ketat',
            fn: () => {
              const res = encodeBinaryPayload('test', 'ascii');
              if (res.byteLength !== 4) {
                throw new Error(`Expected byteLength 4, got ${res.byteLength}`);
              }
              if (res.hex !== '74657374') {
                throw new Error(`Expected hex '74657374', got '${res.hex}'`);
              }
              if (res.base64 !== 'dGVzdA==') {
                throw new Error(`Expected base64 'dGVzdA==', got '${res.base64}'`);
              }
            },
          },
          {
            name: 'Error 1: Input text bukan string melempar TypeError',
            fn: () => {
              assertSyncError(
                () => encodeBinaryPayload(12345),
                TypeError,
                'Input text must be a string',
              );
            },
          },
          {
            name: 'Error 2: Input text null atau undefined melempar TypeError',
            fn: () => {
              assertSyncError(
                () => encodeBinaryPayload(null),
                TypeError,
                'Input text must be a string',
              );
            },
          },
          {
            name: 'Error 3: Input encoding bukan string melempar TypeError',
            fn: () => {
              assertSyncError(
                () => encodeBinaryPayload('hello', 123),
                TypeError,
                'Encoding must be a string',
              );
            },
          },
          {
            name: 'Error 4: Input encoding tidak didukung melempar RangeError',
            fn: () => {
              assertSyncError(
                () => encodeBinaryPayload('hello', 'binary'),
                RangeError,
                'Unsupported encoding: binary',
              );
            },
          },
        ];

        for (const test of tests) {
          try {
            await runWithTimeout(test.fn, 2000);
            console.log(`  PASS: ${test.name}`);
            suitePassed++;
          } catch (err) {
            console.log(`  FAIL: ${test.name}`);
            console.log(`        -> ${err.message}`);
            suiteFailed++;
          }
        }
      }
    }

    console.log(`Soal 01: ${suitePassed} passed, ${suiteFailed} failed\n`);
    grandTotalPassed += suitePassed;
    grandTotalFailed += suiteFailed;
  }

  // ==========================================================================
  // SECTION 02: createMaskingTransform
  // ==========================================================================
  if (targetSuites.includes('02')) {
    console.log('==================================================');
    console.log('SOAL 02: Streaming Data Masking & PII Sanitizer Transform');
    console.log('==================================================');

    let suitePassed = 0;
    let suiteFailed = 0;

    const loaded = await loadExerciseModule('02');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      suiteFailed += 11;
    } else {
      const { createMaskingTransform } = loaded.mod;
      if (typeof createMaskingTransform !== 'function') {
        console.log("❌ ERROR: Function 'createMaskingTransform' tidak ditemukan atau belum di-export");
        suiteFailed += 11;
      } else {
        const tests = [
          {
            name: 'Normal 1: Masking kata sensitif tunggal pada stream chunk teks',
            fn: async () => {
              const transform = createMaskingTransform({ maskWords: ['secret'] });
              const chunks = [];
              const sink = new Writable({
                write(c, enc, cb) {
                  chunks.push(c.toString());
                  cb();
                },
              });
              await pipeline(
                Readable.from(['This is a secret key\n']),
                transform,
                sink,
              );
              const result = chunks.join('');
              if (result !== 'This is a ****** key\n') {
                throw new Error(`Expected 'This is a ****** key\\n', got '${result}'`);
              }
            },
          },
          {
            name: 'Normal 2: Masking banyak kata sensitif case-insensitivity',
            fn: async () => {
              const transform = createMaskingTransform({ maskWords: ['token', 'password'] });
              const chunks = [];
              const sink = new Writable({
                write(c, enc, cb) {
                  chunks.push(c.toString());
                  cb();
                },
              });
              await pipeline(
                Readable.from(['TOKEN: 123, Password: abc']),
                transform,
                sink,
              );
              const result = chunks.join('');
              if (result !== '*****: 123, ********: abc') {
                throw new Error(`Expected '*****: 123, ********: abc', got '${result}'`);
              }
            },
          },
          {
            name: 'Normal 3: Masking dengan kustomisasi maskChar karakter pagar',
            fn: async () => {
              const transform = createMaskingTransform({ maskWords: ['pin'], maskChar: '#' });
              const chunks = [];
              const sink = new Writable({
                write(c, enc, cb) {
                  chunks.push(c.toString());
                  cb();
                },
              });
              await pipeline(
                Readable.from(['User pin is 9999']),
                transform,
                sink,
              );
              const result = chunks.join('');
              if (result !== 'User ### is 9999') {
                throw new Error(`Expected 'User ### is 9999', got '${result}'`);
              }
            },
          },
          {
            name: 'Normal 4: Menerima masukan chunk bertipe Buffer biner mentah',
            fn: async () => {
              const transform = createMaskingTransform({ maskWords: ['auth'] });
              const chunks = [];
              const sink = new Writable({
                write(c, enc, cb) {
                  chunks.push(c.toString());
                  cb();
                },
              });
              await pipeline(
                Readable.from([Buffer.from('Bearer auth-xyz')]),
                transform,
                sink,
              );
              const result = chunks.join('');
              if (result !== 'Bearer ****-xyz') {
                throw new Error(`Expected 'Bearer ****-xyz', got '${result}'`);
              }
            },
          },
          {
            name: 'Edge 1: Kata sensitif mengandung karakter khusus regex dieksekusi aman',
            fn: async () => {
              const transform = createMaskingTransform({ maskWords: ['api.key', '$secret'] });
              const chunks = [];
              const sink = new Writable({
                write(c, enc, cb) {
                  chunks.push(c.toString());
                  cb();
                },
              });
              await pipeline(
                Readable.from(['Check api.key and $secret now']),
                transform,
                sink,
              );
              const result = chunks.join('');
              if (result !== 'Check ******* and ******* now') {
                throw new Error(`Expected 'Check ******* and ******* now', got '${result}'`);
              }
            },
          },
          {
            name: 'Edge 2: Chunk tanpa kata sensitif diteruskan tanpa modifikasi',
            fn: async () => {
              const transform = createMaskingTransform({ maskWords: ['admin'] });
              const chunks = [];
              const sink = new Writable({
                write(c, enc, cb) {
                  chunks.push(c.toString());
                  cb();
                },
              });
              await pipeline(
                Readable.from(['Public user report']),
                transform,
                sink,
              );
              const result = chunks.join('');
              if (result !== 'Public user report') {
                throw new Error(`Expected 'Public user report', got '${result}'`);
              }
            },
          },
          {
            name: 'Edge 3: Chunk string kosong diteruskan secara aman',
            fn: async () => {
              const transform = createMaskingTransform({ maskWords: ['secret'] });
              const chunks = [];
              const sink = new Writable({
                write(c, enc, cb) {
                  chunks.push(c.toString());
                  cb();
                },
              });
              await pipeline(
                Readable.from(['']),
                transform,
                sink,
              );
              const result = chunks.join('');
              if (result !== '') {
                throw new Error(`Expected '', got '${result}'`);
              }
            },
          },
          {
            name: 'Error 1: Options bukan object melempar TypeError',
            fn: () => {
              assertSyncError(
                () => createMaskingTransform(null),
                TypeError,
                'Options must be a valid object',
              );
            },
          },
          {
            name: 'Error 2: maskWords kosong melempar TypeError',
            fn: () => {
              assertSyncError(
                () => createMaskingTransform({ maskWords: [] }),
                TypeError,
                'maskWords must be a non-empty array of strings',
              );
            },
          },
          {
            name: 'Error 3: Elemen maskWords bukan string melempar TypeError',
            fn: () => {
              assertSyncError(
                () => createMaskingTransform({ maskWords: ['valid', 123] }),
                TypeError,
                'Each mask word must be a non-empty string',
              );
            },
          },
          {
            name: 'Error 4: maskChar bukan string tunggal melempar RangeError',
            fn: () => {
              assertSyncError(
                () => createMaskingTransform({ maskWords: ['x'], maskChar: '**' }),
                RangeError,
                'maskChar must be a single character',
              );
            },
          },
        ];

        for (const test of tests) {
          try {
            await runWithTimeout(test.fn, 2000);
            console.log(`  PASS: ${test.name}`);
            suitePassed++;
          } catch (err) {
            console.log(`  FAIL: ${test.name}`);
            console.log(`        -> ${err.message}`);
            suiteFailed++;
          }
        }
      }
    }

    console.log(`Soal 02: ${suitePassed} passed, ${suiteFailed} failed\n`);
    grandTotalPassed += suitePassed;
    grandTotalFailed += suiteFailed;
  }

  // ==========================================================================
  // SECTION 03: ChunkedPayloadCollector
  // ==========================================================================
  if (targetSuites.includes('03')) {
    console.log('==================================================');
    console.log('SOAL 03: Bounded Chunked Payload Aggregator & Writable');
    console.log('==================================================');

    let suitePassed = 0;
    let suiteFailed = 0;

    const loaded = await loadExerciseModule('03');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      suiteFailed += 11;
    } else {
      const { ChunkedPayloadCollector } = loaded.mod;
      if (typeof ChunkedPayloadCollector !== 'function') {
        console.log("❌ ERROR: Class 'ChunkedPayloadCollector' tidak ditemukan atau belum di-export");
        suiteFailed += 11;
      } else {
        const tests = [
          {
            name: 'Normal 1: Mengumpulkan multiple chunk string hingga stream selesai',
            fn: async () => {
              const collector = new ChunkedPayloadCollector();
              collector.write('chunk-1');
              collector.write('chunk-2');
              await new Promise((r) => collector.end(r));
              const text = collector.toString();
              const stats = collector.getStats();
              if (text !== 'chunk-1chunk-2') {
                throw new Error(`Expected 'chunk-1chunk-2', got '${text}'`);
              }
              if (stats.chunkCount !== 2) {
                throw new Error(`Expected chunkCount 2, got ${stats.chunkCount}`);
              }
              if (!stats.isFinished) {
                throw new Error('Expected isFinished to be true after end()');
              }
            },
          },
          {
            name: 'Normal 2: Mengumpulkan chunk bertipe Buffer biner mentah',
            fn: async () => {
              const collector = new ChunkedPayloadCollector();
              collector.write(Buffer.from([0x01, 0x02]));
              await new Promise((r) => collector.end(r));
              const buf = collector.getBytes();
              const stats = collector.getStats();
              if (!Buffer.isBuffer(buf) || buf.length !== 2 || buf[0] !== 0x01 || buf[1] !== 0x02) {
                throw new Error(`Expected Buffer [0x01, 0x02], got ${buf?.toString('hex')}`);
              }
              if (stats.totalBytes !== 2) {
                throw new Error(`Expected totalBytes 2, got ${stats.totalBytes}`);
              }
            },
          },
          {
            name: 'Normal 3: Menghubungkan collector dengan stream.pipeline',
            fn: async () => {
              const collector = new ChunkedPayloadCollector();
              await pipeline(
                Readable.from(['A', 'B']),
                collector,
              );
              if (collector.toString() !== 'AB') {
                throw new Error(`Expected 'AB', got '${collector.toString()}'`);
              }
              if (!collector.getStats().isFinished) {
                throw new Error('Expected isFinished to be true');
              }
            },
          },
          {
            name: 'Normal 4: Membaca statistik metrik sebelum stream selesai',
            fn: () => {
              const collector = new ChunkedPayloadCollector();
              collector.write('data');
              const stats = collector.getStats();
              if (stats.totalBytes !== 4) {
                throw new Error(`Expected totalBytes 4, got ${stats.totalBytes}`);
              }
              if (stats.chunkCount !== 1) {
                throw new Error(`Expected chunkCount 1, got ${stats.chunkCount}`);
              }
              if (stats.isFinished !== false) {
                throw new Error('Expected isFinished to be false before end()');
              }
              if (stats.maxBytes !== 1048576) {
                throw new Error(`Expected default maxBytes 1048576, got ${stats.maxBytes}`);
              }
            },
          },
          {
            name: 'Normal 5: Mereset buffer collector dengan clear()',
            fn: () => {
              const collector = new ChunkedPayloadCollector();
              collector.write('temporary data');
              collector.clear();
              const stats = collector.getStats();
              if (stats.totalBytes !== 0 || stats.chunkCount !== 0 || collector.getBytes().length !== 0) {
                throw new Error(`Expected cleared state, got bytes: ${stats.totalBytes}, count: ${stats.chunkCount}`);
              }
            },
          },
          {
            name: 'Edge 1: Input stream kosong tanpa chunk ditutup langsung',
            fn: async () => {
              const collector = new ChunkedPayloadCollector();
              await new Promise((r) => collector.end(r));
              if (collector.getBytes().length !== 0) {
                throw new Error('Expected 0-byte buffer for empty stream');
              }
              if (collector.toString() !== '') {
                throw new Error('Expected empty string for empty stream');
              }
              if (!collector.getStats().isFinished) {
                throw new Error('Expected isFinished to be true');
              }
            },
          },
          {
            name: 'Edge 2: Batas ukuran totalBytes tepat sama dengan maxBytes berhasil',
            fn: async () => {
              const collector = new ChunkedPayloadCollector({ maxBytes: 10 });
              collector.write('1234567890');
              await new Promise((r) => collector.end(r));
              const stats = collector.getStats();
              if (stats.totalBytes !== 10) {
                throw new Error(`Expected totalBytes 10, got ${stats.totalBytes}`);
              }
              if (!stats.isFinished) {
                throw new Error('Expected isFinished to be true');
              }
            },
          },
          {
            name: 'Error 1: maxBytes tidak positif melempar RangeError pada instansiasi',
            fn: () => {
              assertSyncError(
                () => new ChunkedPayloadCollector({ maxBytes: 0 }),
                RangeError,
                'maxBytes must be a positive number',
              );
            },
          },
          {
            name: 'Error 2: maxBytes negatif melempar RangeError pada instansiasi',
            fn: () => {
              assertSyncError(
                () => new ChunkedPayloadCollector({ maxBytes: -50 }),
                RangeError,
                'maxBytes must be a positive number',
              );
            },
          },
          {
            name: 'Error 3: Chunk bukan Buffer atau string menghasilkan error TypeError',
            fn: async () => {
              const collector = new ChunkedPayloadCollector();
              collector.on('error', () => {});
              await assertAsyncError(
                () => new Promise((resolve, reject) => {
                  collector.write(12345, (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
                TypeError,
                'Chunk must be a Buffer or string',
              );
            },
          },
          {
            name: 'Error 4: Akumulasi ukuran chunk melebihi maxBytes memicu RangeError',
            fn: async () => {
              const collector = new ChunkedPayloadCollector({ maxBytes: 10 });
              collector.on('error', () => {});
              await assertAsyncError(
                () => new Promise((resolve, reject) => {
                  collector.write('12345678901', (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
                }),
                RangeError,
                'Payload exceeds maximum allowed size of 10 bytes',
              );
            },
          },
        ];

        for (const test of tests) {
          try {
            await runWithTimeout(test.fn, 2000);
            console.log(`  PASS: ${test.name}`);
            suitePassed++;
          } catch (err) {
            console.log(`  FAIL: ${test.name}`);
            console.log(`        -> ${err.message}`);
            suiteFailed++;
          }
        }
      }
    }

    console.log(`Soal 03: ${suitePassed} passed, ${suiteFailed} failed\n`);
    grandTotalPassed += suitePassed;
    grandTotalFailed += suiteFailed;
  }

  // Ringkasan Total
  if (targetSuites.length > 1) {
    console.log('==================================================');
    console.log(`TOTAL KESELURUHAN: ${grandTotalPassed} passed, ${grandTotalFailed} failed`);
    console.log('==================================================');
  }

  if (grandTotalFailed > 0) {
    process.exitCode = 1;
  }
}

executeTestSuite();
