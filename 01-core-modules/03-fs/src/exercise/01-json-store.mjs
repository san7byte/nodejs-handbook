import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * ============================================================================
 * SOAL 01 (DASAR): Safe JSON Config Store & Reader
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buatlah dua fungsi asinkron:
 *    1. `readJsonConfig(filePath, defaultConfig)`: Membaca file konfigurasi JSON.
 *       Jika file tidak ditemukan (ENOENT), kembalikan nilai `defaultConfig`.
 *       Jika isi file bukan format JSON yang valid, lempar `SyntaxError`.
 *    2. `writeJsonConfig(filePath, data)`: Menyimpan data objek ke file JSON.
 *       Fungsi harus secara otomatis memastikan direktori induk file sudah ada
 *       menggunakan `fs.mkdir({ recursive: true })` sebelum menulis, serta
 *       memformat JSON dengan indentasi 2 spasi dan baris baru di akhir file.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:fs/promises`: `fs.readFile`, `fs.writeFile`, `fs.mkdir`.
 *    - `node:path`: `path.dirname`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Parameter `filePath` pada kedua fungsi wajib berupa string non-kosong.
 *      Jika bukan string atau string kosong/hanya whitespace, lempar `TypeError`
 *      dengan pesan: 'Invalid argument: filePath must be a non-empty string'.
 *    - Tangani error `ENOENT` pada `readJsonConfig` dengan mengembalikan `defaultConfig`.
 *    - Jika file ada namun isinya rusak (malformed JSON), lempar `SyntaxError`
 *      dengan pesan yang memuat teks: `Invalid JSON in file: ${filePath}`.
 *    - Pada `writeJsonConfig`, format output JSON wajib: `JSON.stringify(data, null, 2) + '\n'`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                           │ Output / Expected Behavior                             │
 * ├───────────┼───────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┤
 * │ Normal 1  │ writeJsonConfig('storage/app.json', { env: 'test' })  │ Menulis formatted JSON, membuat folder jika belum ada  │
 * │ Normal 2  │ readJsonConfig('storage/app.json', {})                │ { env: 'test' }                                        │
 * │ Edge 1    │ readJsonConfig('missing-config.json', { port: 3000 }) │ Mengembalikan { port: 3000 } (fallback saat ENOENT)    │
 * │ Edge 2    │ readJsonConfig('corrupted.json', {})                  │ Lempar SyntaxError('Invalid JSON in file: ...')        │
 * │ Error 1   │ readJsonConfig('', {})                                │ Lempar TypeError('Invalid argument: filePath ...')     │
 * │ Error 2   │ writeJsonConfig(null, { a: 1 })                       │ Lempar TypeError('Invalid argument: filePath ...')     │
 * └───────────┴───────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┘
 */

// Validasi input: pastikan filePath bertipe string dan tidak kosong
function assertFilePath(filePath) {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new TypeError(
      'Invalid argument: filePath must be a non-empty string',
    );
  }
}

/**
 * Membaca konfigurasi JSON secara asinkron dengan fallback nilai default.
 *
 * @param {string} filePath
 * @param {any} [defaultConfig={}]
 * @returns {Promise<any>}
 */
export async function readJsonConfig(filePath, defaultConfig = {}) {
  // 1. Validasi path berkas
  assertFilePath(filePath);

  // 2. Baca isi berkas sebagai teks utf-8 (kembalikan defaultConfig jika berkas tidak ditemukan)
  let content;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') return defaultConfig;

    throw error;
  }

  // 3. Parse teks menjadi objek JSON (tangani SyntaxError jika format rusak)
  try {
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new SyntaxError(`Invalid JSON in file: ${filePath}`, {
        cause: error,
      });
    }

    throw error;
  }
}

/**
 * Menyimpan data ke file konfigurasi JSON secara asinkron.
 *
 * @param {string} filePath
 * @param {any} data
 * @returns {Promise<void>}
 */
export async function writeJsonConfig(filePath, data) {
  // 1. Validasi path berkas
  assertFilePath(filePath);

  // 2. Buat folder induk secara rekursif jika belum ada
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  // 3. Tulis data ke berkas JSON dengan format rapi (2 spasi) dan baris baru di akhir
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}
