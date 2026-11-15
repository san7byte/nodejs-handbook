import { Transform } from 'node:stream';

/**
 * SOAL 02: Streaming Data Masking & PII Sanitizer Transform Stream
 *
 * Deskripsi:
 * Buat fungsi factory `createMaskingTransform` yang mengembalikan instance `Transform`
 * stream. Stream ini bertugas menyamarkan (masking) kata-kata sensitif (misalnya token,
 * password, data kredensial) pada potongan chunk data yang mengalir secara bertahap
 * tanpa memuat seluruh berkas atau payload ke dalam memori.
 *
 * API resmi yang wajib digunakan:
 * - `Transform` dari `node:stream`
 * - `Buffer.isBuffer(obj)`
 * - `Buffer.from(data, encoding)`
 *
 * Ketentuan Validasi Input & Defensive Coding:
 * 1. Parameter `options`: Wajib berupa object murni (bukan null, bukan array, bukan primitif).
 *    Jika tidak valid, lempar `TypeError` dengan pesan persis:
 *    "Options must be a valid object"
 * 2. Properti `options.maskWords`: Wajib berupa array of non-empty string dan memiliki minimal 1 kata.
 *    - Jika bukan array atau array kosong, lempar `TypeError` dengan pesan persis:
 *      "maskWords must be a non-empty array of strings"
 *    - Jika ada elemen yang bukan string atau berupa string kosong / hanya spasi, lempar `TypeError` dengan pesan persis:
 *      "Each mask word must be a non-empty string"
 * 3. Properti `options.maskChar`: Karakter masker, opsional string dengan nilai default `'*'`.
 *    - Jika dioper namun bukan string atau panjang karakternya bukan tepat 1, lempar `RangeError` dengan pesan persis:
 *      "maskChar must be a single character"
 * 4. Perilaku Transformasi Stream:
 *    - Mendukung chunk masukan bertipe `string` maupun `Buffer`.
 *    - Pencarian seluruh kata dalam `maskWords` bersifat case-insensitive (huruf besar/kecil dianggap sama).
 *    - Setiap kemunculan kata digantikan dengan `maskChar` yang diulang sebanyak panjang kata yang dicocokkan.
 *    - Kata dalam `maskWords` yang mengandung simbol khusus RegExp (seperti `$`, `.`, `*`, `+`, `?`)
 *      wajib di-escape secara defensif sehingga tidak merusak ekspresi reguler atau memicu crash.
 *    - Chunk yang telah dimasking dipancarkan ke downstream consumer via `this.push()` atau callback transform.
 *
 * Tabel Spesifikasi I/O:
 * +----+---------------------------------------------------------------+-------------------------------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 * | No | Skenario                                                      | Pemanggilan                                                       | Input                                 | Expected                                                                                                                                                                                          |
 * +----+---------------------------------------------------------------+-------------------------------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 * | 1  | Normal 1: Masking kata sensitif tunggal pada stream chunk teks| createMaskingTransform({ maskWords: ['secret'] })                 | write: 'This is a secret key\n'       | read: 'This is a ****** key\n'                                                                                                                                                                    |
 * | 2  | Normal 2: Masking banyak kata sensitif case-insensitivity     | createMaskingTransform({ maskWords: ['token', 'password'] })      | write: 'TOKEN: 123, Password: abc'    | read: '*****: 123, ********: abc'                                                                                                                                                                 |
 * | 3  | Normal 3: Masking dengan kustomisasi maskChar karakter pagar  | createMaskingTransform({ maskWords: ['pin'], maskChar: '#' })     | write: 'User pin is 9999'             | read: 'User ### is 9999'                                                                                                                                                                          |
 * | 4  | Normal 4: Menerima masukan chunk bertipe Buffer biner mentah  | createMaskingTransform({ maskWords: ['auth'] })                   | write: Buffer.from('Bearer auth-xyz') | read: 'Bearer ****-xyz'                                                                                                                                                                           |
 * | 5  | Edge 1: Kata sensitif mengandung karakter khusus regex aman   | createMaskingTransform({ maskWords: ['api.key', '$secret'] })     | write: 'Check api.key and $secret now'| read: 'Check ******* and ******* now'                                                                                                                                                             |
 * | 6  | Edge 2: Chunk tanpa kata sensitif diteruskan tanpa modifikasi | createMaskingTransform({ maskWords: ['admin'] })                  | write: 'Public user report'           | read: 'Public user report'                                                                                                                                                                        |
 * | 7  | Edge 3: Chunk string kosong diteruskan secara aman            | createMaskingTransform({ maskWords: ['secret'] })                 | write: ''                             | read: ''                                                                                                                                                                                          |
 * | 8  | Error 1: Options bernilai null melempar TypeError             | createMaskingTransform(null)                                      | null                                  | TypeError: "Options must be a valid object"                                                                                                                                                       |
 * | 9  | Error 2: maskWords berupa array kosong melempar TypeError     | createMaskingTransform({ maskWords: [] })                         | { maskWords: [] }                     | TypeError: "maskWords must be a non-empty array of strings"                                                                                                                                       |
 * | 10 | Error 3: Elemen maskWords bukan string melempar TypeError     | createMaskingTransform({ maskWords: ['valid', 123] })             | { maskWords: ['valid', 123] }         | TypeError: "Each mask word must be a non-empty string"                                                                                                                                            |
 * | 11 | Error 4: maskChar berupa string multi-karakter melempar Range | createMaskingTransform({ maskWords: ['x'], maskChar: '**' })      | { maskWords: ['x'], maskChar: '**' }  | RangeError: "maskChar must be a single character"                                                                                                                                                 |
 * +----+---------------------------------------------------------------+-------------------------------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 */

/**
 * Membuat instance Transform stream untuk menyamarkan kata-kata sensitif pada data stream.
 * @param {object} options
 * @returns {import('node:stream').Transform}
 */
export function createMaskingTransform(options) {
  // 1. Validasi options: wajib berupa object murni (bukan null, bukan primitif)
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('Options must be a valid object');
  }

  const { maskWords, maskChar = '*' } = options;

  // 2. Validasi maskWords: wajib berupa array dan tidak boleh kosong
  if (!Array.isArray(maskWords) || maskWords.length === 0) {
    throw new TypeError('maskWords must be a non-empty array of strings');
  }

  // 3. Validasi elemen maskWords: setiap elemen wajib berupa string non-kosong
  if (maskWords.some((word) => typeof word !== 'string' || word.trim().length === 0)) {
    throw new TypeError('Each mask word must be a non-empty string');
  }

  // 4. Validasi maskChar: jika disediakan, wajib berupa string tepat 1 karakter
  if (typeof maskChar !== 'string' || maskChar.length !== 1) {
    throw new RangeError('maskChar must be a single character');
  }

  // 5. Kembalikan instance Transform stream untuk memproses potongan chunk asinkron
  return new Transform({
    transform(chunk, encoding, callback) {
      // Pastikan chunk dikonversi ke string teks UTF-8
      const text = chunk.toString('utf8');
      let result = text;

      // Iterasi setiap kata sensitif untuk dilakukan masking
      for (const word of maskWords) {
        // Escape simbol RegExp khusus ($, ., *, +, ?, dsb.) agar dianggap teks biasa
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Buat ekspresi reguler case-insensitive ('i') dan global ('g')
        const regex = new RegExp(escapedWord, 'gi');
        // Gantikan seluruh kemunculan kata dengan maskChar sepanjang kata asli
        result = result.replace(regex, maskChar.repeat(word.length));
      }

      // Teruskan data hasil transformasi ke downstream consumer via callback
      callback(null, result);
    },
  });
}
