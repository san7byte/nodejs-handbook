import { EventEmitter } from 'node:events';

/**
 * ============================================================================
 * SOAL 02 (MENENGAH): Event Stream Collector with AbortSignal
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buatlah fungsi asinkron `collectEventStream(emitter, eventName, options)` yang
 *    mengumpulkan aliran event secara asinkron hingga mencapai kuota jumlah `count`
 *    yang ditentukan pada `options`, atau dibatalkan oleh `options.signal` (`AbortSignal`).
 *
 *    Fungsi mengembalikan Promise yang resolve dengan array 2D dari seluruh event
 *    yang berhasil ditangkap: `Array<any[]>` di mana setiap elemen adalah array
 *    argumen yang dikirimkan pada pemanggilan `emit()`.
 *
 *    Fungsi harus menerapkan defensive cleanup: seluruh listener yang didaftarkan
 *    wajib dilepas secara bersih baik saat kuota terpenuhi, saat operasi dibatalkan,
 *    maupun saat emitter memancarkan error.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:events`: `EventEmitter` (atau fungsi iterator bawaan `events.on`).
 *    - Standar WHATWG `AbortSignal` / `AbortController`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Parameter `emitter` wajib berupa instance dari `EventEmitter`. Jika bukan,
 *      lempar `TypeError`: 'Invalid emitter: must be an instance of EventEmitter'.
 *    - Parameter `eventName` wajib berupa string non-kosong (setelah whitespace dibersihkan).
 *      Jika tidak, lempar `TypeError`: 'Invalid eventName: must be a non-empty string'.
 *    - Parameter `options` wajib berupa objek bukan null. Jika bukan objek atau null,
 *      lempar `TypeError`: 'Invalid options: must be an object'.
 *    - Properti `options.count` wajib berupa integer positif (> 0). Jika bukan number integer
 *      atau nilainya <= 0, lempar `RangeError`: 'Invalid count: must be a positive integer'.
 *    - Properti `options.signal` bersifat opsional. Namun jika disediakan dan bukan merupakan
 *      instance dari `AbortSignal`, lempar `TypeError`: 'Invalid signal: must be an AbortSignal instance'.
 *    - Jika `signal` sudah dalam keadaan `aborted` sebelum fungsi mulai mengumpulkan data,
 *      langsung reject dengan `Error('Collection aborted')` tanpa memasang listener.
 *    - Jika `signal` di-abort saat pengumpulan sedang berlangsung, reject dengan `Error('Collection aborted')`
 *      dan bersihkan seluruh listener yang terpasang.
 *    - Jika emitter memancarkan event 'error' selama pengumpulan, reject dengan Error tersebut
 *      dan bersihkan listener.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬────────────────────────────────────────────────────────┬──────────────────────────────────────┬───────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                            │ Input / Kondisi                      │ Output / Expected Behavior                            │
 * ├───────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
 * │ Normal 1  │ collectEventStream(ee, 'item', { count: 3 })           │ emit 'item' 3x: 10, 20, 30           │ Resolve [[10], [20], [30]] & listenerCount = 0        │
 * │ Normal 2  │ collectEventStream(ee, 'log', { count: 2 })            │ emit 'log' 2x: ('A', 1), ('B', 2)    │ Resolve [['A', 1], ['B', 2]] & listenerCount = 0      │
 * │ Edge 1    │ collectEventStream(ee, 'data', { count: 5, signal })   │ signal sudah aborted saat start      │ Reject Error('Collection aborted') & listenerCount = 0│
 * │ Edge 2    │ collectEventStream(ee, 'data', { count: 5, signal })   │ abort terpanggil setelah 2 event     │ Reject Error('Collection aborted') & listenerCount = 0│
 * │ Edge 3    │ collectEventStream(ee, 'data', { count: 5 })           │ emit 'error' saat pengumpulan        │ Reject Error('Stream broke') & listenerCount = 0      │
 * │ Error 1   │ collectEventStream({}, 'data', { count: 1 })           │ emitter = {}                         │ Lempar TypeError('Invalid emitter: must be an ...')   │
 * │ Error 2   │ collectEventStream(ee, '   ', { count: 1 })            │ eventName whitespace                 │ Lempar TypeError('Invalid eventName: must be a ...')  │
 * │ Error 3   │ collectEventStream(ee, 'data', null)                   │ options = null                       │ Lempar TypeError('Invalid options: must be an ...')   │
 * │ Error 4   │ collectEventStream(ee, 'data', { count: 0 })           │ options.count = 0                    │ Lempar RangeError('Invalid count: must be a ...')     │
 * │ Error 5   │ collectEventStream(ee, 'data', { count: 1, signal: {} })│ options.signal invalid instance      │ Lempar TypeError('Invalid signal: must be an ...')    │
 * └───────────┴────────────────────────────────────────────────────────┴──────────────────────────────────────┴───────────────────────────────────────────────────────┘
 */

/**
 * Mengumpulkan deretan argumen event secara asinkron hingga jumlah count terpenuhi atau dibatalkan.
 *
 * @param {EventEmitter} emitter
 * @param {string} eventName
 * @param {{ count: number, signal?: AbortSignal }} options
 * @returns {Promise<any[][]>}
 */
export async function collectEventStream(emitter, eventName, options) {
  throw new Error('Not implemented');
}
