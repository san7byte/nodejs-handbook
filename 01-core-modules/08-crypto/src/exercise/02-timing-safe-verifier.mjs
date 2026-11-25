import crypto from 'node:crypto';

/**
 * ============================================================================
 * SOAL 02: Timing-Safe Secret Token Verifier with Length Normalization
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buat fungsi `verifySecretToken` yang memverifikasi kecocokan antara dua token
 *    rahasia (string atau Buffer) secara aman terhadap serangan analisis waktu
 *    (timing attack). Fungsi ini harus mencegah kebocoran informasi panjang token
 *    dan tidak boleh menyebabkan error sistem akibat panjang buffer yang berbeda.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:crypto`: `crypto.createHash`, `crypto.timingSafeEqual`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. Parameter `providedToken`:
 *       - Wajib bertipe string atau Buffer.
 *       - Jika bernilai null, undefined, atau bukan bertipe string/Buffer,
 *         lempar `TypeError` dengan pesan persis:
 *         "Provided token must be a string or Buffer"
 *    2. Parameter `expectedToken`:
 *       - Wajib bertipe string atau Buffer.
 *       - Jika bernilai null, undefined, atau bukan bertipe string/Buffer,
 *         lempar `TypeError` dengan pesan persis:
 *         "Expected token must be a string or Buffer"
 *    3. Normalisasi & Proteksi Timing Attack:
 *       - Pemanggilan langsung `crypto.timingSafeEqual` melempar `RangeError` jika
 *         kedua buffer memiliki ukuran byte berbeda. Menangkap error tersebut secara
 *         langsung berisiko membocorkan estimasi panjang token kepada penyerang.
 *       - Untuk menjamin eksekusi waktu konstan (constant-time) terlepas dari panjang
 *         input, lakukan kalkulasi hash SHA-256 terlebih dahulu terhadap kedua token
 *         sehingga keduanya selalu menghasilkan digest Buffer berukuran 32 byte
 *         sebelum dibandingkan via `crypto.timingSafeEqual`.
 *    4. Nilai Kembalian:
 *       - Mengembalikan `boolean`: `true` jika kedua token identik, atau `false`
 *         jika berbeda atau panjang tidak cocok.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬──────────────────────────────────────────────────────────────┬────────────────────────────────────────────────┬──────────┐
 * │ Skenario  │ Pemanggilan                                                  │ Input                                          │ Expected │
 * ├───────────┼──────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────┤
 * │ Normal 1  │ verifySecretToken('my-secret-token', 'my-secret-token')      │ identical strings                              │ true     │
 * │ Normal 2  │ verifySecretToken(Buffer.from('tok'), Buffer.from('tok'))    │ identical Buffers                              │ true     │
 * │ Normal 3  │ verifySecretToken('secret-token-123', 'wrong-token-999')     │ same length, different content                 │ false    │
 * │ Edge 1    │ verifySecretToken('short', 'much-longer-secret-token')       │ different lengths                              │ false    │
 * │ Edge 2    │ verifySecretToken('', 'secret-token')                        │ empty string vs non-empty                      │ false    │
 * │ Edge 3    │ verifySecretToken('', '')                                    │ both empty strings                             │ true     │
 * │ Edge 4    │ verifySecretToken(Buffer.from('token-xyz'), 'token-xyz')     │ Buffer vs string with identical UTF-8 content  │ true     │
 * │ Edge 5    │ verifySecretToken('token-abc-1', 'token-abc-2')              │ differs by only last character                 │ false    │
 * │ Error 1   │ verifySecretToken(null, 'secret')                            │ providedToken: null                            │ TypeError: "Provided token must be a string or Buffer" │
 * │ Error 2   │ verifySecretToken(12345, 'secret')                           │ providedToken: 12345                           │ TypeError: "Provided token must be a string or Buffer" │
 * │ Error 3   │ verifySecretToken('secret', null)                            │ expectedToken: null                            │ TypeError: "Expected token must be a string or Buffer" │
 * │ Error 4   │ verifySecretToken('secret', {})                              │ expectedToken: {}                              │ TypeError: "Expected token must be a string or Buffer" │
 * └───────────┴──────────────────────────────────────────────────────────────┴────────────────────────────────────────────────┴──────────┘
 */

// Helper validasi token: menerima string atau Buffer (termasuk panjang 0 / kosong)
const isToken = (v) => typeof v === 'string' || Buffer.isBuffer(v);

/**
 * Safely verifies two secret tokens in constant time using SHA-256 length normalization.
 *
 * @param {string | Buffer} providedToken
 * @param {string | Buffer} expectedToken
 * @returns {boolean}
 */
export function verifySecretToken(providedToken, expectedToken) {
  // 1. Validasi defensif kedua parameter token
  if (!isToken(providedToken)) {
    throw new TypeError('Provided token must be a string or Buffer');
  }

  if (!isToken(expectedToken)) {
    throw new TypeError('Expected token must be a string or Buffer');
  }

  // 2. Normalisasi panjang via SHA-256 agar kedua digest selalu berukuran tepat 32 byte
  //    Note: mencegah ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH sekaligus menyembunyikan panjang asli token
  const digestProvided = crypto
    .createHash('sha256')
    .update(providedToken)
    .digest();
  const digestExpected = crypto
    .createHash('sha256')
    .update(expectedToken)
    .digest();

  // 3. Normal: bandingkan kedua digest secara constant-time untuk mencegah timing attack
  return crypto.timingSafeEqual(digestProvided, digestExpected);
}
