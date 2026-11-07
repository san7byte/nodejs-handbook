import path from 'node:path';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

/**
 * ============================================================================
 * SOAL 03 (KOMPLEKS / GABUNGAN): Secure File Storage & WHATWG URL Interop
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Implementasikan class `SecureFileStorage` yang mengintegrasikan kapabilitas
 *    keamanan sistem berkas dari `node:path` (mitigasi OWASP Path Traversal,
 *    deteksi null byte, dan boundary prefix matching) dengan konversi aman
 *    WHATWG URL dari `node:url` (`pathToFileURL` dan `fileURLToPath`).
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:path`: `path.resolve`, `path.normalize`, `path.relative`, `path.sep`.
 *    - `node:url`: `pathToFileURL`, `fileURLToPath`, `URL`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. `constructor(rootDir)`:
 *       - Parameter `rootDir` wajib berupa non-empty string. Jika tidak valid,
 *         lempar `TypeError('Invalid root directory: Must be a non-empty string')`.
 *       - Selesaikan dan simpan `rootDir` sebagai path absolut ternormalisasi (`path.resolve()`).
 *    2. Getter `rootDirectory`:
 *       - Mengembalikan string path absolut direktori root penyimpanan.
 *    3. Getter `rootURL`:
 *       - Mengembalikan instance WHATWG `URL` berprotokol `file:` yang merepresentasikan `rootDirectory`.
 *    4. Method `resolveSafePath(userInputPath)`:
 *       - Parameter `userInputPath` wajib berupa non-empty string. Jika tidak, lempar
 *         `TypeError('User path must be a non-empty string')`.
 *       - Deteksi null-byte injection (`\0`): jika ditemukan di dalam input, lempar
 *         `Error('Invalid path: Null byte detected')`.
 *       - Selesaikan `userInputPath` ke bentuk absolut terhadap `rootDirectory`.
 *       - Validasi batas direktori (Boundary Check): target wajib berada di dalam `rootDirectory`.
 *         Gunakan formula: `target === this.rootDirectory || target.startsWith(this.rootDirectory + path.sep)`.
 *         Jika lolos ke luar batas (misal `../../etc/passwd` atau sibling directory `../storage-leak`),
 *         lempar `Error('Access denied: Path traversal detected')`.
 *       - Kembalikan objek:
 *         `{ absolutePath: string, relativePath: string, fileURL: URL }`
 *         - `absolutePath`: string path absolut sistem berkas.
 *         - `relativePath`: path relatif dari root directory (`path.relative(this.rootDirectory, absolutePath)`).
 *         - `fileURL`: instance WHATWG `URL` berprotokol `file:` via `pathToFileURL(absolutePath)`.
 *    5. Method `toFilePath(fileUrlInput)`:
 *       - Menerima string URL atau instance `URL`.
 *       - Validasi bahwa protokol URL adalah `'file:'`. Jika bukan, lempar
 *         `Error('Invalid URL protocol: Must be a file: URL')`.
 *       - Konversi URL ke string path lokal menggunakan `fileURLToPath()`.
 *       - Validasi bahwa path lokal tersebut tetap berada di dalam `rootDirectory`.
 *         Jika berada di luar root penyimpanan, lempar `Error('Access denied: Path outside storage root')`.
 *       - Mengembalikan string path absolut lokal.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────────────┬───────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Method / Pemanggilan          │ Input Parameter                   │ Output / Expected Behavior                                             │
 * ├───────────┼───────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ resolveSafePath               │ 'documents/annual-report.pdf'     │ { absolutePath: '<root>/documents/annual-report.pdf',                  │
 * │           │                               │                                   │   relativePath: 'documents/annual-report.pdf',                         │
 * │           │                               │                                   │   fileURL: URL('file://.../annual-report.pdf') }                       │
 * │ Normal 2  │ resolveSafePath (Special #,%) │ 'assets/report #1 [100%].pdf'     │ fileURL.href mengandung '%231' dan '%25' ter-encode aman               │
 * │ Normal 3  │ toFilePath                    │ fileURL hasil resolveSafePath     │ Mengembalikan string path absolut yang identik dengan absolutePath     │
 * │ Edge 1    │ resolveSafePath (hops)        │ 'docs/./drafts/../final.csv'      │ relativePath bernilai 'docs/final.csv'                                 │
 * │ Edge 2    │ resolveSafePath (root itself) │ '.'                               │ relativePath bernilai '' dan absolutePath === rootDirectory            │
 * │ Error 1   │ resolveSafePath (Traversal)   │ '../../etc/passwd'                │ Lempar Error('Access denied: Path traversal detected')                 │
 * │ Error 2   │ resolveSafePath (Sibling)     │ '../storage-secret/keys.env'      │ Lempar Error('Access denied: Path traversal detected')                 │
 * │ Error 3   │ resolveSafePath (Null byte)   │ 'document.pdf\0.exe'              │ Lempar Error('Invalid path: Null byte detected')                       │
 * │ Error 4   │ constructor                   │ '' atau non-string                │ Lempar TypeError('Invalid root directory: Must be a non-empty string')  │
 * │ Error 5   │ toFilePath (Non-file)         │ 'https://api.com/image.png'       │ Lempar Error('Invalid URL protocol: Must be a file: URL')              │
 * │ Error 6   │ toFilePath (Outside Root)     │ 'file:///etc/passwd'              │ Lempar Error('Access denied: Path outside storage root')               │
 * └───────────┴───────────────────────────────┴───────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
 */

export class SecureFileStorage {
  /**
   * Initializes a secure storage manager.
   *
   * @param {string} rootDir - Root directory path
   */
  constructor(rootDir) {
    // STUB: Do not remove or implement here.
    throw new Error('Not implemented');
  }

  /**
   * Absolute path of the storage root directory.
   * @type {string}
   */
  get rootDirectory() {
    // STUB: Do not remove or implement here.
    throw new Error('Not implemented');
  }

  /**
   * WHATWG file: URL representing the storage root directory.
   * @type {URL}
   */
  get rootURL() {
    // STUB: Do not remove or implement here.
    throw new Error('Not implemented');
  }

  /**
   * Resolves and verifies an untrusted user path within the storage boundary.
   *
   * @param {string} userInputPath - Relative path input from untrusted source
   * @returns {{
   *   absolutePath: string,
   *   relativePath: string,
   *   fileURL: URL
   * }}
   */
  resolveSafePath(userInputPath) {
    // STUB: Do not remove or implement here.
    throw new Error('Not implemented');
  }

  /**
   * Converts a WHATWG file: URL back to an absolute local filesystem path within storage boundary.
   *
   * @param {string | URL} fileUrlInput - File URL string or URL instance
   * @returns {string} Absolute local filesystem path
   */
  toFilePath(fileUrlInput) {
    // STUB: Do not remove or implement here.
    throw new Error('Not implemented');
  }
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

console.log('=== TEST SOAL 03: SecureFileStorage ===\n');

const MOCK_STORAGE_ROOT = path.resolve('/tmp/secure-app-storage');

// 1. Normal standard safe path resolution
runTest('Skenario Normal 1: Standard File Resolution', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  const result = storage.resolveSafePath('documents/annual-report.pdf');
  const expectedAbs = path.join(MOCK_STORAGE_ROOT, 'documents', 'annual-report.pdf');
  const expectedRel = path.join('documents', 'annual-report.pdf');

  if (result.absolutePath !== expectedAbs) throw new Error(`absolutePath mismatch: expected ${expectedAbs}, got ${result.absolutePath}`);
  if (result.relativePath !== expectedRel) throw new Error(`relativePath mismatch: expected ${expectedRel}, got ${result.relativePath}`);
  if (!(result.fileURL instanceof URL)) throw new Error('fileURL must be an instance of URL');
  if (result.fileURL.protocol !== 'file:') throw new Error(`fileURL protocol must be file:, got ${result.fileURL.protocol}`);
});

// 2. Normal special characters (#, %, spaces) safe encoding in URL
runTest('Skenario Normal 2: Special Characters (#, %, space) in Filename', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  const result = storage.resolveSafePath('assets/report #1 [100%].pdf');

  if (!result.fileURL.href.includes('%231')) throw new Error('URL must percent-encode # character to %23');
  if (!result.fileURL.href.includes('%25')) throw new Error('URL must percent-encode % character to %25');
});

// 3. Normal toFilePath roundtrip conversion
runTest('Skenario Normal 3: toFilePath Roundtrip Conversion', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  const result = storage.resolveSafePath('assets/report #1 [100%].pdf');
  const converted = storage.toFilePath(result.fileURL);

  if (converted !== result.absolutePath) {
    throw new Error(`toFilePath mismatch: expected ${result.absolutePath}, got ${converted}`);
  }
});

// 4. Edge 1: Normalization of relative hops inside root
runTest('Skenario Edge 1: Relative Hops Normalization', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  const result = storage.resolveSafePath('docs/./drafts/../final.csv');
  const expectedRel = path.join('docs', 'final.csv');

  if (result.relativePath !== expectedRel) {
    throw new Error(`relativePath mismatch: expected ${expectedRel}, got ${result.relativePath}`);
  }
});

// 5. Edge 2: Root directory reference (.)
runTest('Skenario Edge 2: Storage Root Reference (.)', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  const result = storage.resolveSafePath('.');

  if (result.absolutePath !== storage.rootDirectory) {
    throw new Error(`absolutePath must match rootDirectory: expected ${storage.rootDirectory}, got ${result.absolutePath}`);
  }
  if (result.relativePath !== '') {
    throw new Error(`relativePath must be empty string for root, got '${result.relativePath}'`);
  }
});

// 6. Error 1: Path traversal attack
runTest('Skenario Error 1: Path Traversal Attack (../../etc/passwd)', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  let thrown = false;
  try {
    storage.resolveSafePath('../../etc/passwd');
  } catch (err) {
    thrown = true;
    if (!err.message.includes('Path traversal detected')) {
      throw new Error(`Expected 'Path traversal detected', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Harus memblokir path traversal attack');
});

// 7. Error 2: Sibling directory escape bypass
runTest('Skenario Error 2: Sibling Directory Escape Bypass', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  let thrown = false;
  try {
    storage.resolveSafePath('../secure-app-storage-leak/secret.key');
  } catch (err) {
    thrown = true;
    if (!err.message.includes('Path traversal detected')) {
      throw new Error(`Expected 'Path traversal detected', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Harus memblokir sibling directory escape');
});

// 8. Error 3: Null byte injection detection
runTest('Skenario Error 3: Null Byte Injection Detection', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  let thrown = false;
  try {
    storage.resolveSafePath('safe.pdf\0.exe');
  } catch (err) {
    thrown = true;
    if (!err.message.includes('Null byte detected')) {
      throw new Error(`Expected 'Null byte detected', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Harus memblokir null byte injection');
});

// 9. Error 4: Constructor invalid argument
runTest('Skenario Error 4: Constructor Argument Validation', () => {
  let thrown = false;
  try {
    new SecureFileStorage('');
  } catch (err) {
    thrown = true;
    if (!(err instanceof TypeError)) throw new Error(`Expected TypeError, got ${err.name}`);
    if (!err.message.includes('Must be a non-empty string')) {
      throw new Error(`Expected 'Must be a non-empty string', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Constructor harus melempar TypeError saat rootDir kosong');
});

// 10. Error 5: Non-file scheme in toFilePath
runTest('Skenario Error 5: toFilePath Non-file Scheme Rejection', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  let thrown = false;
  try {
    storage.toFilePath('https://api.example.com/asset.png');
  } catch (err) {
    thrown = true;
    if (!err.message.includes('Must be a file: URL')) {
      throw new Error(`Expected 'Must be a file: URL', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('toFilePath harus menolak skema non-file');
});

// 11. Error 6: File URL outside root in toFilePath
runTest('Skenario Error 6: toFilePath File Outside Storage Root', () => {
  const storage = new SecureFileStorage(MOCK_STORAGE_ROOT);
  let thrown = false;
  try {
    storage.toFilePath('file:///etc/passwd');
  } catch (err) {
    thrown = true;
    if (!err.message.includes('Path outside storage root')) {
      throw new Error(`Expected 'Path outside storage root', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('toFilePath harus menolak file URL di luar direktori root');
});

console.log('\n--------------------------------------------------');
console.log(`Ringkasan: ${passedCount} / ${passedCount + failedCount} lulus (${failedCount} gagal)`);
console.log('--------------------------------------------------');

if (failedCount > 0) {
  process.exitCode = 1;
}
