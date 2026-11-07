import process from 'node:process';

/**
 * ============================================================================
 * SOAL 02: Runtime Environment Validator & Exit Code Handler
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Fungsi `validateRuntimeEnvironment(requiredEnvKeys)` memvalidasi
 *    ketersediaan variabel lingkungan (`process.env`) sebelum aplikasi berjalan.
 *    Jika ada variabel wajib yang hilang atau kosong, set `process.exitCode = 1`
 *    dan kembalikan `false`. Jika semua lengkap, set `process.exitCode = 0`
 *    dan kembalikan `true`.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:process`: `process.env`, `process.exitCode`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Parameter `requiredEnvKeys` wajib berupa Array of strings. Jika bukan array,
 *      lempar `TypeError('requiredEnvKeys must be an array of strings')`.
 *    - Evaluasi Kelengkapan Nilai:
 *      Sebuah key dianggap hilang (*missing*) jika nilainya:
 *      1. `undefined`
 *      2. `null`
 *      3. String kosong atau hanya berisi spasi (`val.trim() === ''`).
 *    - Skenario Valid (Semua key ada dan bernilai valid):
 *      - Set `process.exitCode = 0`.
 *      - Kembalikan boolean `true`.
 *    - Skenario Tidak Valid (Ada satu atau lebih key yang hilang):
 *      - Set `process.exitCode = 1`.
 *      - Kembalikan boolean `false`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬──────────────────────────────────────────┬─────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ process.env                              │ requiredEnvKeys             │ Output / Expected Behavior                                             │
 * ├───────────┼──────────────────────────────────────────┼─────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ { APP_NAME: 'App', APP_PORT: '3000' }    │ ['APP_NAME', 'APP_PORT']    │ Returns true, process.exitCode = 0                                     │
 * │ Edge 1    │ { APP_NAME: 'App' }                      │ ['APP_NAME', 'SECRET_KEY']  │ Returns false, process.exitCode = 1 (Missing: SECRET_KEY)              │
 * │ Edge 2    │ { TOKEN: '   ' }                         │ ['TOKEN']                   │ Returns false, process.exitCode = 1 (Whitespace only treated as missing│
 * │ Edge 3    │ {}                                       │ ['KEY_A', 'KEY_B']          │ Returns false, process.exitCode = 1 (Missing: KEY_A, KEY_B)            │
 * │ Error 1   │ {}                                       │ 'not-an-array'              │ Lempar TypeError('requiredEnvKeys must be an array of strings')        │
 * └───────────┴──────────────────────────────────────────┴─────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
 */

export function validateRuntimeEnvironment(requiredEnvKeys) {
  if (!Array.isArray(requiredEnvKeys)) {
    throw new TypeError('requiredEnvKeys must be an array of strings');
  }

  const missingKeys = [];

  for (const key of requiredEnvKeys) {
    const val = process.env[key];

    if (val === undefined || val === null || val.trim() === '') {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    process.exitCode = 1;
    return false;
  }

  process.exitCode = 0;
  return true;
}

// ============================================================================
// TEST RUNNER (ISOLATED)
// ============================================================================

const originalEnv = { ...process.env };
const originalExitCode = process.exitCode;

let passedCount = 0;
let failedCount = 0;

function resetEnv() {
  process.exitCode = undefined;
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
    process.env = { ...originalEnv };
    process.exitCode = originalExitCode;
  }
}

console.log('=== TEST SOAL 02: validateRuntimeEnvironment ===\n');

// 1. Skenario Normal 1: Semua key valid
runTest('Skenario Normal 1: Semua Key Valid', () => {
  process.env.APP_NAME = 'PaymentGateway';
  process.env.APP_PORT = '3000';
  const result = validateRuntimeEnvironment(['APP_NAME', 'APP_PORT']);
  if (result !== true) throw new Error(`Expected result true, got ${result}`);
  if (process.exitCode !== 0) throw new Error(`Expected exitCode 0, got ${process.exitCode}`);
});

// 2. Skenario Edge 1: Key tidak disetel (undefined)
runTest('Skenario Edge 1: Key Hilang / Undefined', () => {
  delete process.env.SECRET_KEY;
  process.env.APP_NAME = 'PaymentGateway';
  const result = validateRuntimeEnvironment(['APP_NAME', 'SECRET_KEY']);
  if (result !== false) throw new Error(`Expected result false, got ${result}`);
  if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
});

// 3. Skenario Edge 2: Key bernilai spasi kosong
runTest('Skenario Edge 2: Key Bernilai String Kosong / Spasi', () => {
  process.env.EMPTY_TOKEN = '   ';
  const result = validateRuntimeEnvironment(['EMPTY_TOKEN']);
  if (result !== false) throw new Error(`Expected result false, got ${result}`);
  if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
});

// 4. Skenario Edge 3: Multiple keys hilang
runTest('Skenario Edge 3: Multi-Key Hilang Sekaligus', () => {
  delete process.env.KEY_A;
  delete process.env.KEY_B;
  const result = validateRuntimeEnvironment(['KEY_A', 'KEY_B']);
  if (result !== false) throw new Error(`Expected result false, got ${result}`);
  if (process.exitCode !== 1) throw new Error(`Expected exitCode 1, got ${process.exitCode}`);
});

// 5. Skenario Error 1: Input bukan array
runTest('Skenario Error 1: Parameter Bukan Array', () => {
  let thrown = false;
  try {
    validateRuntimeEnvironment('INVALID_ARG');
  } catch (err) {
    thrown = true;
    if (!(err instanceof TypeError)) throw new Error(`Expected TypeError, got ${err.name}`);
    if (!err.message.includes('must be an array of strings')) {
      throw new Error(`Expected 'must be an array of strings', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Harus melempar TypeError saat input bukan array');
});

console.log('\n--------------------------------------------------');
console.log(`Ringkasan: ${passedCount} / ${passedCount + failedCount} lulus (${failedCount} gagal)`);
console.log('--------------------------------------------------');

if (failedCount > 0) {
  process.exitCode = 1;
}
