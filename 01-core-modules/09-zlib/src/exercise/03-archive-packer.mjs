import zlib from 'node:zlib';

/**
 * ============================================================================
 * SOAL 03: Tamper-Evident Archive Packer with Native CRC32 Integrity
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Class `ArchivePacker` menyediakan metode statis untuk memaketkan dan membongkar
 *    payload data terkompresi dengan verifikasi integritas data bawaan menggunakan
 *    checksum CRC32 (`zlib.crc32`) dan validasi metadata paket.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:zlib`: `gzip`, `gunzip`, `brotliCompress`, `brotliDecompress`, `crc32`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. `ArchivePacker.pack(data, algorithm = 'gzip')`:
 *       - Validasi Data: Argumen `data` wajib bertipe `string` atau instance `Buffer`.
 *         Jika bukan, lempar `TypeError('Data must be a string or Buffer')`.
 *       - Validasi Data Kosong: Jika `data === ''` atau buffer berukuran 0,
 *         lempar `Error('Data cannot be empty')`.
 *       - Validasi Algoritma: Argumen `algorithm` wajib bernilai `'gzip'` atau `'brotli'`.
 *         Jika bernilai selain dua opsi tersebut, lempar `Error('Unsupported algorithm')`.
 *       - Perhitungan CRC32: Hitung nilai checksum CRC32 dari data asli (sebelum kompresi)
 *         menggunakan `zlib.crc32(data)`.
 *       - Kompresi: Kompresi data sesuai algoritma yang dipilih (`gzip` atau `brotliCompress`).
 *       - Kembalikan objek paket dengan struktur persis:
 *         `{ algorithm: 'gzip' | 'brotli', originalSize: number, compressedSize: number, crc32: number, payload: Buffer }`
 *
 *    2. `ArchivePacker.unpack(packet)`:
 *       - Validasi Objek Paket: Argumen `packet` wajib berupa objek non-null.
 *         Jika `!packet || typeof packet !== 'object'`, lempar `TypeError('Invalid packet structure')`.
 *       - Validasi Buffer Payload: Properti `packet.payload` wajib merupakan instance `Buffer`.
 *         Jika bukan, lempar `TypeError('Invalid payload Buffer')`.
 *       - Validasi Ukuran Terkompresi: Jika `packet.payload.length !== packet.compressedSize`,
 *         lempar `Error('Compressed size mismatch')`.
 *       - Validasi Algoritma: Jika `packet.algorithm !== 'gzip' && packet.algorithm !== 'brotli'`,
 *         lempar `Error('Unsupported algorithm')`.
 *       - Dekompresi: Ekstrak buffer payload sesuai algoritma (`gunzip` atau `brotliDecompress`).
 *       - Verifikasi Integritas CRC32: Hitung CRC32 dari buffer hasil dekompresi.
 *         Jika nilai CRC32 hasil dekompresi tidak sama dengan `packet.crc32`,
 *         lempar `Error('Checksum integrity check failed')`.
 *       - Verifikasi Ukuran Asli: Jika panjang byte hasil dekompresi tidak sama dengan `packet.originalSize`,
 *         lempar `Error('Original size mismatch')`.
 *       - Kembalikan buffer hasil dekompresi sebagai instance `Buffer`.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬─────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                                 │ Input                                                                  │ Expected                                                         │
 * ├───────────┼─────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ ArchivePacker.pack('Archived JSON Data', 'gzip')            │ data: 'Archived JSON Data', algorithm: 'gzip'                          │ Objek { algorithm: 'gzip', originalSize: 18, crc32, payload }   │
 * │ Normal 2  │ ArchivePacker.pack('High compression text', 'brotli')       │ data: 'High compression text', algorithm: 'brotli'                     │ Objek { algorithm: 'brotli', originalSize: 21, crc32, payload } │
 * │ Normal 3  │ ArchivePacker.unpack(validGzipPacket)                       │ valid Gzip packet hasil pack()                                         │ Buffer berisi 'Archived JSON Data'                               │
 * │ Normal 4  │ ArchivePacker.unpack(validBrotliPacket)                     │ valid Brotli packet hasil pack()                                       │ Buffer berisi 'High compression text'                            │
 * │ Edge 1    │ ArchivePacker.pack(Buffer.from([0x01, 0x02, 0x03]))         │ data: Buffer.from([0x01, 0x02, 0x03]), default algorithm 'gzip'        │ Objek paket dengan algorithm 'gzip' dan originalSize: 3          │
 * │ Error 1   │ ArchivePacker.pack(12345)                                   │ data: 12345 (number)                                                   │ Lempar TypeError('Data must be a string or Buffer')              │
 * │ Error 2   │ ArchivePacker.pack('')                                      │ data: '' (string kosong)                                               │ Lempar Error('Data cannot be empty')                             │
 * │ Error 3   │ ArchivePacker.pack('Data', 'deflate')                       │ algorithm: 'deflate'                                                   │ Lempar Error('Unsupported algorithm')                             │
 * │ Error 4   │ ArchivePacker.unpack(null)                                  │ packet: null                                                           │ Lempar TypeError('Invalid packet structure')                      │
 * │ Error 5   │ ArchivePacker.unpack({ ...validPacket, payload: 'bad' })    │ payload bukan Buffer                                                   │ Lempar TypeError('Invalid payload Buffer')                       │
 * │ Error 6   │ ArchivePacker.unpack({ ...validPacket, compressedSize: 9999})│ compressedSize tidak sesuai panjang payload                           │ Lempar Error('Compressed size mismatch')                          │
 * │ Error 7   │ ArchivePacker.unpack({ ...validPacket, algorithm: 'tar' })  │ algorithm: 'tar'                                                       │ Lempar Error('Unsupported algorithm')                             │
 * │ Error 8   │ ArchivePacker.unpack({ ...validPacket, crc32: 12345678 })   │ crc32 diubah / rusak                                                   │ Lempar Error('Checksum integrity check failed')                   │
 * │ Error 9   │ ArchivePacker.unpack({ ...validPacket, originalSize: 9999 })│ originalSize diubah / tidak cocok                                      │ Lempar Error('Original size mismatch')                           │
 * └───────────┴─────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘
 */

export class ArchivePacker {
  /**
   * Mengompresi payload data dan menyematkan metadata serta checksum CRC32.
   *
   * @param {string|Buffer} data
   * @param {'gzip'|'brotli'} [algorithm='gzip']
   * @returns {Promise<{ algorithm: string, originalSize: number, compressedSize: number, crc32: number, payload: Buffer }>}
   */
  static async pack(data, algorithm = 'gzip') {
    throw new Error('Not implemented');
  }

  /**
   * Memvalidasi metadata, mendekompresi payload, dan memverifikasi integritas checksum CRC32.
   *
   * @param {{ algorithm: string, originalSize: number, compressedSize: number, crc32: number, payload: Buffer }} packet
   * @returns {Promise<Buffer>}
   */
  static async unpack(packet) {
    throw new Error('Not implemented');
  }
}
