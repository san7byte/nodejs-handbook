import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * ============================================================================
 * SOAL 03 (KOMPLEKS): Atomic Backup Creator & Log Rotator
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buatlah fungsi asinkron `createAtomicBackup(sourceFile, backupDir, options)`
 *    yang menyalin berkas sumber ke folder cadangan dengan teknik *atomic write*
 *    (tulis ke file sementara dengan ekstensi `.tmp` lalu `rename`), memberi nama
 *    berkas dengan format unik berbasis timestamp, serta melakukan rotasi backup
 *    otomatis agar total berkas cadangan tidak melampaui `maxBackups`.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:fs/promises`: `fs.stat`, `fs.mkdir`, `fs.writeFile`, `fs.readFile`,
 *      `fs.rename`, `fs.readdir`, `fs.unlink`.
 *    - `node:path`: `path.basename`, `path.extname`, `path.join`.
 *    - `node:crypto`: `crypto.randomUUID`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Parameter `sourceFile` dan `backupDir` wajib berupa string non-kosong.
 *      Jika bukan string atau string kosong/whitespace, lempar `TypeError`
 *      dengan pesan: 'Invalid argument: sourceFile and backupDir must be non-empty strings'.
 *    - Cek status `sourceFile` menggunakan `fs.stat()`:
 *      * Jika berkas tidak ditemukan (`ENOENT`), lempar `Error` dengan pesan:
 *        `Source file does not exist: ${sourceFile}`.
 *      * Jika `sourceFile` adalah sebuah direktori (`stat.isDirectory()`), lempar `Error`
 *        dengan pesan: 'Source file cannot be a directory'.
 *    - Opsi `options` mencakup:
 *      * `maxBackups` (number, default: 3): kuota maksimum berkas backup yang disimpan.
 *      * `prefix` (string, default: 'backup'): prefix nama file cadangan.
 *    - Pola Penamaan Berkas Cadangan:
 *      `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`
 *    - Penulisan Atomik:
 *      * Baca konten `sourceFile` dan tulis ke berkas sementara di dalam `backupDir`:
 *        `.tmp-${crypto.randomUUID()}`.
 *      * Pindahkan/timpa berkas sementara ke nama berkas cadangan final menggunakan `fs.rename()`.
 *    - Logika Rotasi Cadangan (*Pruning*):
 *      * Cari seluruh berkas di `backupDir` yang namanya diawali dengan `${prefix}-`
 *        dan bukan file temporer (`.tmp-`).
 *      * Ambil `stat.mtimeMs` untuk masing-masing berkas cadangan tersebut.
 *      * Jika jumlah total melebihi `maxBackups`, urutkan dari yang paling lama/tua
 *        (*oldest first*) dan hapus berkas cadangan tertua menggunakan `fs.unlink()`
 *        hingga tersisa tepat `maxBackups` berkas.
 *    - Kembalikan objek ringkasan:
 *      `{ backupPath: string, filename: string, size: number, rotatedCount: number }`
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬─────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                                 │ Output / Expected Behavior                              │
 * ├───────────┼─────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
 * │ Normal 1  │ createAtomicBackup('app.log', 'backups')                    │ Backup dibuat secara atomik, rotatedCount: 0            │
 * │ Normal 2  │ createAtomicBackup('app.log', 'backups', { maxBackups: 2 }) │ Jika ada 3 backup, file tertua dihapus, rotatedCount: 1 │
 * │ Edge 1    │ createAtomicBackup('missing.log', 'backups')                │ Lempar Error('Source file does not exist: ...')         │
 * │ Edge 2    │ createAtomicBackup('src-folder', 'backups')                 │ Lempar Error('Source file cannot be a directory')       │
 * │ Error 1   │ createAtomicBackup('', 'backups')                           │ Lempar TypeError('Invalid argument: ...')               │
 * └───────────┴─────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────┘
 */

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Membuat backup berkas secara atomik dan merotasi cadangan lama.
 *
 * @param {string} sourceFile
 * @param {string} backupDir
 * @param {{ maxBackups?: number, prefix?: string }} [options={}]
 * @returns {Promise<{ backupPath: string, filename: string, size: number, rotatedCount: number }>}
 */
export async function createAtomicBackup(sourceFile, backupDir, options = {}) {
  // 1. Validasi input: pastikan sourceFile dan backupDir berupa string non-kosong
  if (!isNonEmptyString(sourceFile) || !isNonEmptyString(backupDir)) {
    throw new TypeError(
      'Invalid argument: sourceFile and backupDir must be non-empty strings',
    );
  }

  // 2. Periksa status berkas sumber: pastikan berkas ada dan bukan direktori
  let sourceStats;
  try {
    sourceStats = await fs.stat(sourceFile);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Source file does not exist: ${sourceFile}`);
    }
    throw error;
  }

  if (sourceStats.isDirectory()) {
    throw new Error('Source file cannot be a directory');
  }

  // 3. Konfigurasi opsi dengan nilai default
  const { maxBackups = 3, prefix = 'backup' } = options ?? {};

  // 4. Pastikan direktori backup sudah terbentuk di disk
  await fs.mkdir(backupDir, { recursive: true });

  // 5. Susun nama dan path berkas: file temporer dan file cadangan final
  const ext = path.extname(sourceFile);
  const backupFilename = `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
  const tempPath = path.join(backupDir, `.tmp-${crypto.randomUUID()}`);
  const finalBackupPath = path.join(backupDir, backupFilename);

  // 6. Atomic write: tulis ke temp, lalu rename. Buffer (tanpa encoding) agar aman untuk file biner.
  try {
    const content = await fs.readFile(sourceFile);
    await fs.writeFile(tempPath, content);
    await fs.rename(tempPath, finalBackupPath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {}); // bersihkan temp bila gagal
    throw error;
  }

  // 7. Ambil seluruh berkas cadangan dengan prefix yang cocok (abaikan file .tmp)
  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const candidates = entries.filter(
    (entry) => entry.isFile() && entry.name.startsWith(`${prefix}-`),
  );

  const existingBackups = await Promise.all(
    candidates.map(async (entry) => {
      const fullPath = path.join(backupDir, entry.name);
      const { mtimeMs } = await fs.stat(fullPath);

      return { path: fullPath, mtimeMs };
    }),
  );

  // 8. Rotasi cadangan: jika melebihi kuota maxBackups, pangkas berkas-berkas tertua
  let rotatedCount = 0;
  if (existingBackups.length > maxBackups) {
    existingBackups.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const excessBackups = existingBackups.slice(
      0,
      existingBackups.length - maxBackups,
    );
    rotatedCount = excessBackups.length;

    for (const backup of excessBackups) {
      await fs.unlink(backup.path);
    }
  }

  // 9. Dapatkan ukuran byte berkas cadangan final
  const { size } = await fs.stat(finalBackupPath);

  // 10. Kembalikan objek ringkasan
  return {
    backupPath: finalBackupPath,
    filename: backupFilename,
    size,
    rotatedCount,
  };
}
