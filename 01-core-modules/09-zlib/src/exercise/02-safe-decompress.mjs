import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

/**
 * ============================================================================
 * SOAL 02: Safe Multi-Format Decompressor with Zip-Bomb Protection
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Fungsi asinkron `safeDecompress(buffer, options)` bertugas mendekompresi payload
 *    biner (mendukung format kompresi Gzip maupun Deflate secara otomatis) dengan batas
 *    alokasi memori ketat untuk mencegah serangan denial-of-service / zip-bomb.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:zlib`: `createUnzip` (atau `gunzip`/`inflate`/`unzip`).
 *    - `node:stream`: `Readable` atau `node:stream/promises`: `pipeline`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Validasi Tipe Data: Argumen `buffer` wajib merupakan instance `Buffer`.
 *      Jika bukan (misal `string`, `number`, `null`, `undefined`),
 *      lempar `TypeError('Input must be a Buffer')`.
 *    - Validasi Buffer Kosong: Jika `buffer.length === 0`,
 *      lempar `Error('Buffer cannot be empty')`.
 *    - Validasi Opsi Batas Memori (`options.maxBytes`):
 *      - Argumen `options` bersifat opsional (default `{}`).
 *      - Jika `options.maxBytes` didefinisikan, nilainya wajib berupa integer positif
 *        (`typeof options.maxBytes === 'number' && Number.isInteger(options.maxBytes) && options.maxBytes > 0`).
 *      - Jika tidak valid (misal `0`, `-10`, `'100'`, `3.14`, `NaN`),
 *        lempar `RangeError('maxBytes must be a positive integer')`.
 *    - Dukungan Multi-Format: Fungsi harus mampu mendekompresi data yang dikompresi
 *      menggunakan algoritma Gzip maupun Deflate.
 *    - Perlindungan Zip-Bomb: Jika total byte yang dihasilkan dari dekompresi melebihi
 *      `options.maxBytes`, hentikan proses dekompresi dan
 *      lempar `Error('Decompressed size exceeds limit')`.
 *    - Penanganan Data Korup: Jika buffer tidak valid, terpotong, atau bukan format
 *      terkompresi yang sah, tangkap error dekompresi dan
 *      lempar `Error('Corrupted or invalid compressed data')`.
 *    - Nilai Kembalian: Mengembalikan Promise yang menyelesaikan (`resolve`) ke instance
 *      `Buffer` hasil dekompresi.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬─────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                                 │ Input                                                                  │ Expected                                                 │
 * ├───────────┼─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 * │ Normal 1  │ safeDecompress(gzipBuffer)                                  │ buffer: Gzip buffer dari 'Gzip decompressed content'                   │ Buffer berisi 'Gzip decompressed content'                │
 * │ Normal 2  │ safeDecompress(deflateBuffer)                               │ buffer: Deflate buffer dari 'Deflate decompressed content'             │ Buffer berisi 'Deflate decompressed content'             │
 * │ Normal 3  │ safeDecompress(gzipBuffer, { maxBytes: 500 })               │ buffer: Gzip buffer 50 bytes decompressed, options: { maxBytes: 500 }  │ Buffer hasil dekompresi utuh                             │
 * │ Edge 1    │ safeDecompress(gzipBuffer, { maxBytes: 25 })                │ buffer: Gzip buffer tepat 25 bytes decompressed, { maxBytes: 25 }      │ Buffer hasil dekompresi utuh (tepat di batas limit)      │
 * │ Error 1   │ safeDecompress('not-a-buffer')                              │ buffer: 'not-a-buffer' (string)                                        │ Lempar TypeError('Input must be a Buffer')               │
 * │ Error 2   │ safeDecompress(Buffer.alloc(0))                             │ buffer: Buffer.alloc(0)                                                │ Lempar Error('Buffer cannot be empty')                   │
 * │ Error 3   │ safeDecompress(gzipBuffer, { maxBytes: 0 })                 │ options: { maxBytes: 0 }                                               │ Lempar RangeError('maxBytes must be a positive integer') │
 * │ Error 4   │ safeDecompress(gzipBuffer, { maxBytes: -10 })               │ options: { maxBytes: -10 }                                             │ Lempar RangeError('maxBytes must be a positive integer') │
 * │ Error 5   │ safeDecompress(gzipBuffer, { maxBytes: '100' })             │ options: { maxBytes: '100' }                                           │ Lempar RangeError('maxBytes must be a positive integer') │
 * │ Error 6   │ safeDecompress(largePayloadGzip, { maxBytes: 50 })          │ buffer: uncompressed 1000 bytes, options: { maxBytes: 50 }             │ Lempar Error('Decompressed size exceeds limit')          │
 * │ Error 7   │ safeDecompress(Buffer.from('corrupted-archive-header'))     │ buffer: invalid non-compressed bytes                                   │ Lempar Error('Corrupted or invalid compressed data')     │
 * └───────────┴─────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
 */

// Helper untuk memastikan batas memori adalah bilangan bulat positif
const isValidMaxBytes = (v) => Number.isInteger(v) && v > 0;

/**
 * Mendekompresi payload biner Gzip/Deflate dengan batas alokasi memori maksimum.
 *
 * @param {Buffer} buffer
 * @param {{ maxBytes?: number }} [options]
 * @returns {Promise<Buffer>}
 */
export async function safeDecompress(buffer, options = {}) {
  // Guard clause: pastikan input benar-benar instance Buffer
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Input must be a Buffer');
  }

  // Tolak Buffer kosong karena tidak ada data yang bisa didekompresi
  if (buffer.length === 0) {
    throw new Error('Buffer cannot be empty');
  }

  // Validasi opsi maxBytes hanya jika propertinya diberikan
  const maxBytes = options?.maxBytes;

  if (maxBytes !== undefined && !isValidMaxBytes(maxBytes)) {
    throw new RangeError('maxBytes must be a positive integer');
  }

  // Siapkan batas ukuran (tanpa batas jika undefined) dan instance error penanda (sentinel)
  const limit = maxBytes ?? Infinity;
  const limitError = new Error('Decompressed size exceeds limit');
  const chunks = [];
  let totalBytes = 0;

  try {
    // Alirkan buffer lewat createUnzip (deteksi otomatis Gzip atau Deflate) lalu kumpulkan chunk
    await pipeline(
      Readable.from(buffer),
      zlib.createUnzip(),
      async (source) => {
        for await (const chunk of source) {
          totalBytes += chunk.length;

          // Hentikan pipeline seketika jika total byte melewati batas (proteksi zip-bomb)
          if (totalBytes > limit) {
            throw limitError;
          }

          chunks.push(chunk);
        }
      },
    );
  } catch (error) {
    // Jika error berasal dari pelanggaran batas maxBytes, teruskan error aslinya tanpa diubah
    if (error === limitError) {
      throw error;
    }

    // Error lain berasal dari stream zlib (data rusak/header tidak valid); simpan penyebab aslinya di cause
    throw new Error('Corrupted or invalid compressed data', { cause: error });
  }

  // Gabungkan semua chunk menjadi satu Buffer dengan panjang totalBytes yang sudah diketahui pasti
  return Buffer.concat(chunks, totalBytes);
}
