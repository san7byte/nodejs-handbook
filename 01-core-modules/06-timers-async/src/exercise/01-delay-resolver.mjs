import { setTimeout } from 'node:timers/promises';

/**
 * SOAL 01: Delayed Promise Resolver
 *
 * Deskripsi:
 * Buat fungsi `resolveWithDelay` yang menunda pengembalian suatu nilai selama durasi milidetik
 * tertentu menggunakan modul timers berbasis Promise bawaan Node.js (`node:timers/promises`).
 * Fungsi ini harus memvalidasi nilai jeda waktu secara defensif dan menyediakan nilai default.
 *
 * API Resmi yang Wajib Digunakan:
 * - `setTimeout` dari modul `node:timers/promises`
 *
 * Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 * 1. Parameter `delayMs`:
 *    - Wajib bertipe number primitif (`typeof delayMs === 'number'`) dan bukan `NaN` (`!Number.isNaN(delayMs)`).
 *      Jika tidak valid, lempar `TypeError` dengan pesan persis:
 *      "Delay must be a number"
 *    - Wajib berupa integer (`Number.isInteger(delayMs)`) dan bernilai non-negatif (`delayMs >= 0`).
 *      Jika tidak valid (misal angka desimal atau angka negatif), lempar `RangeError` dengan pesan persis:
 *      "Delay must be a non-negative integer"
 * 2. Parameter `value`:
 *    - Opsional. Menentukan nilai payload yang di-resolve setelah jeda waktu selesai.
 *    - Jika argumen `value` tidak diberikan (`undefined`), nilai default-nya adalah string: `'OK'`.
 * 3. Nilai Kembalian:
 *    - Mengembalikan `Promise` yang me-resolve `value` setelah jeda `delayMs` milidetik.
 *
 * Tabel Spesifikasi I/O:
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 * | No | Skenario                                                      | Pemanggilan                               | Input                                 | Expected                                                    |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 * | 1  | Normal 1: Resolve nilai string dengan jeda waktu tertentu     | resolveWithDelay(30, 'custom-result')     | 30, 'custom-result'                   | 'custom-result'                                             |
 * | 2  | Normal 2: Menggunakan default value saat argumen tidak diberi | resolveWithDelay(15)                      | 15                                    | 'OK'                                                        |
 * | 3  | Normal 3: Resolve objek kompleks setelah jeda waktu           | resolveWithDelay(20, { status: 200 })     | 20, { status: 200 }                   | { status: 200 }                                             |
 * | 4  | Edge 1: Jeda waktu 0 ms segera me-resolve payload             | resolveWithDelay(0, 'immediate-resolve')  | 0, 'immediate-resolve'                | 'immediate-resolve'                                         |
 * | 5  | Edge 2: Payload bernilai null tetap di-resolve apa adanya     | resolveWithDelay(10, null)                | 10, null                              | null                                                        |
 * | 6  | Error 1: Argumen delay bertipe string melempar TypeError      | resolveWithDelay('50')                    | '50'                                  | TypeError: "Delay must be a number"                         |
 * | 7  | Error 2: Argumen delay bernilai NaN melempar TypeError        | resolveWithDelay(NaN)                     | NaN                                   | TypeError: "Delay must be a number"                         |
 * | 8  | Error 3: Argumen delay bernilai negatif melempar RangeError   | resolveWithDelay(-10)                     | -10                                   | RangeError: "Delay must be a non-negative integer"          |
 * | 9  | Error 4: Argumen delay bernilai desimal melempar RangeError   | resolveWithDelay(12.34)                   | 12.34                                 | RangeError: "Delay must be a non-negative integer"          |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 */

/**
 * Menunda resolusi Promise selama delayMs milidetik dan mengembalikan value.
 *
 * @param {number} delayMs
 * @param {any} [value='OK']
 * @returns {Promise<any>}
 */
export async function resolveWithDelay(delayMs, value = 'OK') {
  // 1. Validasi tipe delayMs: wajib number primitif dan bukan NaN
  if (typeof delayMs !== 'number' || Number.isNaN(delayMs)) {
    throw new TypeError('Delay must be a number');
  }

  // 2. Validasi batasan delayMs: wajib integer dan bernilai non-negatif (>= 0)
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new RangeError('Delay must be a non-negative integer');
  }

  // 3. Tunda eksekusi menggunakan timer Promise native dan kembalikan value
  return await setTimeout(delayMs, value);
}
