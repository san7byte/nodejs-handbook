import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * ============================================================================
 * SOAL 02 (MENENGAH): Recursive Directory Scanner & Metadata Collector
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buatlah fungsi asinkron `scanDirectory(dirPath, options)` yang bertugas
 *    menjelajahi direktori dan seluruh sub-direktorinya secara rekursif,
 *    mengumpulkan daftar berkas beserta metadatanya (nama, relativePath, size,
 *    isDirectory, ext), serta mendukung penyaringan ekstensi dan pembatasan kedalaman (maxDepth).
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:fs/promises`: `fs.stat`, `fs.readdir`.
 *    - `node:path`: `path.join`, `path.relative`, `path.extname`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Parameter `dirPath` wajib berupa string non-kosong. Jika bukan string atau kosong,
 *      lempar `TypeError` dengan pesan: 'Invalid argument: dirPath must be a non-empty string'.
 *    - Verifikasi bahwa `dirPath` ada dan benar-benar sebuah direktori via `fs.stat()`.
 *      * Jika direktori tidak ditemukan (`ENOENT`), lempar `Error` dengan pesan:
 *        `Directory not found: ${dirPath}`.
 *      * Jika target adalah file biasa (bukan direktori), lempar `Error` dengan pesan:
 *        `Target is not a directory: ${dirPath}`.
 *    - Opsi `options` bersifat opsional, dengan properti:
 *      * `extensions` (string[]): memfilter hanya berkas dengan ekstensi tertentu
 *        (contoh: `['.js', '.json']` atau `['js', 'json']`, case-insensitive).
 *        Folder tetap ditelusuri meskipun namanya tidak cocok ekstensi.
 *      * `maxDepth` (number, default: Infinity): batas kedalaman traversal.
 *        Depth 0 berarti hanya item yang berada langsung di dalam `dirPath`.
 *    - Kembalikan array berisi objek berkas (bukan folder) yang terurut alfabetis berdasarkan
 *      `relativePath` (separator POSIX standard `/`).
 *      Format tiap elemen:
 *      `{ name: string, relativePath: string, size: number, ext: string }`
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                                │ Output / Expected Behavior                              │
 * ├───────────┼────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 * │ Normal 1  │ scanDirectory('fixtures/project')                          │ Array seluruh file bersarang terurut relativePath       │
 * │ Normal 2  │ scanDirectory('fixtures/project', { extensions: ['.json']})│ Hanya mengembalikan file berekstensi .json              │
 * │ Normal 3  │ scanDirectory('fixtures/project', { maxDepth: 0 })         │ Hanya file di level root tanpa menyelami subfolder      │
 * │ Edge 1    │ scanDirectory('non-existent-folder')                       │ Lempar Error('Directory not found: ...')                │
 * │ Edge 2    │ scanDirectory('fixtures/project/file.txt')                 │ Lempar Error('Target is not a directory: ...')          │
 * │ Error 1   │ scanDirectory('')                                          │ Lempar TypeError('Invalid argument: dirPath ...')       │
 * └───────────┴────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┘
 */

/**
 * Menjelajahi direktori secara rekursif dan mengumpulkan metadata berkas.
 *
 * @param {string} dirPath
 * @param {{ extensions?: string[], maxDepth?: number }} [options={}]
 * @returns {Promise<Array<{ name: string, relativePath: string, size: number, ext: string }>>}
 */
export async function scanDirectory(dirPath, options = {}) {
  // 1. Validasi input: pastikan dirPath berupa string non-kosong
  if (typeof dirPath !== 'string' || dirPath.trim() === '') {
    throw new TypeError('Invalid argument: dirPath must be a non-empty string');
  }

  // 2. Ambil opsi filter ekstensi dan batas kedalaman (default: tanpa batas)
  const { extensions = [], maxDepth = Infinity } = options ?? {};

  // 3. Pastikan path ada dan benar-benar sebuah direktori (bukan file biasa)
  let stats;
  try {
    stats = await fs.stat(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    throw error;
  }

  if (!stats.isDirectory()) {
    throw new Error(`Target is not a directory: ${dirPath}`);
  }

  // 4. Siapkan set filter ekstensi (format .ext huruf kecil) dan wadah hasil
  const allowed = new Set(
    extensions.map((e) => (e.startsWith('.') ? e : `.${e}`).toLowerCase()),
  );
  const results = [];

  // 5. Fungsi rekursif untuk menyusuri folder
  async function walk(currentFolder, depth) {
    // Baca seluruh isi folder beserta tipe entri-nya
    const entries = await fs.readdir(currentFolder, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentFolder, entry.name);

      if (entry.isDirectory()) {
        // Jika folder: selami lebih dalam selama belum melampaui maxDepth
        if (depth < maxDepth) await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        // Lewati berkas jika tidak sesuai dengan filter ekstensi
        if (allowed.size > 0 && !allowed.has(ext.toLowerCase())) continue;

        // Ambil ukuran byte berkas dan catat ke array hasil
        const { size } = await fs.stat(fullPath);
        results.push({
          name: entry.name,
          relativePath: path
            .relative(dirPath, fullPath)
            .split(path.sep)
            .join('/'),
          size,
          ext,
        });
      }
    }
  }

  // 6. Mulai penelusuran dari root dengan kedalaman 0
  await walk(dirPath, 0);

  // 7. Urutkan hasil secara alfabetis (A-Z) berdasarkan relativePath
  return results.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
