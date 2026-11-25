// Penggunaan:
//   node test.mjs       -> Menjalankan semua test (01, 02, 03)
//   node test.mjs 01    -> Hanya menjalankan test Soal 01
//   node test.mjs 02    -> Hanya menjalankan test Soal 02
//   node test.mjs 03    -> Hanya menjalankan test Soal 03

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
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
      file.startsWith(`${prefix}-` || `${prefix}.`) &&
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
  if (expectedMessage && thrown.message !== expectedMessage) {
    throw new Error(`Expected error message '${expectedMessage}', got: '${thrown.message}'`);
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
  if (expectedMessage && thrown.message !== expectedMessage) {
    throw new Error(`Expected error message '${expectedMessage}', got: '${thrown.message}'`);
  }
}

function createMockResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    statusMessage: '',
    headers,
    body: '',
    headersSent: false,
    setHeader(name, value) {
      if (this.headersSent) {
        const err = new Error('Cannot set headers after they are sent to the client');
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
    hasHeader(name) {
      return headers.has(String(name).toLowerCase());
    },
    removeHeader(name) {
      if (this.headersSent) {
        const err = new Error('Cannot remove headers after they are sent to the client');
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      headers.delete(String(name).toLowerCase());
    },
    writeHead(statusCode, statusMessage, headersObj) {
      if (this.headersSent) {
        const err = new Error('Cannot set headers after they are sent to the client');
        err.code = 'ERR_HTTP_HEADERS_SENT';
        throw err;
      }
      this.statusCode = statusCode;
      if (typeof statusMessage === 'object' && headersObj === undefined) {
        headersObj = statusMessage;
        statusMessage = undefined;
      }
      if (statusMessage) this.statusMessage = statusMessage;
      if (headersObj) {
        for (const [k, v] of Object.entries(headersObj)) {
          this.setHeader(k, v);
        }
      }
      this.headersSent = true;
      return this;
    },
    end(chunk) {
      this.headersSent = true;
      if (chunk !== undefined && chunk !== null) {
        this.body += String(chunk);
      }
      return this;
    },
  };
}

function createMockRequest({ method = 'POST', url = '/', headers = {}, chunks = [] } = {}) {
  const stream = new Readable({
    read() {
      if (chunks.length > 0) {
        const chunk = chunks.shift();
        this.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      } else {
        this.push(null);
      }
    },
  });
  stream.method = method;
  stream.url = url;
  stream.headers = { ...headers };
  return stream;
}

// -----------------------------------------------------------------------------
// Test Suite Soal 01: sendJsonResponse
// -----------------------------------------------------------------------------
async function runSuite01() {
  console.log('\n============================================================');
  console.log('Soal 01: HTTP JSON Response Responder');
  console.log('============================================================');

  const { mod, filename, error } = await loadExerciseModule('01');
  if (error) {
    console.log(`[FAIL] Load module: ${error}`);
    return { passed: 0, failed: 13 };
  }

  const { sendJsonResponse } = mod;
  if (typeof sendJsonResponse !== 'function') {
    console.log(`[FAIL] Function 'sendJsonResponse' tidak ditemukan di ${filename}`);
    return { passed: 0, failed: 13 };
  }

  let passed = 0;
  let failed = 0;

  const tests = [
    {
      name: 'Normal 1: Kirim JSON payload status 200 dan Content-Type default',
      fn: () => {
        const res = createMockResponse();
        sendJsonResponse(res, 200, { success: true });
        if (res.statusCode !== 200) throw new Error(`Expected statusCode 200, got ${res.statusCode}`);
        if (res.getHeader('content-type') !== 'application/json; charset=utf-8') {
          throw new Error(`Expected Content-Type 'application/json; charset=utf-8', got '${res.getHeader('content-type')}'`);
        }
        if (res.body !== '{"success":true}') throw new Error(`Expected body '{"success":true}', got '${res.body}'`);
      },
    },
    {
      name: 'Normal 2: Kirim status 201 dengan custom header kustom',
      fn: () => {
        const res = createMockResponse();
        sendJsonResponse(res, 201, { id: 1 }, { 'X-Id': 'A' });
        if (res.statusCode !== 201) throw new Error(`Expected statusCode 201, got ${res.statusCode}`);
        if (res.getHeader('x-id') !== 'A') throw new Error(`Expected header X-Id 'A', got '${res.getHeader('x-id')}'`);
        if (res.body !== '{"id":1}') throw new Error(`Expected body '{"id":1}', got '${res.body}'`);
      },
    },
    {
      name: 'Normal 3: Kirim status 204 dengan payload undefined menghasilkan body kosong',
      fn: () => {
        const res = createMockResponse();
        sendJsonResponse(res, 204, undefined);
        if (res.statusCode !== 204) throw new Error(`Expected statusCode 204, got ${res.statusCode}`);
        if (res.body !== '') throw new Error(`Expected empty body '', got '${res.body}'`);
      },
    },
    {
      name: 'Edge 1: Payload null di-serialize menjadi string "null"',
      fn: () => {
        const res = createMockResponse();
        sendJsonResponse(res, 200, null);
        if (res.body !== 'null') throw new Error(`Expected body 'null', got '${res.body}'`);
      },
    },
    {
      name: 'Edge 2: Payload array di-serialize menjadi string JSON array',
      fn: () => {
        const res = createMockResponse();
        sendJsonResponse(res, 200, [1, 2, 3]);
        if (res.body !== '[1,2,3]') throw new Error(`Expected body '[1,2,3]', got '${res.body}'`);
      },
    },
    {
      name: 'Edge 3: Payload string di-serialize menjadi JSON string ter-escape',
      fn: () => {
        const res = createMockResponse();
        sendJsonResponse(res, 200, 'text-payload');
        if (res.body !== '"text-payload"') throw new Error(`Expected body '"text-payload"', got '${res.body}'`);
      },
    },
    {
      name: 'Error 1: Argumen res bernilai null melempar TypeError',
      fn: () => {
        assertSyncError(() => sendJsonResponse(null, 200, {}), TypeError, 'Invalid ServerResponse object');
      },
    },
    {
      name: 'Error 2: Argumen res tanpa method setHeader atau end melempar TypeError',
      fn: () => {
        assertSyncError(() => sendJsonResponse({}, 200, {}), TypeError, 'Invalid ServerResponse object');
      },
    },
    {
      name: 'Error 3: Status code berupa string melempar TypeError',
      fn: () => {
        const res = createMockResponse();
        assertSyncError(() => sendJsonResponse(res, '200', {}), TypeError, 'Status code must be a valid integer');
      },
    },
    {
      name: 'Error 4: Status code berupa angka desimal melempar TypeError',
      fn: () => {
        const res = createMockResponse();
        assertSyncError(() => sendJsonResponse(res, 200.5, {}), TypeError, 'Status code must be a valid integer');
      },
    },
    {
      name: 'Error 5: Status code di luar kode HTTP resmi melempar RangeError',
      fn: () => {
        const res = createMockResponse();
        assertSyncError(() => sendJsonResponse(res, 999, {}), RangeError, 'Unsupported HTTP status code');
      },
    },
    {
      name: 'Error 6: Argumen headers bukan objek (string) melempar TypeError',
      fn: () => {
        const res = createMockResponse();
        assertSyncError(() => sendJsonResponse(res, 200, {}, 'invalid-header'), TypeError, 'Headers must be an object');
      },
    },
    {
      name: 'Error 7: Argumen headers bernilai null melempar TypeError',
      fn: () => {
        const res = createMockResponse();
        assertSyncError(() => sendJsonResponse(res, 200, {}, null), TypeError, 'Headers must be an object');
      },
    },
  ];

  for (const t of tests) {
    try {
      await runWithTimeout(() => t.fn());
      console.log(`[PASS] ${t.name}`);
      passed++;
    } catch (err) {
      const reason = err.message === 'Not implemented' ? 'Not implemented yet' : err.message;
      console.log(`[FAIL] ${t.name} -> ${reason}`);
      failed++;
    }
  }

  console.log(`\nSoal 01: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// -----------------------------------------------------------------------------
// Test Suite Soal 02: parseJsonBody
// -----------------------------------------------------------------------------
async function runSuite02() {
  console.log('\n============================================================');
  console.log('Soal 02: HTTP Safe Body Parser & Size Guard');
  console.log('============================================================');

  const { mod, filename, error } = await loadExerciseModule('02');
  if (error) {
    console.log(`[FAIL] Load module: ${error}`);
    return { passed: 0, failed: 13 };
  }

  const { parseJsonBody } = mod;
  if (typeof parseJsonBody !== 'function') {
    console.log(`[FAIL] Function 'parseJsonBody' tidak ditemukan di ${filename}`);
    return { passed: 0, failed: 13 };
  }

  let passed = 0;
  let failed = 0;

  const tests = [
    {
      name: 'Normal 1: Parse valid JSON object dari incoming stream',
      fn: async () => {
        const req = createMockRequest({ chunks: ['{"user":"alice"}'] });
        const result = await parseJsonBody(req);
        assertDeepEqual(result, { user: 'alice' });
      },
    },
    {
      name: 'Normal 2: Parse nested JSON object kompleks',
      fn: async () => {
        const req = createMockRequest({ chunks: ['{"config":{"port":8080}}'] });
        const result = await parseJsonBody(req);
        assertDeepEqual(result, { config: { port: 8080 } });
      },
    },
    {
      name: 'Normal 3: Parse JSON array',
      fn: async () => {
        const req = createMockRequest({ chunks: ['[1, 2, 3]'] });
        const result = await parseJsonBody(req);
        assertDeepEqual(result, [1, 2, 3]);
      },
    },
    {
      name: 'Edge 1: Stream kosong (0 bytes) me-resolve objek kosong {}',
      fn: async () => {
        const req = createMockRequest({ chunks: [] });
        const result = await parseJsonBody(req);
        assertDeepEqual(result, {});
      },
    },
    {
      name: 'Edge 2: Stream berisi whitespace saja me-resolve objek kosong {}',
      fn: async () => {
        const req = createMockRequest({ chunks: ['   '] });
        const result = await parseJsonBody(req);
        assertDeepEqual(result, {});
      },
    },
    {
      name: 'Edge 3: Chunk terfragmentasi dalam potongan-potongan terpisah di-assemble utuh',
      fn: async () => {
        const req = createMockRequest({ chunks: ['{"ke', 'y":', '123}'] });
        const result = await parseJsonBody(req);
        assertDeepEqual(result, { key: 123 });
      },
    },
    {
      name: 'Edge 4: Ukuran payload tepat sama dengan maxSizeBytes berhasil di-parse',
      fn: async () => {
        const payload = '{"a":1}'; // 7 bytes
        const req = createMockRequest({ chunks: [payload] });
        const result = await parseJsonBody(req, 7);
        assertDeepEqual(result, { a: 1 });
      },
    },
    {
      name: 'Error 1: Argumen req bukan stream melempar TypeError',
      fn: async () => {
        await assertAsyncError(() => parseJsonBody(null), TypeError, 'Invalid request stream');
      },
    },
    {
      name: 'Error 2: maxSizeBytes negatif melempar TypeError',
      fn: async () => {
        const req = createMockRequest();
        await assertAsyncError(() => parseJsonBody(req, -10), TypeError, 'Max size must be a positive integer');
      },
    },
    {
      name: 'Error 3: maxSizeBytes 0 melempar TypeError',
      fn: async () => {
        const req = createMockRequest();
        await assertAsyncError(() => parseJsonBody(req, 0), TypeError, 'Max size must be a positive integer');
      },
    },
    {
      name: 'Error 4: Content-Length header melebihi batas menolak dengan RangeError',
      fn: async () => {
        const req = createMockRequest({ headers: { 'content-length': '50' } });
        await assertAsyncError(() => parseJsonBody(req, 20), RangeError, 'Payload exceeds maximum allowed size');
      },
    },
    {
      name: 'Error 5: Akumulasi chunk melebihi maxSizeBytes menolak dengan RangeError',
      fn: async () => {
        const req = createMockRequest({ chunks: ['0123456789', '0123456789', '0123456789'] }); // 30 bytes
        await assertAsyncError(() => parseJsonBody(req, 15), RangeError, 'Payload exceeds maximum allowed size');
      },
    },
    {
      name: 'Error 6: Format JSON malformed menolak dengan SyntaxError',
      fn: async () => {
        const req = createMockRequest({ chunks: ['{ bad: json '] });
        await assertAsyncError(() => parseJsonBody(req), SyntaxError, 'Malformed JSON payload');
      },
    },
  ];

  for (const t of tests) {
    try {
      await runWithTimeout(() => t.fn());
      console.log(`[PASS] ${t.name}`);
      passed++;
    } catch (err) {
      const reason = err.message === 'Not implemented' ? 'Not implemented yet' : err.message;
      console.log(`[FAIL] ${t.name} -> ${reason}`);
      failed++;
    }
  }

  console.log(`\nSoal 02: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// -----------------------------------------------------------------------------
// Test Suite Soal 03: MiniHttpRouter
// -----------------------------------------------------------------------------
async function runSuite03() {
  console.log('\n============================================================');
  console.log('Soal 03: Mini HTTP Dispatcher & Router');
  console.log('============================================================');

  const { mod, filename, error } = await loadExerciseModule('03');
  if (error) {
    console.log(`[FAIL] Load module: ${error}`);
    return { passed: 0, failed: 14 };
  }

  const { MiniHttpRouter } = mod;
  if (typeof MiniHttpRouter !== 'function') {
    console.log(`[FAIL] Class 'MiniHttpRouter' tidak ditemukan di ${filename}`);
    return { passed: 0, failed: 14 };
  }

  let passed = 0;
  let failed = 0;

  const tests = [
    {
      name: 'Normal 1: Dispatch GET /health memanggil handler dan mengembalikan status 200',
      fn: async () => {
        const router = new MiniHttpRouter();
        router.register('GET', '/health', (req, res) => {
          res.writeHead(200);
          res.end('healthy');
        });
        const req = createMockRequest({ method: 'GET', url: '/health' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (res.statusCode !== 200) throw new Error(`Expected 200, got ${res.statusCode}`);
        if (res.body !== 'healthy') throw new Error(`Expected 'healthy', got '${res.body}'`);
      },
    },
    {
      name: 'Normal 2: Dispatch POST /items memanggil handler dan mengembalikan status 201',
      fn: async () => {
        const router = new MiniHttpRouter();
        router.register('POST', '/items', (req, res) => {
          res.writeHead(201);
          res.end('created');
        });
        const req = createMockRequest({ method: 'POST', url: '/items' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (res.statusCode !== 201) throw new Error(`Expected 201, got ${res.statusCode}`);
        if (res.body !== 'created') throw new Error(`Expected 'created', got '${res.body}'`);
      },
    },
    {
      name: 'Normal 3: Method chaining register() mengembalikan instance router dan mendaftarkan rute',
      fn: () => {
        const router = new MiniHttpRouter();
        const chained = router
          .register('GET', '/a', () => {})
          .register('POST', '/b', () => {});
        if (chained !== router) throw new Error('Expected register() to return this');
        const routes = router.getRoutes();
        if (routes.length !== 2) throw new Error(`Expected 2 routes, got ${routes.length}`);
      },
    },
    {
      name: 'Edge 1: URL dengan query string tetap cocok dengan rute dasar',
      fn: async () => {
        const router = new MiniHttpRouter();
        let matched = false;
        router.register('GET', '/users', (req, res) => {
          matched = true;
          res.writeHead(200).end('ok');
        });
        const req = createMockRequest({ method: 'GET', url: '/users?role=admin&active=true' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (!matched) throw new Error('Route with query string failed to match');
      },
    },
    {
      name: 'Edge 2: Trailing slash pada request dinormalisasi agar cocok',
      fn: async () => {
        const router = new MiniHttpRouter();
        let matched = false;
        router.register('GET', '/users', (req, res) => {
          matched = true;
          res.writeHead(200).end('ok');
        });
        const req = createMockRequest({ method: 'GET', url: '/users/' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (!matched) throw new Error('Route with trailing slash failed to match');
      },
    },
    {
      name: 'Edge 3: Method request lowercase otomatis dikonversi ke uppercase',
      fn: async () => {
        const router = new MiniHttpRouter();
        let matched = false;
        router.register('GET', '/health', (req, res) => {
          matched = true;
          res.writeHead(200).end('ok');
        });
        const req = createMockRequest({ method: 'get', url: '/health' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (!matched) throw new Error('Lowercase request method failed to match');
      },
    },
    {
      name: 'Edge 4: Rute tidak ditemukan menghasilkan status 404 Not Found',
      fn: async () => {
        const router = new MiniHttpRouter();
        const req = createMockRequest({ method: 'GET', url: '/nonexistent' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (res.statusCode !== 404) throw new Error(`Expected 404, got ${res.statusCode}`);
        if (res.body !== 'Not Found') throw new Error(`Expected 'Not Found', got '${res.body}'`);
      },
    },
    {
      name: 'Edge 5: Path cocok tapi method berbeda menghasilkan status 405 dan header Allow',
      fn: async () => {
        const router = new MiniHttpRouter();
        router.register('GET', '/health', () => {});
        const req = createMockRequest({ method: 'DELETE', url: '/health' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (res.statusCode !== 405) throw new Error(`Expected 405, got ${res.statusCode}`);
        if (res.getHeader('allow') !== 'GET') throw new Error(`Expected Allow 'GET', got '${res.getHeader('allow')}'`);
        if (res.body !== 'Method Not Allowed') throw new Error(`Expected 'Method Not Allowed', got '${res.body}'`);
      },
    },
    {
      name: 'Edge 6: Exception di dalam handler ditangkap oleh error boundary dan menghasilkan 500',
      fn: async () => {
        const router = new MiniHttpRouter();
        router.register('GET', '/fail', () => {
          throw new Error('Database connection broke');
        });
        const req = createMockRequest({ method: 'GET', url: '/fail' });
        const res = createMockResponse();
        await router.handle(req, res);
        if (res.statusCode !== 500) throw new Error(`Expected 500, got ${res.statusCode}`);
        if (res.body !== 'Internal Server Error') throw new Error(`Expected 'Internal Server Error', got '${res.body}'`);
      },
    },
    {
      name: 'Error 1: Registrasi method invalid melempar TypeError',
      fn: () => {
        const router = new MiniHttpRouter();
        assertSyncError(() => router.register('INVALID_METHOD', '/a', () => {}), TypeError, 'Invalid HTTP method');
      },
    },
    {
      name: 'Error 2: Registrasi path tidak diawali "/" melempar TypeError',
      fn: () => {
        const router = new MiniHttpRouter();
        assertSyncError(() => router.register('GET', 'no-slash', () => {}), TypeError, 'Path must be a string starting with /');
      },
    },
    {
      name: 'Error 3: Registrasi handler bukan fungsi melempar TypeError',
      fn: () => {
        const router = new MiniHttpRouter();
        assertSyncError(() => router.register('GET', '/ok', 'not-a-func'), TypeError, 'Handler must be a function');
      },
    },
    {
      name: 'Error 4: Pemanggilan handle dengan req invalid melempar TypeError',
      fn: async () => {
        const router = new MiniHttpRouter();
        const res = createMockResponse();
        await assertAsyncError(() => router.handle(null, res), TypeError, 'Invalid request object');
      },
    },
    {
      name: 'Error 5: Pemanggilan handle dengan res invalid melempar TypeError',
      fn: async () => {
        const router = new MiniHttpRouter();
        const req = createMockRequest();
        await assertAsyncError(() => router.handle(req, null), TypeError, 'Invalid response object');
      },
    },
  ];

  for (const t of tests) {
    try {
      await runWithTimeout(() => t.fn());
      console.log(`[PASS] ${t.name}`);
      passed++;
    } catch (err) {
      const reason = err.message === 'Not implemented' ? 'Not implemented yet' : err.message;
      console.log(`[FAIL] ${t.name} -> ${reason}`);
      failed++;
    }
  }

  console.log(`\nSoal 03: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// -----------------------------------------------------------------------------
// Main Runner Orchestration
// -----------------------------------------------------------------------------
async function main() {
  const suitesToRun = parseCliArgs();
  if (!suitesToRun) {
    printUsage();
    process.exitCode = 2;
    return;
  }

  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of suitesToRun) {
    let result = { passed: 0, failed: 0 };
    if (suite === '01') {
      result = await runSuite01();
    } else if (suite === '02') {
      result = await runSuite02();
    } else if (suite === '03') {
      result = await runSuite03();
    }
    totalPassed += result.passed;
    totalFailed += result.failed;
  }

  if (suitesToRun.length > 1) {
    console.log('\n============================================================');
    console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
    console.log('============================================================');
  }

  if (totalFailed > 0) {
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}

main().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exitCode = 1;
});
