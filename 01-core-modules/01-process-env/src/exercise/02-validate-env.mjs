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
 * ┌───────────┬─────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                             │ Input                                                  │ Expected                                                        │
 * ├───────────┼─────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ validateRuntimeEnvironment(['APP_NAME', 'APP_PORT'])    │ env: { APP_NAME: 'App', APP_PORT: '3000' }             │ Returns true, process.exitCode = 0                              │
 * │ Edge 1    │ validateRuntimeEnvironment(['APP_NAME', 'SECRET_KEY'])  │ env: { APP_NAME: 'App' }                               │ Returns false, process.exitCode = 1 (Missing: SECRET_KEY)       │
 * │ Edge 2    │ validateRuntimeEnvironment(['TOKEN'])                   │ env: { TOKEN: '   ' }                                  │ Returns false, process.exitCode = 1 (Whitespace treated as empty│
 * │ Edge 3    │ validateRuntimeEnvironment(['KEY_A', 'KEY_B'])          │ env: {}                                                │ Returns false, process.exitCode = 1 (Missing: KEY_A, KEY_B)     │
 * │ Error 1   │ validateRuntimeEnvironment('not-an-array')              │ requiredEnvKeys: 'not-an-array'                        │ Lempar TypeError('requiredEnvKeys must be an array of strings') │
 * └───────────┴─────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────┘
 */

/**
 * Memvalidasi variabel environment yang wajib dan menyetel process.exitCode sesuai status.
 *
 * @param {string[]} requiredEnvKeys
 * @returns {boolean}
 */
export function validateRuntimeEnvironment(requiredEnvKeys) {
  // 1. Validasi input: pastikan requiredEnvKeys bertipe Array
  if (!Array.isArray(requiredEnvKeys)) {
    throw new TypeError('requiredEnvKeys must be an array of strings');
  }

  // 2. Kumpulkan kunci variabel yang hilang, bernilai null, atau berupa string kosong
  const missingKeys = [];

  for (const key of requiredEnvKeys) {
    const val = process.env[key];

    if (val === undefined || val === null || val.trim() === '') {
      missingKeys.push(key);
    }
  }

  // 3. Setel status exitCode dan kembalikan boolean hasil validasi
  if (missingKeys.length > 0) {
    process.exitCode = 1;
    return false;
  }

  process.exitCode = 0;
  return true;
}
