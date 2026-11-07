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
 *    - Parameter `baseDir` dan `relativeFile` wajib berupa string, non-kosong.
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
 * ┌───────────┬──────────────────┬─────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ baseDir          │ relativeFile                │ Output / Expected Behavior                                                                             │
 * ├───────────┼──────────────────┼─────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ 'uploads'        │ 'images/avatar.png'         │ { fullPath: 'uploads/images/avatar.png', isAbsolute: false, dirname: 'uploads/images',                 │
 * │           │                  │                             │   basename: 'avatar.png', extname: '.png', filenameWithoutExt: 'avatar' }                              │
 * │ Normal 2  │ '/var/www'       │ 'public/styles.min.css'     │ { fullPath: '/var/www/public/styles.min.css', isAbsolute: true, dirname: '/var/www/public',           │
 * │           │                  │                             │   basename: 'styles.min.css', extname: '.css', filenameWithoutExt: 'styles.min' }                      │
 * │ Edge 1    │ '/app/data'      │ '../config//db.json'        │ { fullPath: '/app/config/db.json', isAbsolute: true, dirname: '/app/config',                          │
 * │           │                  │                             │   basename: 'db.json', extname: '.json', filenameWithoutExt: 'db' }                                   │
 * │ Edge 2    │ 'project'        │ '.env'                      │ { fullPath: 'project/.env', isAbsolute: false, dirname: 'project',                                    │
 * │           │                  │                             │   basename: '.env', extname: '', filenameWithoutExt: '.env' }                                         │
 * │ Edge 3    │ 'backup'         │ 'data.tar.gz'               │ { fullPath: 'backup/data.tar.gz', isAbsolute: false, dirname: 'backup',                                │
 * │           │                  │                             │   basename: 'data.tar.gz', extname: '.gz', filenameWithoutExt: 'data.tar' }                            │
 * │ Error 1   │ ''               │ 'doc.pdf'                   │ Lempar TypeError('Invalid argument: baseDir and relativeFile must be non-empty strings')              │
 * │ Error 2   │ 'data'           │ '   '                       │ Lempar TypeError('Invalid argument: baseDir and relativeFile must be non-empty strings')              │
 * │ Error 3   │ null             │ 123                         │ Lempar TypeError('Invalid argument: baseDir and relativeFile must be non-empty strings')              │
 * └───────────┴──────────────────┴─────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Normalizes an asset path and extracts its architectural components.
 *
 * @param {string} baseDir - Base directory path
 * @param {string} relativeFile - Relative asset file path
 * @returns {{
 *   fullPath: string,
 *   isAbsolute: boolean,
 *   dirname: string,
 *   basename: string,
 *   extname: string,
 *   filenameWithoutExt: string
 * }}
 */
export function normalizeAssetPath(baseDir, relativeFile) {
  const falseBaseDir = typeof baseDir !== 'string' || baseDir.trim() === '';
  const falseRelativeFile =
    typeof relativeFile !== 'string' || relativeFile.trim() === '';

  if (falseBaseDir || falseRelativeFile) {
    throw new TypeError(
      'Invalid argument: baseDir and relativeFile must be non-empty strings',
    );
  }

  const fullPath = path.join(baseDir, relativeFile);
  const isAbsolute = path.isAbsolute(fullPath);
  const dirname = path.dirname(fullPath);
  const basename = path.basename(fullPath);
  const extname = path.extname(fullPath);
  const filenameWithoutExt = path.basename(fullPath, extname);

  return {
    fullPath,
    isAbsolute,
    dirname,
    basename,
    extname,
    filenameWithoutExt,
  };
}

// ============================================================================
// TEST RUNNER (ISOLATED)
// ============================================================================

let passedCount = 0;
let failedCount = 0;

function runTest(scenarioName, testFn) {
  try {
    testFn();
    console.log(`[PASS] ${scenarioName}`);
    passedCount++;
  } catch (err) {
    console.log(`[FAIL] ${scenarioName}: ${err.message}`);
    failedCount++;
  }
}

console.log('=== TEST SOAL 01: normalizeAssetPath ===\n');

// 1. Normal relative asset path
runTest('Skenario Normal 1: Relative Path', () => {
  const res = normalizeAssetPath('uploads', 'images/avatar.png');
  const expectedPath = path.join('uploads', 'images', 'avatar.png');
  const expectedDir = path.join('uploads', 'images');

  if (res.fullPath !== expectedPath)
    throw new Error(
      `fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`,
    );
  if (res.isAbsolute !== false)
    throw new Error(
      `isAbsolute mismatch: expected false, got ${res.isAbsolute}`,
    );
  if (res.dirname !== expectedDir)
    throw new Error(
      `dirname mismatch: expected ${expectedDir}, got ${res.dirname}`,
    );
  if (res.basename !== 'avatar.png')
    throw new Error(
      `basename mismatch: expected avatar.png, got ${res.basename}`,
    );
  if (res.extname !== '.png')
    throw new Error(`extname mismatch: expected .png, got ${res.extname}`);
  if (res.filenameWithoutExt !== 'avatar')
    throw new Error(
      `filenameWithoutExt mismatch: expected avatar, got ${res.filenameWithoutExt}`,
    );
});

// 2. Normal absolute path
runTest('Skenario Normal 2: Absolute Path', () => {
  const res = normalizeAssetPath('/var/www', 'public/styles.min.css');
  const expectedPath = path.normalize('/var/www/public/styles.min.css');
  const expectedDir = path.normalize('/var/www/public');

  if (res.fullPath !== expectedPath)
    throw new Error(
      `fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`,
    );
  if (res.isAbsolute !== true)
    throw new Error(
      `isAbsolute mismatch: expected true, got ${res.isAbsolute}`,
    );
  if (res.dirname !== expectedDir)
    throw new Error(
      `dirname mismatch: expected ${expectedDir}, got ${res.dirname}`,
    );
  if (res.basename !== 'styles.min.css')
    throw new Error(
      `basename mismatch: expected styles.min.css, got ${res.basename}`,
    );
  if (res.extname !== '.css')
    throw new Error(`extname mismatch: expected .css, got ${res.extname}`);
  if (res.filenameWithoutExt !== 'styles.min')
    throw new Error(
      `filenameWithoutExt mismatch: expected styles.min, got ${res.filenameWithoutExt}`,
    );
});

// 3. Edge 1: Redundant slashes and relative directory hops
runTest('Skenario Edge 1: Redundant Slashes & Navigation Segments', () => {
  const res = normalizeAssetPath('/app/data', '../config//db.json');
  const expectedPath = path.normalize('/app/config/db.json');
  const expectedDir = path.normalize('/app/config');

  if (res.fullPath !== expectedPath)
    throw new Error(
      `fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`,
    );
  if (res.isAbsolute !== true)
    throw new Error(
      `isAbsolute mismatch: expected true, got ${res.isAbsolute}`,
    );
  if (res.dirname !== expectedDir)
    throw new Error(
      `dirname mismatch: expected ${expectedDir}, got ${res.dirname}`,
    );
  if (res.basename !== 'db.json')
    throw new Error(`basename mismatch: expected db.json, got ${res.basename}`);
  if (res.extname !== '.json')
    throw new Error(`extname mismatch: expected .json, got ${res.extname}`);
  if (res.filenameWithoutExt !== 'db')
    throw new Error(
      `filenameWithoutExt mismatch: expected db, got ${res.filenameWithoutExt}`,
    );
});

// 4. Edge 2: Dotfile handling
runTest('Skenario Edge 2: Dotfile tanpa ekstensi sekunder (.env)', () => {
  const res = normalizeAssetPath('project', '.env');
  const expectedPath = path.join('project', '.env');

  if (res.fullPath !== expectedPath)
    throw new Error(
      `fullPath mismatch: expected ${expectedPath}, got ${res.fullPath}`,
    );
  if (res.basename !== '.env')
    throw new Error(`basename mismatch: expected .env, got ${res.basename}`);
  if (res.extname !== '')
    throw new Error(
      `extname mismatch: expected empty string, got '${res.extname}'`,
    );
  if (res.filenameWithoutExt !== '.env')
    throw new Error(
      `filenameWithoutExt mismatch: expected .env, got ${res.filenameWithoutExt}`,
    );
});

// 5. Edge 3: Multi-dot file handling (.tar.gz)
runTest('Skenario Edge 3: Multi-dot Archive File (.tar.gz)', () => {
  const res = normalizeAssetPath('backup', 'data.tar.gz');
  if (res.basename !== 'data.tar.gz')
    throw new Error(
      `basename mismatch: expected data.tar.gz, got ${res.basename}`,
    );
  if (res.extname !== '.gz')
    throw new Error(`extname mismatch: expected .gz, got ${res.extname}`);
  if (res.filenameWithoutExt !== 'data.tar')
    throw new Error(
      `filenameWithoutExt mismatch: expected data.tar, got ${res.filenameWithoutExt}`,
    );
});

// 6. Error 1: Empty string input
runTest('Skenario Error 1: String Kosong', () => {
  let thrown = false;
  try {
    normalizeAssetPath('', 'doc.pdf');
  } catch (err) {
    thrown = true;
    if (!(err instanceof TypeError))
      throw new Error(`Expected TypeError, got ${err.name}: ${err.message}`);
    if (!err.message.includes('must be non-empty strings')) {
      throw new Error(
        `Expected error message to include 'must be non-empty strings', got: ${err.message}`,
      );
    }
  }
  if (!thrown)
    throw new Error('Fungsi harus melempar TypeError saat baseDir kosong');
});

// 7. Error 2: Whitespace only string
runTest('Skenario Error 2: String Hanya Spasi', () => {
  let thrown = false;
  try {
    normalizeAssetPath('data', '   ');
  } catch (err) {
    thrown = true;
    if (!(err instanceof TypeError))
      throw new Error(`Expected TypeError, got ${err.name}: ${err.message}`);
    if (!err.message.includes('must be non-empty strings')) {
      throw new Error(
        `Expected error message to include 'must be non-empty strings', got: ${err.message}`,
      );
    }
  }
  if (!thrown)
    throw new Error(
      'Fungsi harus melempar TypeError saat relativeFile hanya berisi whitespace',
    );
});

// 8. Error 3: Non-string data types
runTest('Skenario Error 3: Tipe Data Bukan String', () => {
  let thrown = false;
  try {
    normalizeAssetPath(null, 123);
  } catch (err) {
    thrown = true;
    if (!(err instanceof TypeError))
      throw new Error(`Expected TypeError, got ${err.name}: ${err.message}`);
  }
  if (!thrown)
    throw new Error(
      'Fungsi harus melempar TypeError saat argumen bukan string',
    );
});

console.log('\n--------------------------------------------------');
console.log(
  `Ringkasan: ${passedCount} / ${passedCount + failedCount} lulus (${failedCount} gagal)`,
);
console.log('--------------------------------------------------');

if (failedCount > 0) {
  process.exitCode = 1;
}
