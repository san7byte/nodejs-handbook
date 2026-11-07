import { URL, URLSearchParams } from 'node:url';

/**
 * ============================================================================
 * SOAL 02 (MENENGAH): Robust API Query & URL Builder
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buatlah fungsi `buildApiEndpoint(baseUrl, endpointPath, queryParams, options)`
 *    yang menyusun URL lengkap untuk HTTP client atau webhook generator dengan
 *    perlindungan keamanan terhadap protokol berbahaya, penanganan path yang
 *    defensif, serta serialisasi query parameter yang bersih.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:url` / global WHATWG: `URL.canParse`, `new URL(input, base?)`,
 *      `new URLSearchParams(init?)`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    - Validasi `baseUrl` menggunakan `URL.canParse(baseUrl)`. Jika tidak valid
 *      atau bukan string, lempar `TypeError('Invalid base URL: Must be a parseable URL')`.
 *    - Validasi Protokol (Security Guard): URL hanya boleh menggunakan protokol
 *      `'http:'` atau `'https:'`. Jika ditemukan protokol lain (contoh: `'javascript:'`,
 *      `'file:'`, `'data:'`), lempar `Error('Disallowed protocol: Only HTTP/HTTPS URLs are allowed')`.
 *    - Resolusi Path Defensif:
 *      Gabungkan pathname bawaan `baseUrl` dan `endpointPath` secara aman:
 *      - Tidak boleh menghasilkan double-slash (`//`).
 *      - Tidak boleh menimpa pathname awal `baseUrl`.
 *      - Contoh: `https://api.com/v1/` + `/users` -> `https://api.com/v1/users`.
 *    - Query Parameters (`queryParams`):
 *      - Abaikan key yang memiliki nilai `null` atau `undefined` (filtering otomatis).
 *      - Jika nilai bertipe array, sertakan semua elemen menggunakan key yang sama (`params.append(key, item)`).
 *      - Pertahankan query parameter yang sudah ada sebelumnya pada `baseUrl`.
 *      - Karakter spesial (spasi, `+`, `&`) wajib di-encode secara otomatis oleh `URLSearchParams`.
 *    - Fragment Hash (`options.hash`):
 *      - Jika disediakan string non-kosong, tambahkan hash ke URL (pastikan diawali `#`).
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬─────────────────────────────────────┬──────────────────┬──────────────────────────────────────────┬────────────────────────────┬───────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ baseUrl                             │ endpointPath     │ queryParams                              │ options                    │ Output / Expected Behavior                                            │
 * ├───────────┼─────────────────────────────────────┼──────────────────┼──────────────────────────────────────────┼────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ 'https://api.example.com'           │ 'v1/users'       │ { page: 1, limit: 10 }                   │ {}                         │ 'https://api.example.com/v1/users?page=1&limit=10'                    │
 * │ Normal 2  │ 'https://api.example.com/api/'      │ '/search'        │ { q: 'c++ developer' }                   │ {}                         │ 'https://api.example.com/api/search?q=c%2B%2B+developer'             │
 * │ Edge 1    │ 'https://api.example.com'           │ 'filter'         │ { status: ['active', 'pending'] }        │ {}                         │ 'https://api.example.com/filter?status=active&status=pending'         │
 * │ Edge 2    │ 'https://api.example.com'           │ 'users'          │ { active: true, role: null, q: undefined }│ {}                        │ 'https://api.example.com/users?active=true'                           │
 * │ Edge 3    │ 'https://api.example.com'           │ 'docs'           │ {}                                       │ { hash: 'section-2' }      │ 'https://api.example.com/docs#section-2'                              │
 * │ Edge 4    │ 'https://api.example.com?key=token' │ 'status'         │ { format: 'json' }                       │ {}                         │ 'https://api.example.com/status?key=token&format=json'                │
 * │ Error 1   │ 'not-a-valid-url'                   │ 'users'          │ {}                                       │ {}                         │ Lempar TypeError('Invalid base URL: Must be a parseable URL')         │
 * │ Error 2   │ 'javascript:alert(1)'               │ ''               │ {}                                       │ {}                         │ Lempar Error('Disallowed protocol: Only HTTP/HTTPS URLs are allowed') │
 * │ Error 3   │ 'file:///etc/passwd'                │ ''               │ {}                                       │ {}                         │ Lempar Error('Disallowed protocol: Only HTTP/HTTPS URLs are allowed') │
 * └───────────┴─────────────────────────────────────┴──────────────────┴──────────────────────────────────────────┴────────────────────────────┴───────────────────────────────────────────────────────────────────────┘
 */

/**
 * Constructs a fully normalized and safe API URL.
 *
 * @param {string} baseUrl - Base HTTP/HTTPS URL
 * @param {string} [endpointPath=''] - Endpoint sub-path
 * @param {Record<string, any>} [queryParams={}] - Key-value query parameters
 * @param {{ hash?: string }} [options={}] - Additional URL formatting options
 * @returns {string} Fully serialized WHATWG URL string
 */
export function buildApiEndpoint(baseUrl, endpointPath = '', queryParams = {}, options = {}) {
  // STUB: Do not remove or implement here.
  throw new Error('Not implemented');
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

console.log('=== TEST SOAL 02: buildApiEndpoint ===\n');

// 1. Normal standard endpoint & pagination params
runTest('Skenario Normal 1: Standard URL & Pagination', () => {
  const result = buildApiEndpoint('https://api.example.com', 'v1/users', { page: 1, limit: 10 });
  const expected = 'https://api.example.com/v1/users?page=1&limit=10';
  if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
});

// 2. Normal special characters & trailing/leading slashes resolution
runTest('Skenario Normal 2: Slash Resolution & Special Characters (+ and space)', () => {
  const result = buildApiEndpoint('https://api.example.com/api/', '/search', { q: 'c++ developer' });
  const expected = 'https://api.example.com/api/search?q=c%2B%2B+developer';
  if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
});

// 3. Edge 1: Multi-value array query parameters
runTest('Skenario Edge 1: Array Query Parameters', () => {
  const result = buildApiEndpoint('https://api.example.com', 'filter', { status: ['active', 'pending'] });
  const expected = 'https://api.example.com/filter?status=active&status=pending';
  if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
});

// 4. Edge 2: Null and undefined parameters omitted
runTest('Skenario Edge 2: Filtering Null & Undefined Parameters', () => {
  const result = buildApiEndpoint('https://api.example.com', 'users', { active: true, role: null, q: undefined });
  const expected = 'https://api.example.com/users?active=true';
  if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
});

// 5. Edge 3: Hash fragment support
runTest('Skenario Edge 3: Fragment Hash Support', () => {
  const result = buildApiEndpoint('https://api.example.com', 'docs', {}, { hash: 'section-2' });
  const expected = 'https://api.example.com/docs#section-2';
  if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
});

// 6. Edge 4: Preserving existing query parameters in base URL
runTest('Skenario Edge 4: Preserving Pre-existing Query Parameters', () => {
  const result = buildApiEndpoint('https://api.example.com?key=token', 'status', { format: 'json' });
  const expected = 'https://api.example.com/status?key=token&format=json';
  if (result !== expected) throw new Error(`Expected ${expected}, got ${result}`);
});

// 7. Error 1: Invalid base URL format
runTest('Skenario Error 1: Invalid Base URL Format', () => {
  let thrown = false;
  try {
    buildApiEndpoint('not-a-valid-url', 'users');
  } catch (err) {
    thrown = true;
    if (!(err instanceof TypeError)) throw new Error(`Expected TypeError, got ${err.name}: ${err.message}`);
    if (!err.message.includes('Must be a parseable URL')) {
      throw new Error(`Expected message to include 'Must be a parseable URL', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Fungsi harus melempar TypeError saat baseUrl tidak valid');
});

// 8. Error 2: Disallowed javascript: scheme
runTest('Skenario Error 2: Disallowed Scheme (javascript:)', () => {
  let thrown = false;
  try {
    buildApiEndpoint('javascript:alert(1)');
  } catch (err) {
    thrown = true;
    if (!(err instanceof Error)) throw new Error(`Expected Error, got ${err.name}`);
    if (!err.message.includes('Only HTTP/HTTPS URLs are allowed')) {
      throw new Error(`Expected message to include 'Only HTTP/HTTPS URLs are allowed', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Fungsi harus melempar Error saat protokol bukan http/https');
});

// 9. Error 3: Disallowed file: scheme
runTest('Skenario Error 3: Disallowed Scheme (file:)', () => {
  let thrown = false;
  try {
    buildApiEndpoint('file:///etc/passwd');
  } catch (err) {
    thrown = true;
    if (!(err instanceof Error)) throw new Error(`Expected Error, got ${err.name}`);
    if (!err.message.includes('Only HTTP/HTTPS URLs are allowed')) {
      throw new Error(`Expected message to include 'Only HTTP/HTTPS URLs are allowed', got: ${err.message}`);
    }
  }
  if (!thrown) throw new Error('Fungsi harus melempar Error saat protokol bukan http/https');
});

console.log('\n--------------------------------------------------');
console.log(`Ringkasan: ${passedCount} / ${passedCount + failedCount} lulus (${failedCount} gagal)`);
console.log('--------------------------------------------------');

if (failedCount > 0) {
  process.exitCode = 1;
}
