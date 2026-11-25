import http from 'node:http';

/**
 * ============================================================================
 * SOAL 01: HTTP JSON Response Responder
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buat fungsi `sendJsonResponse` yang bertugas memvalidasi status code HTTP,
 *    mengonfigurasi header respons default (Content-Type JSON), menyematkan
 *    header kustom, dan mengirimkan payload data ter-serialize ke stream response.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:http`: `http.STATUS_CODES`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. Parameter `res`:
 *       - Wajib berupa objek yang memiliki method `setHeader` dan `end`.
 *       - Jika `res` bernilai null/undefined, bukan object, atau method fungsi
 *         tersebut tidak tersedia, lempar `TypeError` dengan pesan persis:
 *         "Invalid ServerResponse object"
 *    2. Parameter `statusCode`:
 *       - Wajib bertipe number integer primitif (`Number.isInteger(statusCode)`).
 *       - Jika bukan number integer (misal string, desimal, atau NaN),
 *         lempar `TypeError` dengan pesan persis:
 *         "Status code must be a valid integer"
 *       - Wajib merupakan status code yang terdaftar di `http.STATUS_CODES`.
 *         Jika di luar status code resmi, lempar `RangeError` dengan pesan persis:
 *         "Unsupported HTTP status code"
 *    3. Parameter `headers`:
 *       - Wajib berupa plain object dan bukan null serta bukan array.
 *       - Jika tipe data salah, lempar `TypeError` dengan pesan persis:
 *         "Headers must be an object"
 *    4. Pengiriman Header & Body:
 *       - Tetapkan `res.statusCode = statusCode`.
 *       - Set header default `'Content-Type'` dengan nilai:
 *         `'application/json; charset=utf-8'`.
 *       - Tetapkan setiap pasangan key-value pada argumen `headers` ke `res.setHeader(key, value)`.
 *       - Jika `data === undefined`, panggil `res.end('')`.
 *       - Selain itu, konversi `data` ke string JSON via `JSON.stringify(data)`
 *         dan kirimkan ke `res.end(serialized)`.
 *    5. Nilai Kembalian: `void`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                            │ Input                                                  │ Expected                                                       │
 * ├───────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ sendJsonResponse(res, 200, { success: true })          │ res, 200, { success: true }                            │ statusCode=200, Content-Type set, body='{"success":true}'      │
 * │ Normal 2  │ sendJsonResponse(res, 201, { id: 1 }, { 'X-Id': 'A' }) │ res, 201, { id: 1 }, { 'X-Id': 'A' }                   │ statusCode=201, X-Id set, body='{"id":1}'                      │
 * │ Normal 3  │ sendJsonResponse(res, 204, undefined)                  │ res, 204, undefined                                    │ statusCode=204, body=''                                        │
 * │ Edge 1    │ sendJsonResponse(res, 200, null)                       │ res, 200, null                                         │ statusCode=200, body='null'                                    │
 * │ Edge 2    │ sendJsonResponse(res, 200, [1, 2, 3])                  │ res, 200, [1, 2, 3]                                    │ statusCode=200, body='[1,2,3]'                                 │
 * │ Edge 3    │ sendJsonResponse(res, 200, 'text-payload')             │ res, 200, 'text-payload'                               │ statusCode=200, body='"text-payload"'                          │
 * │ Error 1   │ sendJsonResponse(null, 200, {})                        │ res: null                                              │ TypeError: "Invalid ServerResponse object"                     │
 * │ Error 2   │ sendJsonResponse({}, 200, {})                          │ res: {} (missing setHeader/end)                        │ TypeError: "Invalid ServerResponse object"                     │
 * │ Error 3   │ sendJsonResponse(res, '200', {})                       │ statusCode: '200'                                      │ TypeError: "Status code must be a valid integer"               │
 * │ Error 4   │ sendJsonResponse(res, 200.5, {})                       │ statusCode: 200.5                                      │ TypeError: "Status code must be a valid integer"               │
 * │ Error 5   │ sendJsonResponse(res, 999, {})                         │ statusCode: 999                                        │ RangeError: "Unsupported HTTP status code"                     │
 * │ Error 6   │ sendJsonResponse(res, 200, {}, 'invalid-header')       │ headers: 'invalid-header'                              │ TypeError: "Headers must be an object"                         │
 * │ Error 7   │ sendJsonResponse(res, 200, {}, null)                   │ headers: null                                          │ TypeError: "Headers must be an object"                         │
 * └───────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────┘
 */

// Helper validasi objek response HTTP (memeriksa ketersediaan method setHeader dan end)
const isResponse = (v) =>
  v !== null &&
  typeof v === 'object' &&
  typeof v.setHeader === 'function' &&
  typeof v.end === 'function';

// Helper validasi format status code (wajib integer)
const isStatusCode = (v) => Number.isInteger(v);

// Helper validasi objek header (wajib plain object, bukan null, bukan array)
const isHeaders = (v) =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Sends a structured JSON response to ServerResponse stream.
 *
 * @param {object} res
 * @param {number} statusCode
 * @param {any} [data]
 * @param {Record<string, string>} [headers={}]
 * @returns {void}
 */
export function sendJsonResponse(res, statusCode, data, headers = {}) {
  // 1. Validasi defensif parameter res
  if (!isResponse(res)) {
    throw new TypeError('Invalid ServerResponse object');
  }

  // 2. Validasi tipe statusCode (wajib integer)
  if (!isStatusCode(statusCode)) {
    throw new TypeError('Status code must be a valid integer');
  }

  // 3. Validasi batasan statusCode terhadap kamus resmi http.STATUS_CODES
  if (!Object.hasOwn(http.STATUS_CODES, statusCode)) {
    throw new RangeError('Unsupported HTTP status code');
  }

  // 4. Validasi tipe headers (wajib plain object)
  if (!isHeaders(headers)) {
    throw new TypeError('Headers must be an object');
  }

  // 5. Atur status code dan header default Content-Type
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 6. Pasang custom header tambahan jika diberikan
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  // 7. Jika data undefined (misal status 204 No Content), kirimkan body kosong dan hentikan eksekusi
  if (data === undefined) {
    res.end('');
    return;
  }

  // 8. Serialize data menjadi string format JSON dan kirimkan ke stream respons
  const result = JSON.stringify(data);
  res.end(result);
}
