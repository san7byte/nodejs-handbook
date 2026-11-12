import path from 'node:path';

/**
 * ============================================================================
 * SOAL 01 (DASAR): Asset Path Normalizer & Decomposer
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buatlah fungsi `normalizeAssetPath(baseDir, relativeFile)` yang bertugas
 *    menggabungkan dua segmen direktori menjadi satu path aset ternormalisasi,
 *    mengecek apakah path bersifat absolut, dan membedah seluruh komponennya
 *    (dirname, basename, extname, dan nama berkas murni tanpa ekstensi).
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:path`: `path.join`, `path.normalize`, `path.isAbsolute`,
 *      `path.dirname`, `path.basename`, `path.extname`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Parameter `baseDir` dan `relativeFile` wajib berupa string non-kosong.
 *      Jika bukan string atau string kosong/hanya spasi, lempar `TypeError`
 *      dengan pesan: 'Invalid argument: baseDir and relativeFile must be non-empty strings'.
 *    - Normalkan separator ganda dan segmen relatif (`..`, `.`) melalui `path.join()`
 *      atau `path.normalize()`.
 *    - Nilai `filenameWithoutExt` harus mengekstrak nama berkas tanpa ekstensinya.
 *      Gunakan `path.basename(fullPath, ext)`.
 *    - Penanganan dotfiles (contoh: `.env`): Node.js menganggap tanda titik di awal
 *      sebagai nama file, sehingga `extname` adalah string kosong `""` dan
 *      `filenameWithoutExt` tetap bernilai `".env"`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────────────────────────────────────┬──────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                           │ Input                                    │ Expected                                                               │
 * ├───────────┼───────────────────────────────────────────────────────┼──────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ normalizeAssetPath('uploads', 'images/avatar.png')    │ baseDir: 'uploads', rel: 'images/avatar' │ { fullPath: 'uploads/images/avatar.png', isAbsolute: false, ... }      │
 * │ Normal 2  │ normalizeAssetPath('/var/www', 'public/styles.css')   │ baseDir: '/var/www', rel: 'public/styles'│ { fullPath: '/var/www/public/styles.min.css', isAbsolute: true, ... }  │
 * │ Edge 1    │ normalizeAssetPath('/app/data', '../config//db.json') │ baseDir: '/app/data', rel: '../config'   │ { fullPath: '/app/config/db.json', isAbsolute: true, ... }             │
 * │ Edge 2    │ normalizeAssetPath('project', '.env')                 │ baseDir: 'project', rel: '.env'          │ { fullPath: 'project/.env', extname: '', filenameWithoutExt: '.env' }  │
 * │ Edge 3    │ normalizeAssetPath('backup', 'data.tar.gz')           │ baseDir: 'backup', rel: 'data.tar.gz'    │ { fullPath: 'backup/data.tar.gz', extname: '.gz', filename: 'data.tar' │
 * │ Error 1   │ normalizeAssetPath('', 'doc.pdf')                     │ baseDir: ''                              │ Lempar TypeError('Invalid argument: ...')                              │
 * │ Error 2   │ normalizeAssetPath('data', '   ')                     │ relativeFile: '   '                      │ Lempar TypeError('Invalid argument: ...')                              │
 * │ Error 3   │ normalizeAssetPath(null, 123)                         │ baseDir: null, relativeFile: 123         │ Lempar TypeError('Invalid argument: ...')                              │
 * └───────────┴───────────────────────────────────────────────────────┴──────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Menormalisasi dan membedah segmen path menjadi komponen metadata berkas.
 *
 * @param {string} baseDir
 * @param {string} relativeFile
 * @returns {{ fullPath: string, isAbsolute: boolean, dirname: string, basename: string, extname: string, filenameWithoutExt: string }}
 */
export function normalizeAssetPath(baseDir, relativeFile) {
  // 1. Validasi input: pastikan baseDir dan relativeFile berupa string non-kosong
  const falseBaseDir = typeof baseDir !== 'string' || baseDir.trim() === '';
  const falseRelativeFile =
    typeof relativeFile !== 'string' || relativeFile.trim() === '';

  if (falseBaseDir || falseRelativeFile) {
    throw new TypeError(
      'Invalid argument: baseDir and relativeFile must be non-empty strings',
    );
  }

  // 2. Gabungkan path dan bedah komponennya (dirname, basename, extname)
  const fullPath = path.join(baseDir, relativeFile);
  const isAbsolute = path.isAbsolute(fullPath);
  const dirname = path.dirname(fullPath);
  const basename = path.basename(fullPath);
  const extname = path.extname(fullPath);
  const filenameWithoutExt = path.basename(fullPath, extname);

  // 3. Kembalikan objek metadata path
  return {
    fullPath,
    isAbsolute,
    dirname,
    basename,
    extname,
    filenameWithoutExt,
  };
}
