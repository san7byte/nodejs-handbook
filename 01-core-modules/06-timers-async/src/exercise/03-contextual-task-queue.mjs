import { AsyncLocalStorage } from 'node:async_hooks';
import { setImmediate } from 'node:timers';

/**
 * SOAL 03: Contextual Async Task Queue
 *
 * Deskripsi:
 * Buat class `ContextualTaskQueue` yang mengelola antrean eksekusi tugas asinkron menggunakan
 * `setImmediate` dan melacak metadata konteks setiap tugas secara otomatis menggunakan
 * `AsyncLocalStorage`. Antrean ini harus memastikan setiap tugas memiliki isolasi konteks eksekusi,
 * mendukung pelacakan konteks aktif, menyediakan metrik ukuran antrean, serta memiliki toleransi
 * kesalahan di mana kegagalan satu tugas tidak menghentikan pemrosesan tugas lainnya.
 *
 * API Resmi yang Wajib Digunakan:
 * - `node:async_hooks`: `AsyncLocalStorage`
 * - `node:timers`: `setImmediate`
 *
 * Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 * 1. Konstruktor `constructor(options = {})`:
 *    - Parameter `options`: Wajib berupa object dan bukan array atau null (`typeof options === 'object' && options !== null && !Array.isArray(options)`).
 *      Jika tidak valid, lempar `TypeError` dengan pesan persis:
 *      "Options must be an object"
 *    - Opsi `options.name`: Opsional bertipe string dengan nilai default `'task-queue'`.
 *      Jika diberikan tetapi bukan string, lempar `TypeError` dengan pesan persis:
 *      "Queue name must be a string"
 *    - Inisialisasi instance `AsyncLocalStorage` privat.
 * 2. Method `enqueue(taskFn, metadata)`:
 *    - Parameter `taskFn`: Wajib bertipe function (`typeof taskFn === 'function'`).
 *      Jika bukan function, lempar `TypeError` dengan pesan persis:
 *      "Task must be a function"
 *    - Parameter `metadata`: Wajib bertipe object (`typeof metadata === 'object' && metadata !== null && !Array.isArray(metadata)`).
 *      Jika bukan object, lempar `TypeError` dengan pesan persis:
 *      "Metadata must be an object"
 *    - Properti `metadata.id`: Wajib bertipe string dan tidak boleh kosong/whitespace saja (`typeof metadata.id === 'string' && metadata.id.trim().length > 0`).
 *      Jika tidak valid, lempar `TypeError` dengan pesan persis:
 *      "Task ID must be a non-empty string"
 *    - Penjadwalan & Konteks:
 *      - Menjadwalkan eksekusi `taskFn` secara asinkron menggunakan `setImmediate`.
 *      - Eksekusi `taskFn` dilakukan di dalam cakupan `als.run({ id: metadata.id, ...metadata, queueName: this.name }, ...)`.
 *      - Mengembalikan `Promise` yang me-resolve hasil nilai return dari `taskFn` atau me-reject jika `taskFn` melempar error.
 * 3. Method `getActiveContext()`:
 *    - Membaca store aktif dari `AsyncLocalStorage`.
 *    - Jika dipanggil di dalam eksekusi tugas yang sedang berjalan di antrean, kembalikan objek konteks aktif `{ id, ...metadata, queueName }`.
 *    - Jika dipanggil di luar cakupan eksekusi tugas antrean, kembalikan `null`.
 * 4. Getter `get size()`:
 *    - Mengembalikan jumlah tugas yang saat ini sedang menunggu giliran dalam antrean (integer >= 0).
 * 5. Isolasi & Ketahanan Kesalahan:
 *    - Jika satu tugas dalam antrean gagal/melempar error, Promise tugas tersebut me-reject error asli, sedangkan tugas-tugas lain di antrean tetap diproses normal.
 *
 * Tabel Spesifikasi I/O:
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 * | No | Skenario                                                      | Pemanggilan                               | Input                                 | Expected                                                    |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 * | 1  | Normal 1: Enqueue satu task dan me-resolve nilainya           | queue.enqueue(async () => 'done', {id:'1'})| taskFn: () => 'done', { id: '1' }    | 'done'                                                      |
 * | 2  | Normal 2: Enqueue multiple tasks berjalan berurutan           | queue.enqueue(t1), queue.enqueue(t2)      | 2 tasks valid berurutan               | Kedua task resolve nilai masing-masing                      |
 * | 3  | Normal 3: getActiveContext() di dalam task membaca konteks    | queue.enqueue(readContextTask, {id:'c-1'})| metadata: { id: 'c-1', role: 'admin' }| Objek context { id: 'c-1', role: 'admin', queueName: ... }|
 * | 4  | Normal 4: Getter size bernilai 0 setelah semua task tuntas    | queue.size                                | Setelah semua promise di-await        | 0                                                           |
 * | 5  | Edge 1: getActiveContext() di luar task mengembalikan null    | queue.getActiveContext()                  | Dipanggil di luar antrean             | null                                                        |
 * | 6  | Edge 2: Satu task melempar error tidak merusak task lain      | queue.enqueue(failingTask), queue.enqueue | failingTask + succeedingTask          | Task 1 reject error aslinya, Task 2 sukses resolve          |
 * | 7  | Edge 3: Inisialisasi default name bernilai 'task-queue'       | queue.name                                | new ContextualTaskQueue()             | 'task-queue'                                                |
 * | 8  | Error 1: Konstruktor dengan options bukan object              | new ContextualTaskQueue('invalid')        | options: 'invalid'                    | TypeError: "Options must be an object"                      |
 * | 9  | Error 2: Konstruktor dengan options.name bukan string         | new ContextualTaskQueue({ name: 123 })    | options: { name: 123 }                | TypeError: "Queue name must be a string"                    |
 * | 10 | Error 3: enqueue() dengan taskFn bukan function               | queue.enqueue(null, { id: 't-1' })        | taskFn: null                          | TypeError: "Task must be a function"                        |
 * | 11 | Error 4: enqueue() dengan metadata bukan object               | queue.enqueue(() => {}, null)             | metadata: null                        | TypeError: "Metadata must be an object"                     |
 * | 12 | Error 5: enqueue() dengan metadata.id kosong                  | queue.enqueue(() => {}, { id: '   ' })    | metadata: { id: '   ' }               | TypeError: "Task ID must be a non-empty string"             |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+-------------------------------------------------------------+
 */

// Helper validasi input
const isString = (v) => typeof v === 'string' && v.trim().length > 0;
const isObject = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isFunc = (v) => typeof v === 'function';

/**
 * Antrean tugas asinkron dengan pelacakan konteks execution.
 */
export class ContextualTaskQueue {
  // Properti privat: instance penyimpanan konteks dan counter antrean
  #als;
  #size;

  /**
   * @param {object} [options={}]
   * @param {string} [options.name='task-queue']
   */
  constructor(options = {}) {
    // 1. Validasi opsi konstruktor: wajib berupa objek
    if (!isObject(options)) {
      throw new TypeError('Options must be an object');
    }

    const { name = 'task-queue' } = options;

    // 2. Validasi nama antrean: wajib string tidak kosong
    if (!isString(name)) {
      throw new TypeError('Queue name must be a string');
    }

    // 3. Inisialisasi state antrean
    this.#als = new AsyncLocalStorage();
    this.name = name;
    this.#size = 0;
  }

  /**
   * @param {Function} taskFn
   * @param {object} metadata
   * @returns {Promise<any>}
   */
  enqueue(taskFn, metadata) {
    // 1. Validasi parameter taskFn: wajib berupa function
    if (!isFunc(taskFn)) {
      throw new TypeError('Task must be a function');
    }

    // 2. Validasi parameter metadata: wajib berupa objek
    if (!isObject(metadata)) {
      throw new TypeError('Metadata must be an object');
    }

    // 3. Validasi ID metadata: wajib string tidak kosong
    if (!isString(metadata.id)) {
      throw new TypeError('Task ID must be a non-empty string');
    }

    // 4. Tambah jumlah antrean tugas yang sedang menunggu giliran (+1)
    this.#size += 1;

    // 5. Kembalikan Promise yang menjembatani hasil eksekusi asinkron
    return new Promise((resolve, reject) => {
      // Jadwalkan eksekusi ke fase Check Event Loop agar tidak memblokir tick saat ini
      setImmediate(() => {
        // Kurangi counter ruang tunggu antrean karena tugas sudah mulai dieksekusi (-1)
        this.#size -= 1;

        // Ikat metadata tugas ke dalam konteks eksekusi AsyncLocalStorage
        this.#als.run(
          { id: metadata.id, ...metadata, queueName: this.name },
          async () => {
            try {
              // Jalankan tugas dan resolve hasil return-nya
              const result = await taskFn();
              resolve(result);
            } catch (error) {
              // Jika tugas melempar error, reject tugas ini tanpa merusak antrean lainnya
              reject(error);
            }
          },
        );
      });
    });
  }

  /**
   * Mengambil konteks aktif dari alur tugas yang sedang berjalan.
   * @returns {object|null}
   */
  getActiveContext() {
    // Mengembalikan store aktif jika di dalam tugas, atau fallback ke null jika di luar
    return this.#als.getStore() ?? null;
  }

  /**
   * Mengembalikan jumlah tugas yang sedang menunggu giliran dieksekusi.
   * @returns {number}
   */
  get size() {
    return this.#size;
  }
}
