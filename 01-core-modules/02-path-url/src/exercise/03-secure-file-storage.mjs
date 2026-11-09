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
 * ┌───────────┬─────────────────────────────────────────────────┬───────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                     │ Input                             │ Expected                                                               │
 * ├───────────┼─────────────────────────────────────────────────┼───────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ storage.resolveSafePath(path)                   │ 'documents/annual-report.pdf'     │ { absolutePath: '<root>/doc.pdf', rel: 'doc.pdf', fileURL: URL(...) }  │
 * │ Normal 2  │ storage.resolveSafePath(path)                   │ 'assets/report #1 [100%].pdf'     │ fileURL.href mengandung '%231' dan '%25' ter-encode aman               │
 * │ Normal 3  │ storage.toFilePath(fileUrl)                     │ fileURL hasil resolveSafePath     │ Mengembalikan string path absolut yang identik dengan absolutePath     │
 * │ Edge 1    │ storage.resolveSafePath(path)                   │ 'docs/./drafts/../final.csv'      │ relativePath bernilai 'docs/final.csv'                                 │
 * │ Edge 2    │ storage.resolveSafePath('.')                    │ '.'                               │ relativePath bernilai '' dan absolutePath === rootDirectory            │
 * │ Error 1   │ storage.resolveSafePath('../../etc/passwd')     │ '../../etc/passwd'                │ Lempar Error('Access denied: Path traversal detected')                 │
 * │ Error 2   │ storage.resolveSafePath('../secret/keys.env')   │ '../storage-secret/keys.env'      │ Lempar Error('Access denied: Path traversal detected')                 │
 * │ Error 3   │ storage.resolveSafePath('document.pdf\0.exe')   │ 'document.pdf\0.exe'              │ Lempar Error('Invalid path: Null byte detected')                       │
 * │ Error 4   │ new SecureFileStorage('')                       │ '' atau non-string                │ Lempar TypeError('Invalid root directory: Must be a non-empty string')  │
 * │ Error 5   │ storage.toFilePath('https://api.com/image.png') │ 'https://api.com/image.png'       │ Lempar Error('Invalid URL protocol: Must be a file: URL')              │
 * │ Error 6   │ storage.toFilePath('file:///etc/passwd')        │ 'file:///etc/passwd'              │ Lempar Error('Access denied: Path outside storage root')               │
 * └───────────┴─────────────────────────────────────────────────┴───────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
 */

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Pengelola penyimpanan berkas aman dengan mitigasi path traversal dan interoperabilitas WHATWG URL.
 */
export class SecureFileStorage {
  #rootDir;

  /**
   * Menginisialisasi direktori root penyimpanan aman.
   *
   * @param {string} rootDir
   */
  constructor(rootDir) {
    if (!isNonEmptyString(rootDir)) {
      throw new TypeError('Invalid root directory: Must be a non-empty string');
    }
    this.#rootDir = path.resolve(rootDir);
  }

  /**
   * Mengambil path absolut direktori root penyimpanan.
   *
   * @returns {string}
   */
  get rootDirectory() {
    return this.#rootDir;
  }

  /**
   * Mengambil instance WHATWG file: URL dari direktori root penyimpanan.
   *
   * @returns {URL}
   */
  get rootURL() {
    return pathToFileURL(this.#rootDir);
  }

  /**
   * Menyelesaikan dan memvalidasi path pengguna di dalam batas direktori root penyimpanan.
   *
   * @param {string} userInputPath
   * @returns {{ absolutePath: string, relativePath: string, fileURL: URL }}
   */
  resolveSafePath(userInputPath) {
    if (typeof userInputPath !== 'string' || userInputPath.trim() === '') {
      throw new TypeError('User path must be a non-empty string');
    }

    if (userInputPath.includes('\0')) {
      throw new Error('Invalid path: Null byte detected');
    }

    const target = path.resolve(this.#rootDir, userInputPath);

    if (
      target === this.#rootDir ||
      target.startsWith(this.#rootDir + path.sep)
    ) {
      return {
        absolutePath: target,
        relativePath: path.relative(this.#rootDir, target),
        fileURL: pathToFileURL(target),
      };
    } else {
      throw new Error('Access denied: Path traversal detected');
    }
  }

  /**
   * Mengonversi WHATWG file: URL kembali ke path absolut lokal di dalam batas root.
   *
   * @param {string | URL} fileUrlInput
   * @returns {string}
   */
  toFilePath(fileUrlInput) {
    let url;
    try {
      url = fileUrlInput instanceof URL ? fileUrlInput : new URL(fileUrlInput);
    } catch {
      throw new Error('Invalid URL protocol: Must be a file: URL');
    }
    if (url.protocol !== 'file:') {
      throw new Error('Invalid URL protocol: Must be a file: URL');
    }

    let target;
    try {
      target = path.resolve(fileURLToPath(url));
    } catch {
      throw new Error('Access denied: Path outside storage root');
    }

    if (
      target !== this.#rootDir &&
      !target.startsWith(this.#rootDir + path.sep)
    ) {
      throw new Error('Access denied: Path outside storage root');
    }

    return target;
  }
}
