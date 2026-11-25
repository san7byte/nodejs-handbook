// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
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

function assertDeepEqual(actual, expected, message = '') {
  if (actual === expected) return;

  if (typeof actual !== typeof expected) {
    throw new Error(`${message} - Type mismatch: expected ${typeof expected}, got ${typeof actual}`);
  }

  if (actual === null || expected === null || typeof actual !== 'object') {
    throw new Error(`${message} - Value mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      throw new Error(`${message} - Expected array, got non-array`);
    }
    if (actual.length !== expected.length) {
      throw new Error(`${message} - Array length mismatch: expected ${expected.length}, got ${actual.length}`);
    }
    for (let i = 0; i < expected.length; i++) {
      assertDeepEqual(actual[i], expected[i], `${message}[${i}]`);
    }
    return;
  }

  const expectedKeys = Object.keys(expected);
  const actualKeys = Object.keys(actual);
  for (const key of expectedKeys) {
    if (!Object.prototype.hasOwnProperty.call(actual, key)) {
      throw new Error(`${message} - Missing property: ${key}`);
    }
    assertDeepEqual(actual[key], expected[key], `${message}.${key}`);
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

// -----------------------------------------------------------------------------
// Test Suite Soal 01
// -----------------------------------------------------------------------------
async function runSuite01() {
  console.log('\n============================================================');
  console.log('Soal 01: Delayed Promise Resolver');
  console.log('============================================================');

  const { mod, filename, error } = await loadExerciseModule('01');
  if (error) {
    console.log(`[FAIL] Load module: ${error}`);
    return { passed: 0, failed: 9 };
  }

  const { resolveWithDelay } = mod;
  if (typeof resolveWithDelay !== 'function') {
    console.log(`[FAIL] Function 'resolveWithDelay' tidak ditemukan di ${filename}`);
    return { passed: 0, failed: 9 };
  }

  let passed = 0;
  let failed = 0;

  const scenarios = [
    {
      name: 'Normal 1: Resolve nilai string dengan jeda waktu tertentu',
      fn: async () => {
        const result = await resolveWithDelay(15, 'custom-result');
        assertDeepEqual(result, 'custom-result', 'Result mismatch');
      },
    },
    {
      name: 'Normal 2: Menggunakan default value saat argumen tidak diberi',
      fn: async () => {
        const result = await resolveWithDelay(10);
        assertDeepEqual(result, 'OK', 'Default value mismatch');
      },
    },
    {
      name: 'Normal 3: Resolve objek kompleks setelah jeda waktu',
      fn: async () => {
        const payload = { status: 200, message: 'Success' };
        const result = await resolveWithDelay(10, payload);
        assertDeepEqual(result, payload, 'Complex payload mismatch');
      },
    },
    {
      name: 'Edge 1: Jeda waktu 0 ms segera me-resolve payload',
      fn: async () => {
        const result = await resolveWithDelay(0, 'immediate-resolve');
        assertDeepEqual(result, 'immediate-resolve', 'Zero delay mismatch');
      },
    },
    {
      name: 'Edge 2: Payload bernilai null tetap di-resolve apa adanya',
      fn: async () => {
        const result = await resolveWithDelay(10, null);
        assertDeepEqual(result, null, 'Null payload mismatch');
      },
    },
    {
      name: 'Error 1: Argumen delay bertipe string melempar TypeError',
      fn: async () => {
        await assertAsyncError(() => resolveWithDelay('50'), TypeError, 'Delay must be a number');
      },
    },
    {
      name: 'Error 2: Argumen delay bernilai NaN melempar TypeError',
      fn: async () => {
        await assertAsyncError(() => resolveWithDelay(NaN), TypeError, 'Delay must be a number');
      },
    },
    {
      name: 'Error 3: Argumen delay bernilai negatif melempar RangeError',
      fn: async () => {
        await assertAsyncError(() => resolveWithDelay(-10), RangeError, 'Delay must be a non-negative integer');
      },
    },
    {
      name: 'Error 4: Argumen delay bernilai desimal melempar RangeError',
      fn: async () => {
        await assertAsyncError(() => resolveWithDelay(12.34), RangeError, 'Delay must be a non-negative integer');
      },
    },
  ];

  for (const s of scenarios) {
    try {
      await runWithTimeout(s.fn, 1500);
      console.log(`  [PASS] ${s.name}`);
      passed += 1;
    } catch (err) {
      console.log(`  [FAIL] ${s.name}: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\nSoal 01: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// -----------------------------------------------------------------------------
// Test Suite Soal 02
// -----------------------------------------------------------------------------
async function runSuite02() {
  console.log('\n============================================================');
  console.log('Soal 02: Asynchronous Task Timeout Guard');
  console.log('============================================================');

  const { mod, filename, error } = await loadExerciseModule('02');
  if (error) {
    console.log(`[FAIL] Load module: ${error}`);
    return { passed: 0, failed: 11 };
  }

  const { executeWithTimeout } = mod;
  if (typeof executeWithTimeout !== 'function') {
    console.log(`[FAIL] Function 'executeWithTimeout' tidak ditemukan di ${filename}`);
    return { passed: 0, failed: 11 };
  }

  let passed = 0;
  let failed = 0;

  const scenarios = [
    {
      name: 'Normal 1: Task asinkron selesai sebelum batas timeout',
      fn: async () => {
        const result = await executeWithTimeout(async () => {
          await new Promise((r) => setTimeout(r, 15));
          return 'fast-done';
        }, 80);
        assertDeepEqual(result, 'fast-done', 'Fast async result mismatch');
      },
    },
    {
      name: 'Normal 2: Task sinkron langsung mengembalikan nilai',
      fn: async () => {
        const result = await executeWithTimeout(() => 42, 80);
        assertDeepEqual(result, 42, 'Synchronous task result mismatch');
      },
    },
    {
      name: 'Normal 3: Task menerima context { signal } dan sukses',
      fn: async () => {
        const result = await executeWithTimeout(async ({ signal }) => {
          if (!signal || !(signal instanceof AbortSignal)) {
            throw new Error('Signal missing');
          }
          return 'has-signal';
        }, 80);
        assertDeepEqual(result, 'has-signal', 'Signal object mismatch');
      },
    },
    {
      name: 'Edge 1: Task melempar error internal diteruskan apa adanya',
      fn: async () => {
        await assertAsyncError(
          () => executeWithTimeout(async () => { throw new Error('Database connection lost'); }, 80),
          Error,
          'Database connection lost',
        );
      },
    },
    {
      name: 'Edge 2: Task melebihi batas waktu melempar timeout error',
      fn: async () => {
        await assertAsyncError(
          () =>
            executeWithTimeout(
              async () => {
                await new Promise((r) => setTimeout(r, 80));
                return 'never';
              },
              20,
            ),
          Error,
          'Operation timed out after 20ms',
        );
      },
    },
    {
      name: 'Edge 3: Dibatalkan via customSignal melempar abort error',
      fn: async () => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 15);
        await assertAsyncError(
          () =>
            executeWithTimeout(
              async () => {
                await new Promise((r) => setTimeout(r, 100));
                return 'never';
              },
              150,
              controller.signal,
            ),
          Error,
          'Operation aborted by user',
        );
      },
    },
    {
      name: 'Error 1: Parameter taskFn bukan function melempar TypeError',
      fn: async () => {
        await assertAsyncError(() => executeWithTimeout('not-a-fn', 50), TypeError, 'Task must be a function');
      },
    },
    {
      name: 'Error 2: Parameter timeoutMs bukan number melempar TypeError',
      fn: async () => {
        await assertAsyncError(() => executeWithTimeout(() => {}, '50'), TypeError, 'Timeout must be a number');
      },
    },
    {
      name: 'Error 3: Parameter timeoutMs bernilai 0 melempar RangeError',
      fn: async () => {
        await assertAsyncError(() => executeWithTimeout(() => {}, 0), RangeError, 'Timeout must be a positive integer');
      },
    },
    {
      name: 'Error 4: Parameter timeoutMs bernilai negatif (RangeError)',
      fn: async () => {
        await assertAsyncError(() => executeWithTimeout(() => {}, -10), RangeError, 'Timeout must be a positive integer');
      },
    },
    {
      name: 'Error 5: Parameter customSignal bukan AbortSignal (TypeError)',
      fn: async () => {
        await assertAsyncError(() => executeWithTimeout(() => {}, 50, {}), TypeError, 'Signal must be an AbortSignal');
      },
    },
  ];

  for (const s of scenarios) {
    try {
      await runWithTimeout(s.fn, 1500);
      console.log(`  [PASS] ${s.name}`);
      passed += 1;
    } catch (err) {
      console.log(`  [FAIL] ${s.name}: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\nSoal 02: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// -----------------------------------------------------------------------------
// Test Suite Soal 03
// -----------------------------------------------------------------------------
async function runSuite03() {
  console.log('\n============================================================');
  console.log('Soal 03: Contextual Async Task Queue');
  console.log('============================================================');

  const { mod, filename, error } = await loadExerciseModule('03');
  if (error) {
    console.log(`[FAIL] Load module: ${error}`);
    return { passed: 0, failed: 12 };
  }

  const { ContextualTaskQueue } = mod;
  if (typeof ContextualTaskQueue !== 'function') {
    console.log(`[FAIL] Class 'ContextualTaskQueue' tidak ditemukan di ${filename}`);
    return { passed: 0, failed: 12 };
  }

  let passed = 0;
  let failed = 0;

  const scenarios = [
    {
      name: 'Normal 1: Enqueue satu task dan me-resolve nilainya',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        const result = await queue.enqueue(async () => 'task-one-done', { id: 'task-1' });
        assertDeepEqual(result, 'task-one-done', 'Single task result mismatch');
      },
    },
    {
      name: 'Normal 2: Enqueue multiple tasks berjalan berurutan',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        const p1 = queue.enqueue(async () => 'val-1', { id: 't-1' });
        const p2 = queue.enqueue(async () => 'val-2', { id: 't-2' });
        const [r1, r2] = await Promise.all([p1, p2]);
        assertDeepEqual(r1, 'val-1', 'Task 1 result mismatch');
        assertDeepEqual(r2, 'val-2', 'Task 2 result mismatch');
      },
    },
    {
      name: 'Normal 3: getActiveContext() di dalam task membaca konteks',
      fn: async () => {
        const queue = new ContextualTaskQueue({ name: 'priority-queue' });
        const result = await queue.enqueue(
          async () => {
            const ctx = queue.getActiveContext();
            return ctx;
          },
          { id: 'ctx-test', tenant: 'tenant-a' },
        );
        assertDeepEqual(result.id, 'ctx-test', 'Context ID mismatch');
        assertDeepEqual(result.tenant, 'tenant-a', 'Context property mismatch');
        assertDeepEqual(result.queueName, 'priority-queue', 'Context queueName mismatch');
      },
    },
    {
      name: 'Normal 4: Getter size bernilai 0 setelah semua task tuntas',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        await queue.enqueue(async () => 1, { id: 't-size' });
        assertDeepEqual(queue.size, 0, 'Queue size should be 0 after completion');
      },
    },
    {
      name: 'Edge 1: getActiveContext() di luar task mengembalikan null',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        const ctx = queue.getActiveContext();
        assertDeepEqual(ctx, null, 'Active context outside task should be null');
      },
    },
    {
      name: 'Edge 2: Satu task melempar error tidak merusak task lain',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        const pFail = queue.enqueue(async () => {
          throw new Error('Task computation failed');
        }, { id: 'fail-task' });

        const pSuccess = queue.enqueue(async () => 'success-payload', { id: 'success-task' });

        await assertAsyncError(() => pFail, Error, 'Task computation failed');
        const res = await pSuccess;
        assertDeepEqual(res, 'success-payload', 'Subsequent task result mismatch');
      },
    },
    {
      name: 'Edge 3: Inisialisasi default name bernilai \'task-queue\'',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        assertDeepEqual(queue.name, 'task-queue', 'Default queue name mismatch');
      },
    },
    {
      name: 'Error 1: Konstruktor dengan options bukan object',
      fn: async () => {
        assertSyncError(() => new ContextualTaskQueue('invalid'), TypeError, 'Options must be an object');
      },
    },
    {
      name: 'Error 2: Konstruktor dengan options.name bukan string',
      fn: async () => {
        assertSyncError(() => new ContextualTaskQueue({ name: 123 }), TypeError, 'Queue name must be a string');
      },
    },
    {
      name: 'Error 3: enqueue() dengan taskFn bukan function',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        assertSyncError(() => queue.enqueue(null, { id: 't-1' }), TypeError, 'Task must be a function');
      },
    },
    {
      name: 'Error 4: enqueue() dengan metadata bukan object',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        assertSyncError(() => queue.enqueue(() => {}, null), TypeError, 'Metadata must be an object');
      },
    },
    {
      name: 'Error 5: enqueue() dengan metadata.id kosong',
      fn: async () => {
        const queue = new ContextualTaskQueue();
        assertSyncError(() => queue.enqueue(() => {}, { id: '   ' }), TypeError, 'Task ID must be a non-empty string');
      },
    },
  ];

  for (const s of scenarios) {
    try {
      await runWithTimeout(s.fn, 1500);
      console.log(`  [PASS] ${s.name}`);
      passed += 1;
    } catch (err) {
      console.log(`  [FAIL] ${s.name}: ${err.message}`);
      failed += 1;
    }
  }

  console.log(`\nSoal 03: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// -----------------------------------------------------------------------------
// Runner Orchestrator
// -----------------------------------------------------------------------------
async function executeTestSuite() {
  const targetSuites = parseCliArgs();
  if (!targetSuites) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  let grandTotalPassed = 0;
  let grandTotalFailed = 0;

  for (const suiteId of targetSuites) {
    let result = { passed: 0, failed: 0 };
    if (suiteId === '01') {
      result = await runSuite01();
    } else if (suiteId === '02') {
      result = await runSuite02();
    } else if (suiteId === '03') {
      result = await runSuite03();
    }

    grandTotalPassed += result.passed;
    grandTotalFailed += result.failed;
  }

  if (targetSuites.length > 1) {
    console.log('\n============================================================');
    console.log(`Total Keseluruhan: ${grandTotalPassed} passed, ${grandTotalFailed} failed`);
    console.log('============================================================');
  }

  if (grandTotalFailed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

await executeTestSuite();
