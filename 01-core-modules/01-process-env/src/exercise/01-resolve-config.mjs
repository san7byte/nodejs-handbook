import process from 'node:process';

/**
 * ============================================================================
 * SOAL 01: Application Config & CLI Arguments Resolver
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Fungsi `resolveAppConfig(defaultPort = 3000)` bertugas memprioritaskan
 *    sumber konfigurasi port dari: CLI argument (`--port <val>`), lalu environment
 *    variable (`PORT`), dan fallback ke `defaultPort`. Selain itu, tentukan mode
 *    lingkungan runtime dari `NODE_ENV`.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:process`: `process.argv`, `process.env`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Prioritas Nilai Port: CLI Flag `--port` > `process.env.PORT` > `defaultPort`.
 *    - Parsing CLI Arguments: Periksa apakah `--port` ada di `process.argv.slice(2)`.
 *      Jika ada, ambil nilai argumen persis setelahnya.
 *    - Validasi Port: Port wajib berupa integer valid di antara rentang 1 s.d. 65535.
 *      Jika nilai port bukan angka atau di luar batas (contoh: 0, 99999, 'abc'),
 *      lempar `Error('Invalid port number')`.
 *    - Penentuan Mode Environment:
 *      - Ambil `env` dari `process.env.NODE_ENV || 'development'`.
 *      - `isProduction` bernilai `true` jika `env === 'production'`, selain itu `false`.
 *    - Kembalikan objek: `{ port: number, env: string, isProduction: boolean }`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬────────────────────────────────┬──────────────────────────┬──────────────────┬────────────────────────────────────────────────────────┐
 * │ Skenario  │ process.argv                   │ process.env              │ defaultPort      │ Output / Expected Behavior                             │
 * ├───────────┼────────────────────────────────┼──────────────────────────┼──────────────────┼────────────────────────────────────────────────────────┤
 * │ Normal 1  │ ['node', 'app.mjs']            │ {}                       │ (default 3000)   │ { port: 3000, env: 'development', isProduction: false }│
 * │ Normal 2  │ ['node', 'app.mjs']            │ {}                       │ 5000             │ { port: 5000, env: 'development', isProduction: false }│
 * │ Normal 3  │ ['node', 'app', '--port', 6000]│ { NODE_ENV: 'production' }│ 3000            │ { port: 6000, env: 'production', isProduction: true }  │
 * │ Edge 1    │ ['node', 'app.mjs']            │ { PORT: '8080' }         │ 5000             │ { port: 8080, env: 'development', isProduction: false }│
 * │ Edge 2    │ ['node', 'app', '--port', 4200]│ { PORT: '8080' }         │ 3000             │ { port: 4200, env: 'development', isProduction: false }│
 * │ Error 1   │ ['node', 'app.mjs']            │ {}                       │ 'not-a-number'   │ Lempar Error('Invalid port number')                    │
 * │ Error 2   │ ['node', 'app.mjs']            │ {}                       │ 99999            │ Lempar Error('Invalid port number')                    │
 * │ Error 3   │ ['node', 'app.mjs']            │ {}                       │ 0                │ Lempar Error('Invalid port number')                    │
 * └───────────┴────────────────────────────────┴──────────────────────────┴──────────────────┴────────────────────────────────────────────────────────┘
 */

export function resolveAppConfig(defaultPort = 3000) {
  const args = process.argv.slice(2);
  const indexPort = args.indexOf('--port');
  const cliPort = indexPort !== -1 ? args[indexPort + 1] : undefined;

  const port = Number(cliPort ?? process.env.PORT ?? defaultPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid port number');
  }

  const env = process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  return {
    port,
    env,
    isProduction,
  };
}

// ============================================================================
// TEST RUNNER (ISOLATED)
// ============================================================================

const originalArgv = [...process.argv];
const originalEnv = { ...process.env };

let passedCount = 0;
let failedCount = 0;

function resetEnv() {
  process.argv = ['node', '01-resolve-config.mjs'];
  delete process.env.PORT;
  delete process.env.NODE_ENV;
}

function runTest(scenarioName, testFn) {
  try {
    resetEnv();
    testFn();
    console.log(`[PASS] ${scenarioName}`);
    passedCount++;
  } catch (err) {
    console.log(`[FAIL] ${scenarioName}: ${err.message}`);
    failedCount++;
  } finally {
    process.argv = [...originalArgv];
    process.env = { ...originalEnv };
  }
}

console.log('=== TEST SOAL 01: resolveAppConfig ===\n');

// 1. Skenario Normal 1: Default fallback tanpa CLI dan tanpa env
runTest('Skenario Normal 1: Default Fallback', () => {
  const result = resolveAppConfig();
  if (result.port !== 3000)
    throw new Error(`Expected port 3000, got ${result.port}`);
  if (result.env !== 'development')
    throw new Error(`Expected env development, got ${result.env}`);
  if (result.isProduction !== false)
    throw new Error(`Expected isProduction false, got ${result.isProduction}`);
});

// 2. Skenario Normal 2: Custom defaultPort
runTest('Skenario Normal 2: Custom defaultPort Parameter', () => {
  const result = resolveAppConfig(5000);
  if (result.port !== 5000)
    throw new Error(`Expected port 5000, got ${result.port}`);
  if (result.env !== 'development')
    throw new Error(`Expected env development, got ${result.env}`);
  if (result.isProduction !== false)
    throw new Error(`Expected isProduction false, got ${result.isProduction}`);
});

// 3. Skenario Normal 3: CLI Flag + Production Environment
runTest('Skenario Normal 3: CLI Flag & Production Env', () => {
  process.argv = ['node', '01-resolve-config.mjs', '--port', '6000'];
  process.env.NODE_ENV = 'production';
  const result = resolveAppConfig();
  if (result.port !== 6000)
    throw new Error(`Expected port 6000, got ${result.port}`);
  if (result.env !== 'production')
    throw new Error(`Expected env production, got ${result.env}`);
  if (result.isProduction !== true)
    throw new Error(`Expected isProduction true, got ${result.isProduction}`);
});

// 4. Skenario Edge 1: process.env.PORT override defaultPort
runTest('Skenario Edge 1: Env PORT Override Default', () => {
  process.env.PORT = '8080';
  const result = resolveAppConfig(5000);
  if (result.port !== 8080)
    throw new Error(`Expected port 8080, got ${result.port}`);
});

// 5. Skenario Edge 2: CLI Flag prioritas di atas process.env.PORT
runTest('Skenario Edge 2: CLI Flag Priority over Env Variable', () => {
  process.argv = ['node', '01-resolve-config.mjs', '--port', '4200'];
  process.env.PORT = '8080';
  const result = resolveAppConfig(3000);
  if (result.port !== 4200)
    throw new Error(`Expected port 4200, got ${result.port}`);
});

// 6. Skenario Error 1: Port bukan angka
runTest('Skenario Error 1: Port Bukan Angka', () => {
  let thrown = false;
  try {
    resolveAppConfig('not-a-number');
  } catch (err) {
    thrown = true;
    if (err.message !== 'Invalid port number') {
      throw new Error(`Expected 'Invalid port number', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Harus melempar error saat port bukan angka');
});

// 7. Skenario Error 2: Port di atas batas (99999)
runTest('Skenario Error 2: Port di Atas Batas 65535', () => {
  let thrown = false;
  try {
    resolveAppConfig(99999);
  } catch (err) {
    thrown = true;
    if (err.message !== 'Invalid port number') {
      throw new Error(`Expected 'Invalid port number', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Harus melempar error saat port > 65535');
});

// 8. Skenario Error 3: Port di bawah batas (0)
runTest('Skenario Error 3: Port di Bawah Batas 1', () => {
  let thrown = false;
  try {
    resolveAppConfig(0);
  } catch (err) {
    thrown = true;
    if (err.message !== 'Invalid port number') {
      throw new Error(`Expected 'Invalid port number', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Harus melempar error saat port < 1');
});

console.log('\n--------------------------------------------------');
console.log(
  `Ringkasan: ${passedCount} / ${passedCount + failedCount} lulus (${failedCount} gagal)`,
);
console.log('--------------------------------------------------');

if (failedCount > 0) {
  process.exitCode = 1;
}
