// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { EventEmitter } from 'node:events';
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
  // SECTION 01: waitForEvent
  // ==========================================================================
  if (targetSuites.includes('01')) {
    console.log('==================================================');
    console.log('SOAL 01: Single Event Waiter with Timeout');
    console.log('==================================================');

    let suitePassed = 0;
    let suiteFailed = 0;

    const loaded = await loadExerciseModule('01');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      suiteFailed += 8; // Total rows in 01 table
    } else {
      const { waitForEvent } = loaded.mod;
      if (typeof waitForEvent !== 'function') {
        console.log("❌ ERROR: Function 'waitForEvent' tidak ditemukan atau belum di-export");
        suiteFailed += 8;
      } else {
        const tests = [
          {
            name: 'Normal 1: Menunggu event dengan payload single argument',
            fn: async () => {
              const ee = new EventEmitter();
              const promise = waitForEvent(ee, 'data');
              promise.catch(() => {});
              ee.emit('data', 'sample-value');
              const result = await promise;
              if (!Array.isArray(result) || result.length !== 1 || result[0] !== 'sample-value') {
                throw new Error(`Expected ['sample-value'], got ${JSON.stringify(result)}`);
              }
            },
          },
          {
            name: 'Normal 2: Menunggu event dengan payload multiple arguments',
            fn: async () => {
              const ee = new EventEmitter();
              const promise = waitForEvent(ee, 'login');
              promise.catch(() => {});
              ee.emit('login', 'U1', 'admin');
              const result = await promise;
              if (!Array.isArray(result) || result.length !== 2 || result[0] !== 'U1' || result[1] !== 'admin') {
                throw new Error(`Expected ['U1', 'admin'], got ${JSON.stringify(result)}`);
              }
            },
          },
          {
            name: 'Normal 3: Menunggu event dengan parameter timeoutMs yang valid sebelum waktu habis',
            fn: async () => {
              const ee = new EventEmitter();
              const promise = waitForEvent(ee, 'ping', 1000);
              promise.catch(() => {});
              ee.emit('ping', 'pong');
              const result = await promise;
              if (!Array.isArray(result) || result[0] !== 'pong') {
                throw new Error(`Expected ['pong'], got ${JSON.stringify(result)}`);
              }
            },
          },
          {
            name: 'Edge 1: Batas timeoutMs habis sebelum event dipancarkan (reject & listener cleanup)',
            fn: async () => {
              const ee = new EventEmitter();
              await assertAsyncError(
                () => waitForEvent(ee, 'unheard', 50),
                Error,
                'Event wait timed out',
              );
              if (ee.listenerCount('unheard') !== 0) {
                throw new Error('Listener harus dibersihkan setelah timeout terjadi');
              }
            },
          },
          {
            name: 'Edge 2: Emitter memancarkan event error sebelum target event terjadi (reject & cleanup)',
            fn: async () => {
              const ee = new EventEmitter();
              const promise = waitForEvent(ee, 'task');
              promise.catch(() => {});
              try {
                ee.emit('error', new Error('Task execution failed'));
              } catch {
                // If emitter has no error listener, emit('error') throws synchronously
              }
              await assertAsyncError(
                () => promise,
                Error,
                'Task execution failed',
              );
              if (ee.listenerCount('task') !== 0) {
                throw new Error('Listener harus dibersihkan setelah error terjadi');
              }
            },
          },
          {
            name: 'Error 1: Parameter emitter bukan instance EventEmitter',
            fn: async () => {
              await assertAsyncError(
                () => waitForEvent(null, 'data'),
                TypeError,
                'Invalid emitter: must be an instance of EventEmitter',
              );
              await assertAsyncError(
                () => waitForEvent({}, 'data'),
                TypeError,
                'Invalid emitter: must be an instance of EventEmitter',
              );
            },
          },
          {
            name: 'Error 2: Parameter eventName bukan string atau string kosong/whitespace',
            fn: async () => {
              const ee = new EventEmitter();
              await assertAsyncError(
                () => waitForEvent(ee, '   '),
                TypeError,
                'Invalid eventName: must be a non-empty string',
              );
              await assertAsyncError(
                () => waitForEvent(ee, 123),
                TypeError,
                'Invalid eventName: must be a non-empty string',
              );
            },
          },
          {
            name: 'Error 3: Parameter timeoutMs bernilai invalid (<= 0 atau NaN)',
            fn: async () => {
              const ee = new EventEmitter();
              await assertAsyncError(
                () => waitForEvent(ee, 'data', -100),
                RangeError,
                'Invalid timeoutMs: must be a positive number',
              );
              await assertAsyncError(
                () => waitForEvent(ee, 'data', 0),
                RangeError,
                'Invalid timeoutMs: must be a positive number',
              );
              await assertAsyncError(
                () => waitForEvent(ee, 'data', Number.NaN),
                RangeError,
                'Invalid timeoutMs: must be a positive number',
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
  // SECTION 02: collectEventStream
  // ==========================================================================
  if (targetSuites.includes('02')) {
    console.log('==================================================');
    console.log('SOAL 02: Event Stream Collector with AbortSignal');
    console.log('==================================================');

    let suitePassed = 0;
    let suiteFailed = 0;

    const loaded = await loadExerciseModule('02');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      suiteFailed += 10; // Total rows in 02 table
    } else {
      const { collectEventStream } = loaded.mod;
      if (typeof collectEventStream !== 'function') {
        console.log("❌ ERROR: Function 'collectEventStream' tidak ditemukan atau belum di-export");
        suiteFailed += 10;
      } else {
        const tests = [
          {
            name: 'Normal 1: Mengumpulkan event tepat sesuai kuota options.count',
            fn: async () => {
              const ee = new EventEmitter();
              const promise = collectEventStream(ee, 'item', { count: 3 });
              promise.catch(() => {});
              ee.emit('item', 10);
              ee.emit('item', 20);
              ee.emit('item', 30);
              const result = await promise;
              if (JSON.stringify(result) !== JSON.stringify([[10], [20], [30]])) {
                throw new Error(`Expected [[10], [20], [30]], got ${JSON.stringify(result)}`);
              }
              if (ee.listenerCount('item') !== 0) {
                throw new Error('Listener harus dilepas setelah kuota count terpenuhi');
              }
            },
          },
          {
            name: 'Normal 2: Mengumpulkan event dengan banyak argumen payload per pemanggilan',
            fn: async () => {
              const ee = new EventEmitter();
              const promise = collectEventStream(ee, 'log', { count: 2 });
              promise.catch(() => {});
              ee.emit('log', 'A', 1);
              ee.emit('log', 'B', 2);
              const result = await promise;
              if (JSON.stringify(result) !== JSON.stringify([['A', 1], ['B', 2]])) {
                throw new Error(`Expected [['A', 1], ['B', 2]], got ${JSON.stringify(result)}`);
              }
              if (ee.listenerCount('log') !== 0) {
                throw new Error('Listener harus dilepas setelah selesai');
              }
            },
          },
          {
            name: 'Edge 1: Signal sudah dalam keadaan aborted sebelum pengumpulan dimulai',
            fn: async () => {
              const ee = new EventEmitter();
              const ac = new AbortController();
              ac.abort();
              await assertAsyncError(
                () => collectEventStream(ee, 'data', { count: 5, signal: ac.signal }),
                Error,
                'Collection aborted',
              );
              if (ee.listenerCount('data') !== 0) {
                throw new Error('Tidak boleh ada listener yang terpasang jika signal sudah abort');
              }
            },
          },
          {
            name: 'Edge 2: Signal dibatalkan di tengah aliran pengumpulan event',
            fn: async () => {
              const ee = new EventEmitter();
              const ac = new AbortController();
              const promise = collectEventStream(ee, 'data', { count: 5, signal: ac.signal });
              promise.catch(() => {});
              ee.emit('data', 'A');
              ee.emit('data', 'B');
              ac.abort();
              await assertAsyncError(
                () => promise,
                Error,
                'Collection aborted',
              );
              if (ee.listenerCount('data') !== 0) {
                throw new Error('Listener harus dibersihkan setelah operasi dibatalkan oleh sinyal');
              }
            },
          },
          {
            name: 'Edge 3: Emitter memancarkan error selama aliran pengumpulan berlangsung',
            fn: async () => {
              const ee = new EventEmitter();
              const promise = collectEventStream(ee, 'data', { count: 5 });
              promise.catch(() => {});
              ee.emit('data', 1);
              try {
                ee.emit('error', new Error('Stream broke'));
              } catch {
                // If emitter has no error listener, emit('error') throws synchronously
              }
              await assertAsyncError(
                () => promise,
                Error,
                'Stream broke',
              );
              if (ee.listenerCount('data') !== 0) {
                throw new Error('Listener harus dibersihkan setelah error terjadi');
              }
            },
          },
          {
            name: 'Error 1: Parameter emitter bukan instance EventEmitter',
            fn: async () => {
              await assertAsyncError(
                () => collectEventStream({}, 'data', { count: 1 }),
                TypeError,
                'Invalid emitter: must be an instance of EventEmitter',
              );
            },
          },
          {
            name: 'Error 2: Parameter eventName bukan string atau string kosong/whitespace',
            fn: async () => {
              const ee = new EventEmitter();
              await assertAsyncError(
                () => collectEventStream(ee, '   ', { count: 1 }),
                TypeError,
                'Invalid eventName: must be a non-empty string',
              );
            },
          },
          {
            name: 'Error 3: Parameter options bukan objek atau null',
            fn: async () => {
              const ee = new EventEmitter();
              await assertAsyncError(
                () => collectEventStream(ee, 'data', null),
                TypeError,
                'Invalid options: must be an object',
              );
            },
          },
          {
            name: 'Error 4: Properti options.count bernilai invalid (<= 0 atau non-integer)',
            fn: async () => {
              const ee = new EventEmitter();
              await assertAsyncError(
                () => collectEventStream(ee, 'data', { count: 0 }),
                RangeError,
                'Invalid count: must be a positive integer',
              );
              await assertAsyncError(
                () => collectEventStream(ee, 'data', { count: -3 }),
                RangeError,
                'Invalid count: must be a positive integer',
              );
              await assertAsyncError(
                () => collectEventStream(ee, 'data', { count: 1.5 }),
                RangeError,
                'Invalid count: must be a positive integer',
              );
            },
          },
          {
            name: 'Error 5: Properti options.signal bukan instance AbortSignal',
            fn: async () => {
              const ee = new EventEmitter();
              await assertAsyncError(
                () => collectEventStream(ee, 'data', { count: 1, signal: {} }),
                TypeError,
                'Invalid signal: must be an AbortSignal instance',
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
  // SECTION 03: ResilientEventBus
  // ==========================================================================
  if (targetSuites.includes('03')) {
    console.log('==================================================');
    console.log('SOAL 03: Resilient Event Bus Architecture');
    console.log('==================================================');

    let suitePassed = 0;
    let suiteFailed = 0;

    const loaded = await loadExerciseModule('03');
    if (loaded.error) {
      console.log(`❌ ERROR: ${loaded.error}`);
      suiteFailed += 12; // Total rows in 03 table
    } else {
      const { ResilientEventBus } = loaded.mod;
      if (typeof ResilientEventBus !== 'function') {
        console.log("❌ ERROR: Class 'ResilientEventBus' tidak ditemukan atau belum di-export");
        suiteFailed += 12;
      } else {
        const tests = [
          {
            name: 'Normal 1: Mendaftarkan listener dan memancarkan event payload secara standar',
            fn: () => {
              const bus = new ResilientEventBus();
              let received = null;
              bus.subscribe('evt', (val) => {
                received = val;
              });
              const emitted = bus.publish('evt', 'ok');
              if (received !== 'ok') throw new Error(`Expected received 'ok', got ${received}`);
              if (emitted !== true) throw new Error('Expected publish to return true');
            },
          },
          {
            name: 'Normal 2: Melepas pendaftaran listener menggunakan fungsi uninstaller yang dikembalikan',
            fn: () => {
              const bus = new ResilientEventBus();
              let callCount = 0;
              const unsub = bus.subscribe('x', () => {
                callCount++;
              });
              bus.publish('x');
              if (callCount !== 1) throw new Error('Expected callCount to be 1');
              unsub();
              bus.publish('x');
              if (callCount !== 1) throw new Error('Listener should not be called after unsub');
              if (bus.listenerCount('x') !== 0) throw new Error('Expected listenerCount to be 0');
            },
          },
          {
            name: 'Normal 3: Mengatur prioritas eksekusi dengan options.priority',
            fn: () => {
              const bus = new ResilientEventBus();
              const sequence = [];
              bus.subscribe('q', () => sequence.push('second'));
              bus.subscribe('q', () => sequence.push('first'), { priority: true });
              bus.publish('q');
              if (JSON.stringify(sequence) !== JSON.stringify(['first', 'second'])) {
                throw new Error(`Expected ['first', 'second'], got ${JSON.stringify(sequence)}`);
              }
            },
          },
          {
            name: 'Normal 4: Menghasilkan laporan telemetri diagnostik akurat',
            fn: () => {
              const bus = new ResilientEventBus({ maxListeners: 15 });
              bus.subscribe('metricA', () => {});
              bus.subscribe('metricA', () => {});
              bus.subscribe('metricB', () => {});
              const diag = bus.getDiagnostics();
              if (diag.maxListeners !== 15) throw new Error(`Expected maxListeners 15, got ${diag.maxListeners}`);
              if (!diag.activeEvents.includes('metricA') || !diag.activeEvents.includes('metricB')) {
                throw new Error('Active events list missing registered events');
              }
              if (diag.listenerCounts.metricA !== 2 || diag.listenerCounts.metricB !== 1) {
                throw new Error('Listener counts do not match actual registered listeners');
              }
              if (diag.totalErrors !== 0) throw new Error('Expected totalErrors to be 0');
            },
          },
          {
            name: 'Edge 1: Mengombinasikan prioritas dan sekali pakai ({ priority: true, once: true })',
            fn: () => {
              const bus = new ResilientEventBus();
              const calls = [];
              bus.subscribe('p', () => calls.push('regular'));
              bus.subscribe('p', () => calls.push('prepend-once'), { priority: true, once: true });
              bus.publish('p');
              bus.publish('p');
              if (JSON.stringify(calls) !== JSON.stringify(['prepend-once', 'regular', 'regular'])) {
                throw new Error(`Expected ['prepend-once', 'regular', 'regular'], got ${JSON.stringify(calls)}`);
              }
            },
          },
          {
            name: 'Edge 2: Mencatat error secara otomatis ke errorHistory via errorMonitor tanpa crash',
            fn: () => {
              const bus = new ResilientEventBus();
              bus.on('error', () => {}); // Attach handler to avoid uncaught exception
              bus.publish('error', new Error('Database ping timeout'));
              const diag = bus.getDiagnostics();
              if (diag.totalErrors !== 1) throw new Error(`Expected totalErrors 1, got ${diag.totalErrors}`);
              if (bus.errorHistory.length !== 1 || bus.errorHistory[0].message !== 'Database ping timeout') {
                throw new Error('Error history did not properly capture error message');
              }
            },
          },
          {
            name: 'Edge 3: Membersihkan seluruh listener dan riwayat error secara total via destroy()',
            fn: () => {
              const bus = new ResilientEventBus();
              bus.on('error', () => {});
              bus.subscribe('e1', () => {});
              bus.publish('error', new Error('Err1'));
              bus.destroy();
              if (bus.listenerCount('e1') !== 0) throw new Error('All listeners must be removed on destroy');
              if (bus.errorHistory.length !== 0) throw new Error('Error history must be cleared on destroy');
              const diag = bus.getDiagnostics();
              if (diag.activeEvents.length !== 0 || diag.totalErrors !== 0) {
                throw new Error('Diagnostics must report zero active events and errors after destroy');
              }
            },
          },
          {
            name: 'Error 1: Parameter maxListeners pada constructor bukan integer positif',
            fn: () => {
              assertSyncError(
                () => new ResilientEventBus({ maxListeners: 0 }),
                RangeError,
                'Invalid maxListeners: must be a positive integer',
              );
              assertSyncError(
                () => new ResilientEventBus({ maxListeners: -5 }),
                RangeError,
                'Invalid maxListeners: must be a positive integer',
              );
              assertSyncError(
                () => new ResilientEventBus({ maxListeners: 2.5 }),
                RangeError,
                'Invalid maxListeners: must be a positive integer',
              );
            },
          },
          {
            name: 'Error 2: Parameter eventName pada subscribe bukan string atau string kosong/whitespace',
            fn: () => {
              const bus = new ResilientEventBus();
              assertSyncError(
                () => bus.subscribe('', () => {}),
                TypeError,
                'Invalid eventName: must be a non-empty string',
              );
              assertSyncError(
                () => bus.subscribe('   ', () => {}),
                TypeError,
                'Invalid eventName: must be a non-empty string',
              );
            },
          },
          {
            name: 'Error 3: Parameter handler pada subscribe bukan function',
            fn: () => {
              const bus = new ResilientEventBus();
              assertSyncError(
                () => bus.subscribe('evt', null),
                TypeError,
                'Invalid handler: must be a function',
              );
              assertSyncError(
                () => bus.subscribe('evt', 'not-a-func'),
                TypeError,
                'Invalid handler: must be a function',
              );
            },
          },
          {
            name: 'Error 4: Parameter options pada subscribe bukan objek atau bernilai null',
            fn: () => {
              const bus = new ResilientEventBus();
              assertSyncError(
                () => bus.subscribe('evt', () => {}, null),
                TypeError,
                'Invalid options: must be an object',
              );
            },
          },
          {
            name: 'Error 5: Parameter eventName pada publish bukan non-empty string',
            fn: () => {
              const bus = new ResilientEventBus();
              assertSyncError(
                () => bus.publish(123),
                TypeError,
                'Invalid eventName: must be a non-empty string',
              );
              assertSyncError(
                () => bus.publish('   '),
                TypeError,
                'Invalid eventName: must be a non-empty string',
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
