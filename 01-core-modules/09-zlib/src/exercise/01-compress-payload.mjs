import zlib from 'node:zlib';
import { promisify } from 'node:util';

/**
 * ============================================================================
 * SOAL 01: Asynchronous Payload Compressor
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Fungsi asinkron `compressPayload(data, options)` bertugas mengompresi payload
 *    teks atau buffer ke dalam format biner terkompresi Gzip menggunakan `node:zlib`.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:zlib`: `gzip` (atau `gzipSync`).
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Validasi Tipe Data: Argumen `data` wajib bertipe `string` atau instance `Buffer`.
 *      Jika diberikan tipe selain itu (misal `number`, `null`, `undefined`, `object`, `boolean`),
 *      lempar `TypeError('Input must be a string or Buffer')`.
 *    - Validasi Data Kosong: Jika `data` berupa string kosong (`''`) atau buffer berukuran
 *      nol (`Buffer.isBuffer(data) && data.length === 0`),
 *      lempar `Error('Data cannot be empty')`.
 *    - Validasi Opsi Kompresi: Argumen `options` bersifat opsional (default `{}`).
 *      Jika `options.level` didefinisikan:
 *      - Wajib berupa bilangan bulat (`Number.isInteger(options.level)`).
 *      - Wajib berada di rentang 1 hingga 9 inklusif (`options.level >= 1 && options.level <= 9`).
 *      - Jika bukan integer atau di luar rentang (misal `0`, `10`, `'6'`, `4.5`),
 *        lempar `RangeError('Invalid compression level')`.
 *      - Jika `options.level` tidak didefinisikan, gunakan level default `6`.
 *    - Nilai Kembalian: Mengembalikan Promise yang menyelesaikan (`resolve`) ke instance
 *      `Buffer` berisi data terkompresi Gzip.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                           │ Input                                                  │ Expected                                                 │
 * ├───────────┼───────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────┤
 * │ Normal 1  │ compressPayload('Hello World')                        │ data: 'Hello World'                                    │ Buffer terkompresi Gzip valid (gunzip -> 'Hello World')  │
 * │ Normal 2  │ compressPayload(Buffer.from('Binary content'))        │ data: Buffer.from('Binary content')                    │ Buffer terkompresi Gzip valid (gunzip -> 'Binary')       │
 * │ Normal 3  │ compressPayload('Configured level text', { level: 9 })│ data: 'Configured level text', options: { level: 9 }   │ Buffer terkompresi Gzip valid dengan level 9             │
 * │ Edge 1    │ compressPayload('Default level fallback', {})         │ data: 'Default level fallback', options: {}            │ Buffer terkompresi Gzip valid dengan default level 6     │
 * │ Error 1   │ compressPayload(12345)                                │ data: 12345                                            │ Lempar TypeError('Input must be a string or Buffer')     │
 * │ Error 2   │ compressPayload(null)                                 │ data: null                                             │ Lempar TypeError('Input must be a string or Buffer')     │
 * │ Error 3   │ compressPayload('')                                   │ data: ''                                               │ Lempar Error('Data cannot be empty')                     │
 * │ Error 4   │ compressPayload(Buffer.alloc(0))                      │ data: Buffer.alloc(0)                                  │ Lempar Error('Data cannot be empty')                     │
 * │ Error 5   │ compressPayload('Data', { level: 10 })                │ options: { level: 10 }                                 │ Lempar RangeError('Invalid compression level')           │
 * │ Error 6   │ compressPayload('Data', { level: 0 })                 │ options: { level: 0 }                                  │ Lempar RangeError('Invalid compression level')           │
 * │ Error 7   │ compressPayload('Data', { level: 4.5 })               │ options: { level: 4.5 }                                │ Lempar RangeError('Invalid compression level')           │
 * └───────────┴───────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
 */

// Ubah zlib.gzip berbasis callback menjadi fungsi Promise agar mendukung async/await
const gzip = promisify(zlib.gzip);

// Helper validasi: cek tipe input, pastikan tidak kosong, dan pastikan level berada di rentang 1–9
const isStringOrBuffer = (v) => typeof v === 'string' || Buffer.isBuffer(v);
const isNotEmpty = (v) => v.length > 0;
const isValidLevel = (v) => Number.isInteger(v) && v >= 1 && v <= 9;

/**
 * Mengompresi payload teks atau buffer ke format biner Gzip.
 *
 * @param {string|Buffer} data
 * @param {{ level?: number }} [options]
 * @returns {Promise<Buffer>}
 */
export async function compressPayload(data, options = {}) {
  // Guard clause: tolak tipe data selain string atau Buffer
  if (!isStringOrBuffer(data)) {
    throw new TypeError('Input must be a string or Buffer');
  }

  // Guard clause: tolak string kosong ('') atau Buffer berukuran 0 byte
  if (!isNotEmpty(data)) {
    throw new Error('Data cannot be empty');
  }

  // Ambil level kompresi dari opsi dengan nilai default 6 jika tidak diisi
  const { level = 6 } = options ?? {};

  // Pastikan level kompresi berupa bilangan bulat valid (1–9 inklusif)
  if (!isValidLevel(level)) {
    throw new RangeError('Invalid compression level');
  }

  // Jalankan kompresi Gzip asinkron (zlib.gzip menerima string maupun Buffer langsung)
  return gzip(data, { level });
}
