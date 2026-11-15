import { Buffer } from 'node:buffer';

/**
 * SOAL 01: Buffer Payload Packer & Multi-Encoding Converter
 *
 * Deskripsi:
 * Buat fungsi `encodeBinaryPayload` yang memvalidasi teks masukan dan sistem encoding,
 * mengonversinya ke dalam instance `Buffer` biner yang aman, menghitung ukuran byte
 * sebenarnya (bukan sekadar panjang karakter string), dan mengembalikan metadata biner
 * dalam format buffer, byteLength, hex, dan base64.
 *
 * API resmi yang wajib digunakan:
 * - `Buffer.from(data, encoding)`
 * - `Buffer.byteLength(string, encoding)`
 * - `Buffer.isBuffer(obj)`
 * - `buffer.toString(encoding)`
 *
 * Ketentuan Validasi Input & Defensive Coding:
 * 1. Parameter `text`: Wajib bertipe `string`. Jika bukan string (misal number, object,
 *    boolean, null, undefined), lempar `TypeError` dengan pesan persis:
 *    "Input text must be a string"
 * 2. Parameter `encoding`: Opsional string dengan nilai default `'utf8'`.
 *    - Jika argumen `encoding` diberikan tetapi bukan string, lempar `TypeError` dengan pesan persis:
 *      "Encoding must be a string"
 *    - Hanya mendukung 4 encoding berikut: `'utf8'`, `'hex'`, `'base64'`, `'ascii'`.
 *      Jika encoding tidak termasuk dalam daftar tersebut, lempar `RangeError` dengan pesan persis:
 *      "Unsupported encoding: <encoding>" (contoh: "Unsupported encoding: binary")
 * 3. Nilai Kembalian: Object dengan 4 properti:
 *    - `buffer`: instance Buffer hasil konversi.
 *    - `byteLength`: integer, ukuran byte biner aktual dari teks dan encoding tersebut.
 *    - `hex`: string representasi heksadesimal dari buffer.
 *    - `base64`: string representasi Base64 dari buffer.
 *
 * Tabel Spesifikasi I/O:
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 * | No | Skenario                                                      | Pemanggilan                               | Input                                 | Expected                                                                                                                                                                                          |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 * | 1  | Normal 1: Encode string ASCII standar dengan default UTF-8    | encodeBinaryPayload('hello')              | 'hello'                               | { byteLength: 5, hex: '68656c6c6f', base64: 'aGVsbG8=', buffer: <Buffer 68 65 6c 6c 6f> }                                                                                                        |
 * | 2  | Normal 2: Encode string multi-byte UTF-8 (karakter khusus)    | encodeBinaryPayload('Kopi ☕', 'utf8')    | 'Kopi ☕', 'utf8'                     | { byteLength: 8, hex: '4b6f706920e29895', base64: 'S29waSDimJU=', buffer: <Buffer 4b 6f 70 69 20 e2 98 95> }                                                                                     |
 * | 3  | Normal 3: Decode data hex string menjadi binary buffer        | encodeBinaryPayload('4e6f6465', 'hex')    | '4e6f6465', 'hex'                     | { byteLength: 4, hex: '4e6f6465', base64: 'Tm9kZQ==', buffer: <Buffer 4e 6f 64 65> }                                                                                                              |
 * | 4  | Normal 4: Decode base64 string menjadi binary buffer          | encodeBinaryPayload('Tm9kZS5qcw==', 'base64') | 'Tm9kZS5qcw==', 'base64'          | { byteLength: 7, hex: '4e6f64652e6a73', base64: 'Tm9kZS5qcw==', buffer: <Buffer 4e 6f 64 65 2e 6a 73> }                                                                                         |
 * | 5  | Edge 1: Input string kosong menghasilkan 0-byte buffer        | encodeBinaryPayload('')                   | ''                                    | { byteLength: 0, hex: '', base64: '', buffer: <Buffer > }                                                                                                                                        |
 * | 6  | Edge 2: Input encoding ASCII valid                            | encodeBinaryPayload('test', 'ascii')      | 'test', 'ascii'                       | { byteLength: 4, hex: '74657374', base64: 'dGVzdA==', buffer: <Buffer 74 65 73 74> }                                                                                                             |
 * | 7  | Error 1: Input text bertipe number melempar TypeError         | encodeBinaryPayload(12345)                | 12345                                 | TypeError: "Input text must be a string"                                                                                                                                                          |
 * | 8  | Error 2: Input text bernilai null melempar TypeError          | encodeBinaryPayload(null)                 | null                                  | TypeError: "Input text must be a string"                                                                                                                                                          |
 * | 9  | Error 3: Input encoding bukan string melempar TypeError       | encodeBinaryPayload('hello', 123)         | 'hello', 123                          | TypeError: "Encoding must be a string"                                                                                                                                                            |
 * | 10 | Error 4: Input encoding tidak didukung melempar RangeError    | encodeBinaryPayload('hello', 'binary')    | 'hello', 'binary'                     | RangeError: "Unsupported encoding: binary"                                                                                                                                                        |
 * +----+---------------------------------------------------------------+-------------------------------------------+---------------------------------------+---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
 */

// Set daftar encoding yang didukung oleh fungsi ini
const SUPPORTED_ENCODINGS = new Set(['utf8', 'hex', 'base64', 'ascii']);

/**
 * Mengonversi string ke Buffer biner dan menghasilkan representasi multi-format.
 * @param {string} text
 * @param {string} [encoding='utf8']
 * @returns {{ buffer: Buffer, byteLength: number, hex: string, base64: string }}
 */
export function encodeBinaryPayload(text, encoding = 'utf8') {
  // 1. Validasi text: wajib bertipe string
  if (typeof text !== 'string') {
    throw new TypeError('Input text must be a string');
  }

  // 2. Validasi encoding: jika diberikan, wajib bertipe string
  if (typeof encoding !== 'string') {
    throw new TypeError('Encoding must be a string');
  }

  // 3. Validasi whitelist encoding yang didukung
  if (!SUPPORTED_ENCODINGS.has(encoding)) {
    throw new RangeError(`Unsupported encoding: ${encoding}`);
  }

  // 4. Alokasikan dan konversi data string masukan ke dalam instance Buffer biner mentah
  const bufText = Buffer.from(text, encoding);

  // 5. Ekspor representasi biner buffer ke format teks target (heksadesimal & Base64)
  const hex = bufText.toString('hex');
  const base64 = bufText.toString('base64');

  // 6. Hitung ukuran byte fisik sebenarnya pada memori (bukan sekadar jumlah karakter teks)
  const byteLength = Buffer.byteLength(text, encoding);

  // 7. Kembalikan objek metadata biner multi-format
  return {
    buffer: bufText,
    byteLength,
    hex,
    base64,
  };
}
