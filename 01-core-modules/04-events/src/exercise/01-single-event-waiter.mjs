import { EventEmitter } from 'node:events';

/**
 * ============================================================================
 * SOAL 01 (DASAR): Single Event Waiter with Timeout
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buatlah fungsi asinkron `waitForEvent(emitter, eventName, timeoutMs)` yang
 *    menunggu pemancaran suatu event tunggal pada instance `EventEmitter` dan
 *    mengembalikan seluruh payload argumen event tersebut dalam bentuk array
 *    menggunakan Promise.
 *
 *    Jika parameter `timeoutMs` diberikan dan batas waktu tersebut habis sebelum
 *    event dipancarkan, fungsi harus me-reject Promise dengan Error bertuliskan
 *    'Event wait timed out'. Ketika timeout tercapai atau proses selesai, fungsi
 *    harus secara defensif memastikan listener yang terpasang otomatis dibersihkan
 *    sehingga tidak menimbulkan kebocoran memori (listener leak).
 *
 *    Jika emitter memancarkan event 'error' sebelum event target terpancar, fungsi
 *    harus me-reject Promise dengan objek Error yang dipancarkan tersebut.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:events`: `EventEmitter` (atau fungsi bawaan `events.once`).
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Parameter `emitter` wajib berupa instance dari `EventEmitter`. Jika bukan
 *      atau bernilai falsy, lempar `TypeError`: 'Invalid emitter: must be an instance of EventEmitter'.
 *    - Parameter `eventName` wajib berupa string non-kosong (setelah whitespace dibersihkan).
 *      Jika bukan string atau string kosong, lempar `TypeError`: 'Invalid eventName: must be a non-empty string'.
 *    - Parameter `timeoutMs` bersifat opsional (default: `undefined`). Jika diberikan,
 *      wajib berupa angka berhingga positif (> 0). Jika bernilai <= 0, NaN, atau tipe lain,
 *      lempar `RangeError`: 'Invalid timeoutMs: must be a positive number'.
 *    - Jika waktu habis sebelum event dipancarkan, reject dengan `Error('Event wait timed out')`.
 *    - Listener wajib dilepas setelah event berhasil diterima, timeout, atau error terpancar.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────────────────────────────────────┬─────────────────────────────────┬───────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                           │ Input / Kondisi                 │ Output / Expected Behavior                            │
 * ├───────────┼───────────────────────────────────────────────────────┼─────────────────────────────────┼───────────────────────────────────────────────────────┤
 * │ Normal 1  │ waitForEvent(ee, 'data')                              │ ee.emit('data', 'sample-value') │ Resolve ['sample-value']                              │
 * │ Normal 2  │ waitForEvent(ee, 'login')                             │ ee.emit('login', 'U1', 'admin') │ Resolve ['U1', 'admin']                               │
 * │ Normal 3  │ waitForEvent(ee, 'ping', 1000)                        │ ee.emit('ping', 'pong') < 1000ms│ Resolve ['pong']                                      │
 * │ Edge 1    │ waitForEvent(ee, 'unheard', 50)                       │ Tidak ada emit dalam 50ms       │ Reject Error('Event wait timed out') & listener = 0   │
 * │ Edge 2    │ waitForEvent(ee, 'task')                              │ ee.emit('error', new Error('X'))│ Reject Error('X') & listener = 0                      │
 * │ Error 1   │ waitForEvent(null, 'data')                            │ emitter = null                  │ Lempar TypeError('Invalid emitter: must be an ...')   │
 * │ Error 2   │ waitForEvent(ee, '   ')                               │ eventName string whitespace     │ Lempar TypeError('Invalid eventName: must be a ...')  │
 * │ Error 3   │ waitForEvent(ee, 'data', -100)                        │ timeoutMs <= 0                  │ Lempar RangeError('Invalid timeoutMs: must be a ...') │
 * └───────────┴───────────────────────────────────────────────────────┴─────────────────────────────────┴───────────────────────────────────────────────────────┘
 */

/**
 * Menunggu satu event terpancar pada EventEmitter dengan batas waktu opsional.
 *
 * @param {EventEmitter} emitter
 * @param {string} eventName
 * @param {number} [timeoutMs]
 * @returns {Promise<any[]>}
 */
export async function waitForEvent(emitter, eventName, timeoutMs) {
  // 1. Validasi emitter wajib berupa instance EventEmitter
  if (!(emitter instanceof EventEmitter)) {
    throw new TypeError('Invalid emitter: must be an instance of EventEmitter');
  }

  // 2. Validasi eventName wajib berupa string non-kosong
  if (typeof eventName !== 'string' || eventName.trim() === '') {
    throw new TypeError('Invalid eventName: must be a non-empty string');
  }

  // 3. Validasi timeoutMs opsional: jika diisi, wajib berupa angka positif berhingga
  if (timeoutMs !== undefined) {
    if (
      typeof timeoutMs !== 'number' ||
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0
    ) {
      throw new RangeError('Invalid timeoutMs: must be a positive number');
    }
  }

  // 4. Kembalikan Promise yang menjembatani siklus hidup event ke pola async/await
  return new Promise((resolve, reject) => {
    let timerId;

    // Fungsi pembersihan terpusat untuk mencegah memory leak
    const cleanup = () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
      emitter.off(eventName, funcListener);
      emitter.off('error', errorHandler);
    };

    // Handler saat event target berhasil terpancar (Normal path)
    const funcListener = (...args) => {
      cleanup();
      resolve([...args]);
    };

    // Handler saat emitter memancarkan error sebelum event muncul (Error path)
    const errorHandler = (err) => {
      cleanup();
      reject(err);
    };

    // Pasang listener pada instance emitter
    emitter.on(eventName, funcListener);
    emitter.on('error', errorHandler);

    // Pasang timer jika batas waktu timeoutMs ditentukan
    if (timeoutMs !== undefined) {
      timerId = setTimeout(() => {
        cleanup();
        reject(new Error('Event wait timed out'));
      }, timeoutMs);
    }
  });
}
