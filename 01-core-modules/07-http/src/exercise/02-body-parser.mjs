import { Buffer } from 'node:buffer';

/**
 * ============================================================================
 * SOAL 02: HTTP Safe Body Parser & Size Guard
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buat fungsi asinkron `parseJsonBody` yang membaca potongan biner stream request
 *    HTTP (`http.IncomingMessage` atau stream yang kompatibel), mengumpulkan chunk,
 *    dan mem-parsing konten JSON dengan proteksi batas ukuran payload (*payload size guard*).
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:buffer`: `Buffer.concat`.
 *    - Stream events: event `'data'`, event `'end'`, event `'error'`, dan method `req.destroy()`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. Parameter `req`:
 *       - Wajib berupa objek stream yang memiliki method `on` dan `destroy`.
 *       - Jika `req` bernilai falsy, bukan object, atau method fungsi tersebut
 *         tidak tersedia, lempar `TypeError` dengan pesan persis:
 *         "Invalid request stream"
 *    2. Parameter `maxSizeBytes`:
 *       - Default: `1048576` (1 MB).
 *       - Wajib berupa integer positif (`Number.isInteger(maxSizeBytes) && maxSizeBytes > 0`).
 *       - Jika bukan integer positif, lempar `TypeError` dengan pesan persis:
 *         "Max size must be a positive integer"
 *    3. Pemeriksaan Awal Header `Content-Length`:
 *       - Jika `req.headers` memiliki properti `'content-length'`, periksa nilai integernya.
 *       - Jika nilai `content-length` melebihi `maxSizeBytes`:
 *         Panggil `req.destroy()`, dan reject Promise dengan `RangeError` dengan pesan persis:
 *         "Payload exceeds maximum allowed size"
 *    4. Pengumpulan Chunk & Batasan Akumulasi:
 *       - Dengarkan event `'data'` pada `req`.
 *       - Akumulasikan panjang byte dari setiap chunk. Jika total byte melebihi `maxSizeBytes`:
 *         Panggil `req.destroy()`, dan reject Promise dengan `RangeError` dengan pesan persis:
 *         "Payload exceeds maximum allowed size"
 *    5. Penyelesaian Stream (Event `'end'`):
 *       - Jika stream tidak menghasilkan data sama sekali (0 bytes) atau hanya berupa whitespace,
 *         resolve dengan objek kosong `{}`.
 *       - Gabungkan seluruh chunk dengan `Buffer.concat()` dan ubah menjadi string UTF-8.
 *       - Parse string menggunakan `JSON.parse()`. Jika berhasil, resolve objek hasil parse.
 *       - Jika format JSON rusak / parse gagal, reject Promise dengan `SyntaxError` dengan pesan persis:
 *         "Malformed JSON payload"
 *    6. Penanganan Event `'error'`:
 *       - Jika stream memancarkan event `'error'`, reject Promise dengan Error tersebut.
 *    7. Nilai Kembalian: `Promise<any>`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬──────────────────────────────────────────┬────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                              │ Input                                                  │ Expected                                                       │
 * ├───────────┼──────────────────────────────────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ parseJsonBody(req)                       │ req stream emitting `{"user":"alice"}`                 │ Resolve `{ user: 'alice' }`                                    │
 * │ Normal 2  │ parseJsonBody(req)                       │ req stream emitting `{"config":{"port":8080}}`         │ Resolve `{ config: { port: 8080 } }`                           │
 * │ Normal 3  │ parseJsonBody(req)                       │ req stream emitting `[1, 2, 3]`                        │ Resolve `[1, 2, 3]`                                            │
 * │ Edge 1    │ parseJsonBody(req)                       │ req stream emitting 0 bytes (empty)                    │ Resolve `{}`                                                   │
 * │ Edge 2    │ parseJsonBody(req)                       │ req stream emitting whitespace `"   "`                 │ Resolve `{}`                                                   │
 * │ Edge 3    │ parseJsonBody(req)                       │ req stream fragmented in 3 separate small chunks       │ Resolve full parsed JSON object                                │
 * │ Edge 4    │ parseJsonBody(req, 10)                   │ req stream payload exactly 10 bytes: `{"a":1}`          │ Resolve `{ a: 1 }`                                             │
 * │ Error 1   │ parseJsonBody(null)                      │ req: null                                              │ TypeError: "Invalid request stream"                            │
 * │ Error 2   │ parseJsonBody(req, -10)                  │ maxSizeBytes: -10                                      │ TypeError: "Max size must be a positive integer"               │
 * │ Error 3   │ parseJsonBody(req, 0)                    │ maxSizeBytes: 0                                        │ TypeError: "Max size must be a positive integer"               │
 * │ Error 4   │ parseJsonBody(req, 20)                   │ req headers: { 'content-length': '50' }, limit: 20     │ RangeError: "Payload exceeds maximum allowed size"             │
 * │ Error 5   │ parseJsonBody(req, 15)                   │ req chunks total 25 bytes, limit: 15                   │ RangeError: "Payload exceeds maximum allowed size"             │
 * │ Error 6   │ parseJsonBody(req)                       │ req stream emitting invalid JSON: `{ bad: json `       │ SyntaxError: "Malformed JSON payload"                          │
 * └───────────┴──────────────────────────────────────────┴────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────┘
 */

// Helper validasi stream request (memeriksa ketersediaan method .on dan .destroy)
const isRequest = (v) =>
  v !== null &&
  typeof v === 'object' &&
  typeof v.on === 'function' &&
  typeof v.destroy === 'function';

// Helper validasi ukuran batas byte (wajib integer positif > 0)
const isMaxSizeBytes = (v) => Number.isInteger(v) && v > 0;

/**
 * Parses incoming request stream body as JSON with payload size limit.
 *
 * @param {object} req
 * @param {number} [maxSizeBytes=1048576]
 * @returns {Promise<any>}
 */
export async function parseJsonBody(req, maxSizeBytes = 1048576) {
  // 1. Validasi defensif objek stream req
  if (!isRequest(req)) {
    throw new TypeError('Invalid request stream');
  }

  // 2. Validasi parameter batasan ukuran byte
  if (!isMaxSizeBytes(maxSizeBytes)) {
    throw new TypeError('Max size must be a positive integer');
  }

  // 3. Early check: periksa Content-Length jika dikirim di header untuk cegah DoS sebelum stream dibaca
  const contentLength = Number(req.headers?.['content-length'] || 0);
  if (contentLength > maxSizeBytes) {
    req.destroy();
    throw new RangeError('Payload exceeds maximum allowed size');
  }

  // 4. Pembacaan stream asinkron berbasis Promise
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;

    // Dengarkan event data untuk mengumpulkan potongan biner
    req.on('data', (chunk) => {
      receivedBytes += chunk.length;

      // Proteksi runtime: jika total akumulasi byte melebihi batas, hentikan stream seketika
      if (receivedBytes > maxSizeBytes) {
        req.destroy();
        reject(new RangeError('Payload exceeds maximum allowed size'));
        return;
      }

      chunks.push(chunk);
    });

    // Dengarkan event end saat seluruh data stream telah tuntas diterima
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');

      // Edge-case: tangani body kosong (0 byte) atau hanya whitespace
      if (rawBody.length === 0 || rawBody.trim() === '') {
        resolve({});
        return;
      }

      try {
        // Normal: parse string JSON menjadi objek JavaScript
        const parsed = JSON.parse(rawBody || '{}');
        resolve(parsed);
      } catch {
        // Edge-case: tangani format JSON yang rusak/malformed
        reject(new SyntaxError('Malformed JSON payload'));
      }
    });

    // Dengarkan event error pada socket stream
    req.on('error', (err) => {
      reject(err);
    });
  });
}
