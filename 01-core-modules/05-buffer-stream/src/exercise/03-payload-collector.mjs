import { Writable } from 'node:stream';
import { Buffer } from 'node:buffer';

/**
 * SOAL 03: Bounded Chunked Payload Aggregator & Writable Stream
 *
 * Deskripsi:
 * Buat class `ChunkedPayloadCollector` turunan `Writable` stream yang bertugas
 * mengumpulkan potongan-potongan chunk data biner/string yang mengalir secara teragregasi,
 * menerapkan batasan kuota byte maksimal secara defensif guna mencegah serangan DoS /
 * heap overflow, serta menyediakan antarmuka inspeksi metrik dan pembacaan payload.
 *
 * API resmi yang wajib digunakan:
 * - `Writable` dari `node:stream`
 * - `Buffer.concat(list, totalLength)`
 * - `Buffer.from(data, encoding)`
 * - `Buffer.isBuffer(obj)`
 * - `buffer.toString(encoding)`
 *
 * Ketentuan Validasi Input & Defensive Coding:
 * 1. Constructor `new ChunkedPayloadCollector(options = {})`:
 *    - Opsi `options.maxBytes`: Batas kapasitas akumulasi byte yang diperbolehkan (default 1048576 / 1 MB).
 *    - Jika `options.maxBytes` didefinisikan dan bernilai bukan number, bernilai <= 0, atau NaN:
 *      lempar `RangeError` dengan pesan persis:
 *      "maxBytes must be a positive number"
 * 2. State Internal:
 *    - Mengelola daftar potongan chunk yang tersimpan.
 *    - Melacak total ukuran byte (`totalBytes`).
 *    - Melacak banyaknya chunk yang berhasil diterima (`chunkCount`).
 *    - Melacak status penyelesaian stream (`isFinished`), bernilai `false` di awal dan menjadi `true`
 *      setelah lifecycle stream selesai (`_final`).
 * 3. Lifecycle Writable (`_write` dan `_final`):
 *    - `_write(chunk, encoding, callback)`:
 *      * Memvalidasi tipe chunk: wajib bertipe `Buffer` atau `string`. Jika string, ubah ke Buffer via `Buffer.from()`.
 *        Jika bukan keduanya, panggil `callback` dengan `TypeError` persis:
 *        "Chunk must be a Buffer or string"
 *      * Memeriksa batas kuota: jika `totalBytes + chunk.length > maxBytes`, hentikan stream dan
 *        panggil `callback` dengan `RangeError` persis:
 *        "Payload exceeds maximum allowed size of <maxBytes> bytes" (contoh: "Payload exceeds maximum allowed size of 10 bytes")
 *      * Jika lolos, simpan chunk ke penampung, perbarui metrik, dan panggil `callback()`.
 *    - `_final(callback)`:
 *      * Menandai `isFinished = true` lalu memanggil `callback()`.
 * 4. Method Publik:
 *    - `getBytes()`: Mengembalikan instance Buffer tunggal hasil penggabungan seluruh chunk via `Buffer.concat()`.
 *    - `toString(encoding = 'utf8')`: Mengembalikan representasi string teks dari `getBytes()` dengan encoding yang diminta.
 *    - `getStats()`: Mengembalikan object salinan statistik: `{ totalBytes, chunkCount, isFinished, maxBytes }`.
 *    - `clear()`: Mengosongkan seluruh chunk yang tersimpan, mereset `totalBytes` ke 0, `chunkCount` ke 0, dan `isFinished` ke false.
 *
 * Tabel Spesifikasi I/O:
 * +----+---------------------------------------------------------------+-------------------------------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 * | No | Skenario                                                      | Pemanggilan                                                       | Input                                 | Expected                                                                                                                                                                                          |
 * +----+---------------------------------------------------------------+-------------------------------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 * | 1  | Normal 1: Mengumpulkan multiple chunk string hingga selesai   | write('chunk-1'), write('chunk-2'), end()                         | 'chunk-1', 'chunk-2'                  | toString(): 'chunk-1chunk-2', getStats().chunkCount: 2, isFinished: true                                                                                                                         |
 * | 2  | Normal 2: Mengumpulkan chunk bertipe Buffer biner mentah      | write(Buffer.from([0x01, 0x02])), end()                           | Buffer.from([0x01, 0x02])             | getBytes(): <Buffer 01 02>, getStats().totalBytes: 2                                                                                                                                              |
 * | 3  | Normal 3: Menghubungkan collector dengan stream.pipeline      | pipeline(Readable.from(['A', 'B']), collector)                    | Readable.from(['A', 'B'])             | toString(): 'AB', getStats().isFinished: true                                                                                                                                                     |
 * | 4  | Normal 4: Membaca statistik metrik sebelum stream selesai     | write('data')                                                     | 'data'                                | getStats(): { totalBytes: 4, chunkCount: 1, isFinished: false, maxBytes: 1048576 }                                                                                                               |
 * | 5  | Normal 5: Mereset buffer collector dengan clear()             | collector.clear()                                                 | sesudah ada data                      | getStats().totalBytes: 0, getStats().chunkCount: 0, getBytes().length: 0                                                                                                                          |
 * | 6  | Edge 1: Input stream kosong tanpa chunk ditutup langsung      | end()                                                             | tidak ada chunk                       | getBytes().length: 0, toString(): '', getStats().isFinished: true                                                                                                                                 |
 * | 7  | Edge 2: Ukuran totalBytes tepat sama dengan maxBytes berhasil | maxBytes: 10, write('1234567890'), end()                          | 10 bytes pada batas 10 bytes          | getStats().totalBytes: 10, getStats().isFinished: true                                                                                                                                            |
 * | 8  | Error 1: maxBytes bernilai 0 melempar RangeError instansiasi  | new ChunkedPayloadCollector({ maxBytes: 0 })                      | { maxBytes: 0 }                       | RangeError: "maxBytes must be a positive number"                                                                                                                                                  |
 * | 9  | Error 2: maxBytes negatif melempar RangeError instansiasi     | new ChunkedPayloadCollector({ maxBytes: -50 })                    | { maxBytes: -50 }                     | RangeError: "maxBytes must be a positive number"                                                                                                                                                  |
 * | 10 | Error 3: Chunk bukan Buffer atau string melempar TypeError    | collector.write(12345, cb)                                        | 12345                                 | TypeError: "Chunk must be a Buffer or string"                                                                                                                                                     |
 * | 11 | Error 4: Akumulasi ukuran chunk melebihi maxBytes RangeError   | maxBytes: 10, write('12345678901')                                | 11 bytes pada batas 10 bytes          | RangeError: "Payload exceeds maximum allowed size of 10 bytes"                                                                                                                                    |
 * +----+---------------------------------------------------------------+-------------------------------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 */

/**
 * Writable stream teragregasi dengan pembatasan kapasitas byte dan inspeksi metrik.
 */
export class ChunkedPayloadCollector extends Writable {
  constructor(options = {}) {
    // 1. Panggil constructor Writable dengan objectMode: true agar dapat memvalidasi tipe chunk secara kustom di _write
    super({ ...options, objectMode: true });

    // 2. Ambil nilai maxBytes dengan nilai default 1 MB (1048576 byte)
    const { maxBytes = 1048576 } = options ?? {};

    // 3. Validasi batas kapasitas: wajib berupa angka positif berhingga
    if (
      typeof maxBytes !== 'number' ||
      !Number.isFinite(maxBytes) ||
      maxBytes <= 0
    ) {
      throw new RangeError('maxBytes must be a positive number');
    }

    // 4. Inisialisasi state internal instance
    this.maxBytes = maxBytes;
    this.chunks = [];
    this.totalBytes = 0;
    this.chunkCount = 0;
    this.isFinished = false;
  }

  /**
   * Lifecycle Writable: dipanggil setiap kali ada chunk data yang masuk
   */
  _write(chunk, encoding, callback) {
    // 1. Validasi tipe data chunk: hanya menerima instance Buffer atau string
    if (!Buffer.isBuffer(chunk) && typeof chunk !== 'string') {
      return callback(new TypeError('Chunk must be a Buffer or string'));
    }

    // 2. Normalisasi chunk: jika string, konversikan ke Buffer biner
    const bufChunk = typeof chunk === 'string'
      ? Buffer.from(chunk, encoding)
      : chunk;

    const chunkSize = bufChunk.length;

    // 3. Defensive boundary check: pastikan kuota akumulasi byte tidak melebihi maxBytes
    if (this.totalBytes + chunkSize > this.maxBytes) {
      return callback(
        new RangeError(
          'Payload exceeds maximum allowed size of ' + this.maxBytes + ' bytes',
        ),
      );
    }

    // 4. Simpan potongan buffer ke array penampung dan perbarui metrik
    this.chunks.push(bufChunk);
    this.totalBytes += chunkSize;
    this.chunkCount++;

    // 5. Beritahu Node.js bahwa chunk berhasil diproses
    callback();
  }

  /**
   * Lifecycle Writable: dipanggil ketika stream ditutup dan seluruh data selesai ditulis
   */
  _final(callback) {
    this.isFinished = true;
    callback();
  }

  /**
   * Menggabungkan seluruh potongan chunk tersimpan menjadi satu Buffer utuh
   * @returns {Buffer}
   */
  getBytes() {
    return Buffer.concat(this.chunks, this.totalBytes);
  }

  /**
   * Mengembalikan representasi teks dari buffer yang terkumpul
   * @param {string} [encoding='utf8']
   * @returns {string}
   */
  toString(encoding = 'utf8') {
    return this.getBytes().toString(encoding);
  }

  /**
   * Mengembalikan salinan objek statistik saat ini
   * @returns {{ totalBytes: number, chunkCount: number, isFinished: boolean, maxBytes: number }}
   */
  getStats() {
    return {
      totalBytes: this.totalBytes,
      chunkCount: this.chunkCount,
      isFinished: this.isFinished,
      maxBytes: this.maxBytes,
    };
  }

  /**
   * Mengosongkan data buffer dan mereset metrik kembali ke kondisi awal
   */
  clear() {
    this.chunks = [];
    this.totalBytes = 0;
    this.chunkCount = 0;
    this.isFinished = false;
  }
}
