import { URL } from 'node:url';

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
 * ┌───────────┬────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                            │ Input                                                  │ Expected                                                              │
 * ├───────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ buildApiEndpoint(baseUrl, 'v1/users', { page, limit }) │ baseUrl: 'https://api.example.com'                     │ 'https://api.example.com/v1/users?page=1&limit=10'                    │
 * │ Normal 2  │ buildApiEndpoint(baseUrl, '/search', { q })            │ baseUrl: 'https://api.example.com/api/', q: 'c++ dev'  │ 'https://api.example.com/api/search?q=c%2B%2B+developer'             │
 * │ Edge 1    │ buildApiEndpoint(baseUrl, 'filter', { status: [...] }) │ status: ['active', 'pending']                          │ 'https://api.example.com/filter?status=active&status=pending'         │
 * │ Edge 2    │ buildApiEndpoint(baseUrl, 'users', { active, role })   │ role: null, q: undefined                               │ 'https://api.example.com/users?active=true'                           │
 * │ Edge 3    │ buildApiEndpoint(baseUrl, 'docs', {}, { hash })        │ options: { hash: 'section-2' }                         │ 'https://api.example.com/docs#section-2'                              │
 * │ Edge 4    │ buildApiEndpoint(baseUrl, 'status', { format: 'json'}) │ baseUrl: 'https://api.example.com?key=token'           │ 'https://api.example.com/status?key=token&format=json'                │
 * │ Error 1   │ buildApiEndpoint('not-a-valid-url', 'users')           │ baseUrl: 'not-a-valid-url'                             │ Lempar TypeError('Invalid base URL: Must be a parseable URL')         │
 * │ Error 2   │ buildApiEndpoint('javascript:alert(1)')                │ baseUrl: 'javascript:alert(1)'                         │ Lempar Error('Disallowed protocol: Only HTTP/HTTPS URLs are allowed') │
 * │ Error 3   │ buildApiEndpoint('file:///etc/passwd')                 │ baseUrl: 'file:///etc/passwd'                          │ Lempar Error('Disallowed protocol: Only HTTP/HTTPS URLs are allowed') │
 * └───────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────┘
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Membangun URL API ternormalisasi dan aman dengan penanganan query parameter serta protokol guard.
 *
 * @param {string} baseUrl
 * @param {string} [endpointPath='']
 * @param {Record<string, any>} [queryParams={}]
 * @param {{ hash?: string }} [options={}]
 * @returns {string}
 */
export function buildApiEndpoint(
  baseUrl,
  endpointPath = '',
  queryParams = {},
  options = {},
) {
  // 1. Validasi tipe dulu, baru parse
  if (typeof baseUrl !== 'string' || !URL.canParse(baseUrl)) {
    throw new TypeError('Invalid base URL: Must be a parseable URL');
  }

  const url = new URL(baseUrl);

  // 2. Cek protokol dari hasil parse (sudah lowercase & ter-trim)
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error('Disallowed protocol: Only HTTP/HTTPS URLs are allowed');
  }

  // 3. Gabung path secara defensif
  const subPath = String(endpointPath ?? '').replace(/^\/+/, '');
  if (subPath) {
    const basePath = url.pathname.replace(/\/+$/, '');
    url.pathname = `${basePath}/${subPath}`.replace(/\/{2,}/g, '/');
  }

  // 4. Query params (query bawaan baseUrl tetap dipertahankan)
  for (const [key, value] of Object.entries(queryParams ?? {})) {
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      if (item === null || item === undefined) continue;
      url.searchParams.append(key, String(item));
    }
  }

  // 5. Hash (setter otomatis menambahkan '#')
  if (typeof options?.hash === 'string' && options.hash) {
    url.hash = options.hash;
  }

  return url.href;
}
