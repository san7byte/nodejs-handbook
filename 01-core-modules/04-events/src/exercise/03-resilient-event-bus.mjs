import { EventEmitter } from 'node:events';

/**
 * ============================================================================
 * SOAL 03 (GABUNGAN): Resilient Event Bus Architecture
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Rancang dan buatlah class `ResilientEventBus` yang mewarisi class bawaan
 *    `EventEmitter`. Class ini berfungsi sebagai event bus domain dengan fitur
 *    penjadwalan prioritas listener, pencegahan memory leak, pemantauan error
 *    otomatis menggunakan `EventEmitter.errorMonitor`, serta laporan telemetri
 *    diagnostik dan pembersihan total.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:events`: `EventEmitter`, `prependListener`, `prependOnceListener`,
 *      `setMaxListeners`, `listenerCount`, `EventEmitter.errorMonitor`, `removeAllListeners`.
 *
 *    Ketentuan Method dan Validasi Input:
 *    1. `constructor(options = {})`:
 *       - `options.maxListeners`: opsional integer positif (default `10`). Jika diberikan
 *         namun bukan integer positif (> 0), lempar `RangeError`: 'Invalid maxListeners: must be a positive integer'.
 *       - Menetapkan batas listener instance menggunakan `this.setMaxListeners(maxListeners)`.
 *       - Menginisialisasi array riwayat error: `this.errorHistory = []`.
 *       - Mendaftarkan listener internal pada `[EventEmitter.errorMonitor]` untuk mencatat setiap
 *         error yang dipancarkan ke dalam `this.errorHistory.push({ message: err.message, timestamp: Date.now() })`.
 *
 *    2. `subscribe(eventName, handler, options = {})`:
 *       - `eventName`: wajib string non-kosong (setelah trim). Jika bukan, lempar `TypeError`: 'Invalid eventName: must be a non-empty string'.
 *       - `handler`: wajib berupa fungsi callback. Jika bukan, lempar `TypeError`: 'Invalid handler: must be a function'.
 *       - `options`: wajib berupa objek non-null. Jika bukan, lempar `TypeError`: 'Invalid options: must be an object'.
 *       - `options.priority`: boolean opsional (default: `false`).
 *       - `options.once`: boolean opsional (default: `false`).
 *       - Aturan registrasi:
 *         * Jika `priority === true` dan `once === true`: daftarkan via `this.prependOnceListener(eventName, handler)`.
 *         * Jika `priority === true` dan `once === false`: daftarkan via `this.prependListener(eventName, handler)`.
 *         * Jika `priority === false` dan `once === true`: daftarkan via `this.once(eventName, handler)`.
 *         * Jika `priority === false` dan `once === false`: daftarkan via `this.on(eventName, handler)`.
 *       - Mengembalikan fungsi uninstaller `() => void` yang ketika dipanggil akan melepas
 *         listener tersebut dari event target menggunakan `this.off(eventName, handler)`.
 *
 *    3. `publish(eventName, ...args)`:
 *       - `eventName`: wajib string non-kosong. Jika bukan, lempar `TypeError`: 'Invalid eventName: must be a non-empty string'.
 *       - Memanggil pemancaran event melalui `this.emit(eventName, ...args)` dan mengembalikan nilai boolean hasil emit.
 *
 *    4. `getDiagnostics()`:
 *       - Mengembalikan objek ringkasan telemetri:
 *         `{ maxListeners: number, activeEvents: string[], listenerCounts: Record<string, number>, totalErrors: number }`
 *         `activeEvents` berisi array nama event yang memiliki `listenerCount > 0`.
 *         `listenerCounts` adalah objek `{ [eventName]: count }` untuk event aktif.
 *         `totalErrors` adalah jumlah error di `this.errorHistory`.
 *
 *    5. `destroy()`:
 *       - Menghapus seluruh listener yang terdaftar menggunakan `this.removeAllListeners()`.
 *       - Mengosongkan riwayat `this.errorHistory = []`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬────────────────────────────────────────────────────────┬──────────────────────────────────────┬───────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                            │ Input / Kondisi                      │ Output / Expected Behavior                            │
 * ├───────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────┼───────────────────────────────────────────────────────┤
 * │ Normal 1  │ bus.subscribe('evt', fn); bus.publish('evt', 'ok')     │ Registrasi dan pemancaran standar    │ fn dipanggil dengan 'ok', publish return true         │
 * │ Normal 2  │ const unsub = bus.subscribe('x', fn); unsub()          │ Unsubscribe menggunakan returned fn  │ listenerCount('x') = 0, event berikutnya tidak memicu │
 * │ Normal 3  │ bus.subscribe('q', fn2); bus.subscribe('q', fn1, {priority:true}) │ publish('q')             │ fn1 dieksekusi sebelum fn2                            │
 * │ Normal 4  │ bus.subscribe('m', fn); bus.getDiagnostics()           │ 1 event terdaftar                    │ { maxListeners: 10, activeEvents: ['m'], ... }        │
 * │ Edge 1    │ bus.subscribe('p', fn, {priority:true, once:true})     │ emit 'p' 2 kali                      │ fn jalan urutan awal pada putaran 1, putaran 2 lepas  │
 * │ Edge 2    │ bus.on('error', ()=>{}); bus.publish('error', err)     │ emit 'error' dengan listener aktif   │ totalErrors bertambah 1 & tercatat di errorHistory    │
 * │ Edge 3    │ bus.destroy()                                          │ destroy dipanggil pada bus aktif     │ listenerCount = 0 & totalErrors = 0                   │
 * │ Error 1   │ new ResilientEventBus({ maxListeners: 0 })             │ maxListeners <= 0                    │ Lempar RangeError('Invalid maxListeners: must be ...')│
 * │ Error 2   │ bus.subscribe('', ()=>{})                              │ eventName string kosong              │ Lempar TypeError('Invalid eventName: must be a ...')  │
 * │ Error 3   │ bus.subscribe('evt', null)                             │ handler bukan function               │ Lempar TypeError('Invalid handler: must be a ...')    │
 * │ Error 4   │ bus.subscribe('evt', ()=>{}, null)                     │ options = null                       │ Lempar TypeError('Invalid options: must be an ...')   │
 * │ Error 5   │ bus.publish(123)                                       │ eventName bukan string               │ Lempar TypeError('Invalid eventName: must be a ...')  │
 * └───────────┴────────────────────────────────────────────────────────┴──────────────────────────────────────┴───────────────────────────────────────────────────────┘
 */

// --- Helper Predikat Validasi Input ---
const isEmptyString = (v) => typeof v !== 'string' || v.trim() === '';
const isNotFunction = (v) => typeof v !== 'function';
const isNotObject = (v) => typeof v !== 'object' || v === null;
const isNotPositiveInteger = (v) => !Number.isInteger(v) || v <= 0;

// Validasi nama event: wajib berupa string non-kosong
function validateEventName(eventName) {
  if (isEmptyString(eventName)) {
    throw new TypeError('Invalid eventName: must be a non-empty string');
  }
}

// Validasi handler: wajib berupa fungsi callback
function validateHandler(handler) {
  if (isNotFunction(handler)) {
    throw new TypeError('Invalid handler: must be a function');
  }
}

// Validasi options: wajib berupa objek dan bukan null
function validateOptions(options) {
  if (isNotObject(options)) {
    throw new TypeError('Invalid options: must be an object');
  }
}

// Validasi maxListeners: jika diisi, wajib berupa integer positif (> 0) dengan default 10
function validateMaxListeners(maxListeners = 10) {
  if (isNotPositiveInteger(maxListeners)) {
    throw new RangeError('Invalid maxListeners: must be a positive integer');
  }
  return maxListeners;
}

// Pemetaan kombinasi opsi priority dan once ke method EventEmitter terkait
const METHODS = {
  'false:false': 'on',
  'false:true': 'once',
  'true:false': 'prependListener',
  'true:true': 'prependOnceListener',
};

export class ResilientEventBus extends EventEmitter {
  /**
   * Menginisialisasi event bus dengan kuota listener dan pelacak error.
   *
   * @param {{ maxListeners?: number }} [options={}]
   */
  constructor(options = {}) {
    // 1. Inisialisasi class induk EventEmitter
    super();

    // 2. Validasi dan tetapkan batas maksimal listener untuk mencegah memory leak
    const maxListeners = validateMaxListeners(options.maxListeners);
    this.setMaxListeners(maxListeners);

    // 3. Siapkan array penyimpan riwayat telemetri error
    this.errorHistory = [];

    // 4. Daftarkan errorMonitor internal untuk menyadap seluruh error tanpa mengonsumsinya
    this.on(EventEmitter.errorMonitor, (err) => {
      this.errorHistory.push({
        message: err.message,
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Mendaftarkan handler event dengan konfigurasi prioritas atau sekali pakai.
   *
   * @param {string} eventName
   * @param {Function} handler
   * @param {{ priority?: boolean, once?: boolean }} [options={}]
   * @returns {() => void}
   */
  subscribe(eventName, handler, options = {}) {
    // 1. Validasi seluruh argumen input secara defensif
    validateEventName(eventName);
    validateHandler(handler);
    validateOptions(options);

    // 2. Tentukan method pendaftaran berdasarkan kombinasi opsi priority dan once
    const { priority = false, once = false } = options;
    const methodName = METHODS[`${priority}:${once}`];
    this[methodName](eventName, handler);

    // 3. Kembalikan fungsi pencopot (uninstaller) untuk memudahkan unsubscribe
    return () => this.off(eventName, handler);
  }

  /**
   * Memancarkan event beserta payload data.
   *
   * @param {string} eventName
   * @param {...any} args
   * @returns {boolean}
   */
  publish(eventName, ...args) {
    // 1. Validasi nama event yang akan dipancarkan
    validateEventName(eventName);

    // 2. Pancarkan event beserta data argumen ke seluruh listener aktif
    return this.emit(eventName, ...args);
  }

  /**
   * Mengambil data telemetri metrik event bus.
   *
   * @returns {{ maxListeners: number, activeEvents: string[], listenerCounts: Record<string, number>, totalErrors: number }}
   */
  getDiagnostics() {
    const activeEvents = [];
    const listenerCounts = {};

    // 1. Periksa seluruh event yang terdaftar pada instance bus
    for (const name of this.eventNames()) {
      const count = this.listenerCount(name);

      // Hanya masukkan nama event bertipe string dan memiliki listener aktif > 0
      if (typeof name === 'string' && count > 0) {
        activeEvents.push(name);
        listenerCounts[name] = count;
      }
    }

    // 2. Kembalikan rekap status kesehatan dan metrik bus saat ini
    return {
      maxListeners: this.getMaxListeners(),
      activeEvents,
      listenerCounts,
      totalErrors: this.errorHistory.length,
    };
  }

  /**
   * Membersihkan seluruh listener dan riwayat error event bus.
   *
   * @returns {void}
   */
  destroy() {
    // 1. Copot seluruh listener di seluruh event
    this.removeAllListeners();

    // 2. Kosongkan riwayat error
    this.errorHistory = [];
  }
}
