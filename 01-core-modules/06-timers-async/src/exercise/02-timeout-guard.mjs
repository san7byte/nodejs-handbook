import { setTimeout } from 'node:timers/promises';

/**
 * SOAL 02: Asynchronous Task Timeout Guard
 *
 * Deskripsi:
 * Buat fungsi `executeWithTimeout` yang membatasi durasi eksekusi suatu tugas asinkron.
 * Jika eksekusi tugas melebihi ambang batas milidetik yang ditentukan, batalkan tugas tersebut
 * dan lempar error timeout. Fungsi ini juga harus mendukung pembatalan manual dari luar melalui
 * `AbortSignal` opsional, serta membersihkan timer internal agar tidak menggantung antrean proses.
 *
 * API Resmi yang Wajib Digunakan:
 * - `node:timers/promises`: `setTimeout`
 * - Web APIs bawaan Node.js: `AbortController`, `AbortSignal`
 *
 * Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 * 1. Parameter `taskFn`:
 *    - Wajib bertipe function (`typeof taskFn === 'function'`).
 *      Jika tidak valid, lempar `TypeError` dengan pesan persis:
 *      "Task must be a function"
 * 2. Parameter `timeoutMs`:
 *    - Wajib bertipe number primitif (`typeof timeoutMs === 'number'`) dan bukan `NaN` (`!Number.isNaN(timeoutMs)`).
 *      Jika bukan number, lempar `TypeError` dengan pesan persis:
 *      "Timeout must be a number"
 *    - Wajib berupa integer (`Number.isInteger(timeoutMs)`) dan bernilai positif (`timeoutMs > 0`).
 *      Jika tidak valid (misal desimal, 0, atau angka negatif), lempar `RangeError` dengan pesan persis:
 *      "Timeout must be a positive integer"
 * 3. Parameter `customSignal`:
 *    - Opsional. Jika diberikan dan tidak bernilai undefined/null, wajib merupakan instance dari `AbortSignal`.
 *      Jika bukan instance dari `AbortSignal`, lempar `TypeError` dengan pesan persis:
 *      "Signal must be an AbortSignal"
 * 4. Perilaku Eksekusi & Lifecycle:
 *    - Panggil `taskFn({ signal })` dengan menyediakan objek argumen berisi `signal` aktif.
 *    - Jika `taskFn` selesai sebelum batas `timeoutMs`: kembalikan hasil return dari `taskFn`. Timer timeout internal wajib dibatalkan/dibersihkan.
 *    - Jika `taskFn` melempar error sendiri (bukan pembatalan timeout/user): teruskan error asli tersebut.
 *    - Jika durasi eksekusi mencapai atau melampaui `timeoutMs`: batalkan operasi dan lempar `Error` dengan pesan persis:
 *      "Operation timed out after <timeoutMs>ms" (contoh: "Operation timed out after 20ms")
 *    - Jika `customSignal` dibatalkan oleh pengguna sebelum timeout tercapai: batalkan operasi dan lempar `Error` dengan pesan persis:
 *      "Operation aborted by user"
 *
 * Tabel Spesifikasi I/O:
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 * | No | Skenario                                                      | Pemanggilan                               | Input                                 | Expected                                                    |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 * | 1  | Normal 1: Task asinkron selesai sebelum batas timeout         | executeWithTimeout(async () => 'fast', 80)| task: async () => 'fast', 80          | 'fast'                                                      |
 * | 2  | Normal 2: Task sinkron langsung mengembalikan nilai           | executeWithTimeout(() => 42, 80)          | task: () => 42, 80                    | 42                                                          |
 * | 3  | Normal 3: Task menerima context { signal } dan sukses         | executeWithTimeout(async ({ signal }) => 1, 80) | task: async ({ signal }), 80   | 1                                                           |
 * | 4  | Edge 1: Task melempar error internal diteruskan apa adanya    | executeWithTimeout(async () => throw err, 80) | task throwing Error('DB error'), 80 | Error: "DB error"                                           |
 * | 5  | Edge 2: Task melebihi batas waktu melempar timeout error      | executeWithTimeout(slowTask, 20)          | slowTask (80ms), 20                   | Error: "Operation timed out after 20ms"                     |
 * | 6  | Edge 3: Dibatalkan via customSignal melempar abort error      | executeWithTimeout(slowTask, 150, userSig)| slowTask (80ms), 150, userSig         | Error: "Operation aborted by user"                          |
 * | 7  | Error 1: Parameter taskFn bukan function melempar TypeError   | executeWithTimeout('invalid', 50)         | 'invalid', 50                         | TypeError: "Task must be a function"                        |
 * | 8  | Error 2: Parameter timeoutMs bukan number melempar TypeError  | executeWithTimeout(() => {}, '50')        | () => {}, '50'                        | TypeError: "Timeout must be a number"                       |
 * | 9  | Error 3: Parameter timeoutMs bernilai 0 melempar RangeError   | executeWithTimeout(() => {}, 0)           | () => {}, 0                           | RangeError: "Timeout must be a positive integer"            |
 * | 10 | Error 4: Parameter timeoutMs bernilai negatif (RangeError)    | executeWithTimeout(() => {}, -10)         | () => {}, -10                         | RangeError: "Timeout must be a positive integer"            |
 * | 11 | Error 5: Parameter customSignal bukan AbortSignal (TypeError) | executeWithTimeout(() => {}, 50, {})      | () => {}, 50, {}                      | TypeError: "Signal must be an AbortSignal"                  |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 */

/**
 * Menjalankan fungsi tugas asinkron dengan batasan waktu timeout dan pembatalan sinyal.
 *
 * @param {Function} taskFn
 * @param {number} timeoutMs
 * @param {AbortSignal} [customSignal]
 * @returns {Promise<any>}
 */
export async function executeWithTimeout(taskFn, timeoutMs, customSignal) {
  // 1. Validasi parameter taskFn: wajib berupa function
  if (typeof taskFn !== 'function') {
    throw new TypeError('Task must be a function');
  }

  // 2. Validasi parameter timeoutMs: wajib number dan bukan NaN
  if (typeof timeoutMs !== 'number' || Number.isNaN(timeoutMs)) {
    throw new TypeError('Timeout must be a number');
  }

  // 3. Validasi batasan timeoutMs: wajib integer positif (> 0)
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Timeout must be a positive integer');
  }

  // 4. Validasi parameter customSignal opsional: jika ada, wajib instance AbortSignal
  if (
    customSignal !== undefined &&
    customSignal !== null &&
    !(customSignal instanceof AbortSignal)
  ) {
    throw new TypeError('Signal must be an AbortSignal');
  }

  // 5. Cek kondisi awal: jika signal pengguna sudah dibatalkan dari awal, langsung lempar error
  if (customSignal?.aborted) {
    throw new Error('Operation aborted by user');
  }

  // 6. Siapkan AbortController:
  //    - taskController: memberikan walkie-talkie pembatalan aktif ke taskFn
  //    - timerController: mematikan timer internal setelah task selesai agar proses tidak menggantung
  const taskController = new AbortController();
  const timerController = new AbortController();

  // 7. Siapkan Promise penangkap sinyal pembatalan pengguna (jika customSignal diberikan)
  let onUserAbort;
  const userAbort = new Promise((_, reject) => {
    if (!customSignal) return; // Jika tidak ada customSignal, biarkan promise ini pending selamanya
    onUserAbort = () => reject(new Error('Operation aborted by user'));
    customSignal.addEventListener('abort', onUserAbort, { once: true });
  });

  // 8. Buat timer batas waktu yang melempar error timeout jika durasi terlampaui
  const timeout = setTimeout(timeoutMs, undefined, {
    signal: timerController.signal,
  }).then(() => {
    throw new Error(`Operation timed out after ${timeoutMs}ms`);
  });

  // 9. Perlombaan asinkron (Promise.race) dan siklus pembersihan (cleanup)
  try {
    return await Promise.race([
      (async () => taskFn({ signal: taskController.signal }))(),
      timeout,
      userAbort,
    ]);
  } catch (error) {
    // Beritahu taskFn bahwa operasinya telah dibatalkan
    taskController.abort();
    throw error;
  } finally {
    // Cleanup: matikan timer internal agar tidak menahan event loop Node.js
    timerController.abort();
    if (onUserAbort) {
      customSignal.removeEventListener('abort', onUserAbort);
    }
  }
}
