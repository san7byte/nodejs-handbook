import crypto from 'node:crypto';

/**
 * ============================================================================
 * SOAL 01: HMAC Webhook Signature Generator
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buat fungsi `createHmacSignature` yang bertugas menghitung intisari (digest)
 *    HMAC berformat string heksadesimal dari suatu data payload (string atau Buffer)
 *    menggunakan kunci rahasia bersama (secret key) dan algoritma hash tertentu.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:crypto`: `crypto.createHmac`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. Parameter `secret`:
 *       - Wajib bertipe string non-empty atau Buffer non-empty (panjang byte > 0).
 *       - Jika `secret` bernilai null, undefined, tipe data selain string/Buffer,
 *         atau berupa string kosong ("") / Buffer berukuran 0 byte, lempar
 *         `TypeError` dengan pesan persis:
 *         "Secret must be a non-empty string or Buffer"
 *    2. Parameter `payload`:
 *       - Wajib bertipe string atau Buffer.
 *       - Jika `payload` bernilai null, undefined, atau bertipe selain string/Buffer
 *         (seperti number, boolean, object), lempar `TypeError` dengan pesan persis:
 *         "Payload must be a string or Buffer"
 *       - Catatan: string kosong ("") dan Buffer kosong (Buffer.alloc(0)) adalah
 *         payload yang valid.
 *    3. Parameter `algorithm`:
 *       - Nilai default adalah 'sha256'.
 *       - Wajib bertipe string non-empty. Jika bukan string atau berupa string
 *         kosong, lempar `TypeError` dengan pesan persis:
 *         "Algorithm must be a non-empty string"
 *       - Jika algoritma tidak didukung oleh runtime crypto (misal nama cipher
 *         tidak valid), tangkap error inisialisasi dan lempar `TypeError` dengan
 *         pesan persis:
 *         "Unsupported hash algorithm"
 *    4. Nilai Kembalian:
 *       - Mengembalikan string heksadesimal lowercase dari kalkulasi digest HMAC.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                                   │ Input                                           │ Expected                                                    │
 * ├───────────┼───────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ createHmacSignature('secret-key', 'hello-world')              │ secret: 'secret-key', payload: 'hello-world'    │ string hex length 64 ('sha256')                             │
 * │ Normal 2  │ createHmacSignature('secret-key', 'hello-world', 'sha512')    │ secret: 'secret-key', algorithm: 'sha512'       │ string hex length 128 ('sha512')                            │
 * │ Normal 3  │ createHmacSignature(Buffer.from('k'), Buffer.from('data'))    │ secret: Buffer, payload: Buffer                 │ string hex length 64                                        │
 * │ Edge 1    │ createHmacSignature('secret-key', '')                         │ payload: '' (empty string)                      │ string hex length 64                                        │
 * │ Edge 2    │ createHmacSignature('secret-key', Buffer.alloc(0))            │ payload: Buffer.alloc(0)                        │ string hex length 64 (matches empty string)                 │
 * │ Error 1   │ createHmacSignature(null, 'data')                             │ secret: null                                    │ TypeError: "Secret must be a non-empty string or Buffer"    │
 * │ Error 2   │ createHmacSignature('', 'data')                               │ secret: ''                                      │ TypeError: "Secret must be a non-empty string or Buffer"    │
 * │ Error 3   │ createHmacSignature(Buffer.alloc(0), 'data')                  │ secret: Buffer.alloc(0)                         │ TypeError: "Secret must be a non-empty string or Buffer"    │
 * │ Error 4   │ createHmacSignature(12345, 'data')                            │ secret: 12345                                   │ TypeError: "Secret must be a non-empty string or Buffer"    │
 * │ Error 5   │ createHmacSignature('secret-key', null)                       │ payload: null                                   │ TypeError: "Payload must be a string or Buffer"             │
 * │ Error 6   │ createHmacSignature('secret-key', 999)                        │ payload: 999                                    │ TypeError: "Payload must be a string or Buffer"             │
 * │ Error 7   │ createHmacSignature('secret-key', 'data', null)                │ algorithm: null                                 │ TypeError: "Algorithm must be a non-empty string"           │
 * │ Error 8   │ createHmacSignature('secret-key', 'data', '')                  │ algorithm: ''                                   │ TypeError: "Algorithm must be a non-empty string"           │
 * │ Error 9   │ createHmacSignature('secret-key', 'data', 'invalid-algo-xyz') │ algorithm: 'invalid-algo-xyz'                   │ TypeError: "Unsupported hash algorithm"                     │
 * └───────────┴───────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────┘
 */

// Helper validasi secret: wajib string atau Buffer dengan panjang > 0
const isSecret = (v) =>
  (typeof v === 'string' && v.length > 0) ||
  (Buffer.isBuffer(v) && v.length > 0);

// Helper validasi payload: string kosong atau Buffer kosong tetap valid
const isPayload = (v) => typeof v === 'string' || Buffer.isBuffer(v);

// Helper validasi nama algoritma: wajib string non-empty
const isAlgorithm = (v) => typeof v === 'string' && v.length > 0;

/**
 * Generates an HMAC hex digest for a given payload using a shared secret.
 *
 * @param {string | Buffer} secret
 * @param {string | Buffer} payload
 * @param {string} [algorithm='sha256']
 * @returns {string}
 */
export function createHmacSignature(secret, payload, algorithm = 'sha256') {
  // 1. Validasi defensif parameter secret (tidak boleh null, kosong, atau tipe lain)
  if (!isSecret(secret)) {
    throw new TypeError('Secret must be a non-empty string or Buffer');
  }

  // 2. Validasi tipe parameter payload (string/Buffer kosong tetap diterima)
  if (!isPayload(payload)) {
    throw new TypeError('Payload must be a string or Buffer');
  }

  // 3. Validasi format dasar nama algoritma hash
  if (!isAlgorithm(algorithm)) {
    throw new TypeError('Algorithm must be a non-empty string');
  }

  // 4. Edge-case: tangkap error saat inisialisasi jika algoritma tidak dikenal OpenSSL
  let hmac;
  try {
    hmac = crypto.createHmac(algorithm, secret);
  } catch {
    throw new TypeError('Unsupported hash algorithm');
  }

  // 5. Normal: hitung digest HMAC dan kembalikan sebagai hex string lowercase
  return hmac.update(payload).digest('hex');
}
