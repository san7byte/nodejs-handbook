import crypto from 'node:crypto';

/**
 * ============================================================================
 * SOAL 03: Authenticated Envelope Vault (AES-256-GCM AEAD)
 * ============================================================================
 *
 * a. Deskripsi Soal:
 *    Buat class `EnvelopeVault` yang mengimplementasikan mekanisme enkripsi dan
 *    dekripsi simetris terotentikasi (Authenticated Encryption with Associated Data /
 *    AEAD) menggunakan algoritma 'aes-256-gcm'. Class ini mengelola vektor inisialisasi
 *    (IV) acak unik untuk setiap enkripsi, mengikat data otentikasi tambahan (AAD),
 *    serta memvalidasi keaslian authentication tag secara ketat saat dekripsi.
 *
 *    Fitur / API Resmi yang Wajib Digunakan:
 *    - `node:crypto`: `crypto.createCipheriv`, `crypto.createDecipheriv`, `crypto.randomBytes`.
 *    - `node:buffer`: `Buffer`.
 *
 *    Ketentuan Validasi Input, Edge Cases, dan Defensive Coding:
 *    1. Constructor `new EnvelopeVault(secretKey)`:
 *       - Parameter `secretKey`: Wajib bertipe Buffer berukuran tepat 32 byte
 *         ATAU string heksadesimal valid sepanjang tepat 64 karakter.
 *       - Jika `secretKey` tidak memenuhi kriteria tersebut (misal null, undefined,
 *         tipe selain Buffer/string, panjang Buffer bukan 32 byte, atau string
 *         bukan 64 karakter hex valid), lempar `TypeError` dengan pesan persis:
 *         "Key must be a 32-byte Buffer or 64-character hex string"
 *    2. Method `encrypt(plaintext, associatedData = '')`:
 *       - Parameter `plaintext`: Wajib bertipe string non-empty atau Buffer non-empty.
 *         Jika null, undefined, tipe data lain, atau berukuran 0 (empty string/Buffer),
 *         lempar `TypeError` dengan pesan persis:
 *         "Plaintext must be a non-empty string or Buffer"
 *       - Parameter `associatedData`: Opsional (default string kosong "").
 *         Jika bernilai selain undefined, null, string, atau Buffer, lempar
 *         `TypeError` dengan pesan persis:
 *         "Associated data must be a string or Buffer"
 *       - Hasilkan IV acak berukuran 12 byte (96-bit CSPRNG) via `crypto.randomBytes(12)`.
 *       - Inisialisasi cipher 'aes-256-gcm'. Jika `associatedData` ada dan tidak kosong,
 *         sematkan via `cipher.setAAD()`.
 *       - Ambil authentication tag 16 byte via `cipher.getAuthTag()`.
 *       - Mengembalikan plain object:
 *         `{ ciphertext: string (hex), iv: string (hex 24 chars), authTag: string (hex 32 chars) }`
 *    3. Method `decrypt(envelope, associatedData = '')`:
 *       - Parameter `envelope`: Wajib berupa plain object (bukan null, bukan array).
 *         Jika null, undefined, atau bukan object, lempar `TypeError` dengan pesan persis:
 *         "Envelope must be an object"
 *       - Validasi struktur `envelope`: Wajib memuat properti `ciphertext`, `iv`,
 *         dan `authTag` yang semuanya bertipe string heksadesimal valid. Jika ada
 *         properti hilang atau bukan hex string, lempar `TypeError` dengan pesan persis:
 *         "Invalid envelope format"
 *       - Validasi panjang parameter: `iv` wajib tepat 24 karakter hex (12 byte),
 *         dan `authTag` wajib tepat 32 karakter hex (16 byte). Jika panjang salah,
 *         lempar `TypeError` dengan pesan persis:
 *         "Invalid envelope parameters length"
 *       - Parameter `associatedData`: Opsional (default string kosong "").
 *         Jika bernilai selain undefined, null, string, atau Buffer, lempar
 *         `TypeError` dengan pesan persis:
 *         "Associated data must be a string or Buffer"
 *       - Inisialisasi decipher 'aes-256-gcm' dengan opsi `authTagLength: 16`.
 *       - Sematkan auth tag via `decipher.setAuthTag()` dan AAD via `decipher.setAAD()`.
 *       - Jika proses autentikasi gagal (misalnya ciphertext diubah, auth tag salah,
 *         atau AAD tidak cocok), tangkap error decipher OpenSSL dan lempar `Error`
 *         dengan pesan persis:
 *         "Authentication failed: data has been tampered with or corrupted"
 *       - Mengembalikan string plaintext dalam format encoding 'utf8'.
 *
 * b. Tabel Spesifikasi I/O:
 * ┌───────────┬───────────────────────────────────────────────────────────────┬───────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────┐
 * │ Skenario  │ Pemanggilan                                                   │ Input                                         │ Expected                                                         │
 * ├───────────┼───────────────────────────────────────────────────────────────┼───────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────┤
 * │ Normal 1  │ vault.encrypt('secret-data') -> decrypt(env)                  │ plaintext string                              │ decrypted === 'secret-data'                                      │
 * │ Normal 2  │ vault.encrypt(Buffer.from('bin')) -> decrypt(env)             │ plaintext Buffer                              │ decrypted === 'bin'                                              │
 * │ Normal 3  │ vault.encrypt('data', 'aad-meta') -> decrypt(env, 'aad-meta') │ plaintext with AAD                            │ decrypted === 'data'                                             │
 * │ Normal 4  │ new EnvelopeVault(valid64HexKey)                              │ 64-char hex key string                        │ instance valid, can encrypt & decrypt successfully               │
 * │ Edge 1    │ vault.decrypt({ ...env, ciphertext: tamperedHex })            │ tampered ciphertext hex                       │ Error: "Authentication failed: data has been tampered with or..."│
 * │ Edge 2    │ vault.decrypt({ ...env, authTag: wrongTagHex })               │ tampered auth tag hex                         │ Error: "Authentication failed: data has been tampered with or..."│
 * │ Edge 3    │ vault.decrypt(env, 'wrong-aad')                               │ mismatched AAD                                │ Error: "Authentication failed: data has been tampered with or..."│
 * │ Error 1   │ new EnvelopeVault('too-short-key')                            │ invalid/short key string                      │ TypeError: "Key must be a 32-byte Buffer or 64-character hex..." │
 * │ Error 2   │ new EnvelopeVault(Buffer.alloc(16))                          │ 16-byte Buffer key                            │ TypeError: "Key must be a 32-byte Buffer or 64-character hex..." │
 * │ Error 3   │ vault.encrypt('')                                             │ empty string plaintext                        │ TypeError: "Plaintext must be a non-empty string or Buffer"     │
 * │ Error 4   │ vault.encrypt(12345)                                          │ number plaintext                              │ TypeError: "Plaintext must be a non-empty string or Buffer"     │
 * │ Error 5   │ vault.encrypt('data', 999)                                    │ associatedData number                         │ TypeError: "Associated data must be a string or Buffer"          │
 * │ Error 6   │ vault.decrypt(null)                                           │ envelope: null                                │ TypeError: "Envelope must be an object"                          │
 * │ Error 7   │ vault.decrypt({ ciphertext: 'aa', iv: 'bb' })                 │ missing authTag property                      │ TypeError: "Invalid envelope format"                             │
 * │ Error 8   │ vault.decrypt({ ciphertext: 'aa', iv: 'bb', authTag: 'cc' })  │ iv and authTag wrong lengths                  │ TypeError: "Invalid envelope parameters length"                  │
 * │ Error 9   │ vault.decrypt(env, 12345)                                     │ associatedData number                         │ TypeError: "Associated data must be a string or Buffer"          │
 * └───────────┴───────────────────────────────────────────────────────────────┴───────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────┘
 */

// Helper validasi plaintext: wajib string atau Buffer tidak kosong
const isPlaintext = (v) =>
  (typeof v === 'string' && v.length > 0) ||
  (Buffer.isBuffer(v) && v.length > 0);

// Helper validasi envelope: wajib plain object (bukan null dan bukan array)
const isEnvelope = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

// Helper validasi format hex: string berkarakter hex valid dengan panjang genap (1 byte = 2 hex)
const isHex = (v) =>
  typeof v === 'string' && v.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(v);

// Helper validasi AAD: opsional (undefined/null diizinkan), selain itu wajib string atau Buffer
const isAssociatedData = (v) =>
  v === undefined || v === null || typeof v === 'string' || Buffer.isBuffer(v);

export class EnvelopeVault {
  // Private field untuk mengisolasi kunci simetris agar tidak terekspos dari luar instance
  #secretKey;

  /**
   * Initializes vault with a 256-bit symmetric key.
   *
   * @param {Buffer | string} secretKey
   */
  constructor(secretKey) {
    // 1. Validasi kunci: wajib Buffer 32 byte (256-bit) atau string hex 64 karakter
    const isKey = (v) =>
      (Buffer.isBuffer(v) && v.length === 32) ||
      (typeof v === 'string' && /^[0-9a-fA-F]{64}$/.test(v));

    if (!isKey(secretKey)) {
      throw new TypeError(
        'Key must be a 32-byte Buffer or 64-character hex string',
      );
    }

    // 2. Normalisasi kunci ke bentuk Buffer 32 byte satu kali saat inisialisasi
    this.#secretKey = Buffer.isBuffer(secretKey)
      ? secretKey
      : Buffer.from(secretKey, 'hex');
  }

  /**
   * Encrypts plaintext using AES-256-GCM with a unique 12-byte IV.
   *
   * @param {string | Buffer} plaintext
   * @param {string | Buffer} [associatedData='']
   * @returns {{ ciphertext: string, iv: string, authTag: string }}
   */
  encrypt(plaintext, associatedData = '') {
    // 1. Validasi defensif plaintext dan associatedData
    if (!isPlaintext(plaintext)) {
      throw new TypeError('Plaintext must be a non-empty string or Buffer');
    }

    if (!isAssociatedData(associatedData)) {
      throw new TypeError('Associated data must be a string or Buffer');
    }

    // 2. Normal: bangkitkan IV 12 byte unik (CSPRNG) per operasi enkripsi GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.#secretKey, iv);

    // 3. Jika AAD disediakan dan tidak kosong, sematkan sebelum cipher.update()
    if (associatedData && associatedData.length > 0) {
      cipher.setAAD(Buffer.from(associatedData, 'utf8'));
    }

    // 4. Enkripsi payload sebagai Buffer agar aman untuk data biner maupun UTF-8 multi-byte
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    // 5. Ambil authentication tag 16 byte setelah finalisasi cipher
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypts envelope and verifies authentication tag and AAD.
   *
   * @param {{ ciphertext: string, iv: string, authTag: string }} envelope
   * @param {string | Buffer} [associatedData='']
   * @returns {string}
   */
  decrypt(envelope, associatedData = '') {
    // 1. Validasi envelope merupakan plain object
    if (!isEnvelope(envelope)) {
      throw new TypeError('Envelope must be an object');
    }

    const { ciphertext, iv, authTag } = envelope;

    // 2. Validasi seluruh field envelope ada dan berformat string hex valid
    if (!isHex(ciphertext) || !isHex(iv) || !isHex(authTag)) {
      throw new TypeError('Invalid envelope format');
    }

    // 3. Validasi panjang IV (12 byte = 24 hex) dan authTag (16 byte = 32 hex)
    if (iv.length !== 24 || authTag.length !== 32) {
      throw new TypeError('Invalid envelope parameters length');
    }

    // 4. Validasi tipe associatedData sebelum memulai dekripsi
    if (!isAssociatedData(associatedData)) {
      throw new TypeError('Associated data must be a string or Buffer');
    }

    // 5. Normal & Edge-case: verifikasi tag + AAD saat dekripsi; tangkap kegagalan otentikasi
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.#secretKey,
        Buffer.from(iv, 'hex'),
        { authTagLength: 16 },
      );

      // Pasang authTag untuk diverifikasi saat decipher.final()
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      // Pasang AAD sebelum decipher.update() agar cocok dengan proses enkripsi
      if (associatedData && associatedData.length > 0) {
        decipher.setAAD(Buffer.from(associatedData, 'utf8'));
      }

      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'hex')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new Error(
        'Authentication failed: data has been tampered with or corrupted',
      );
    }
  }
}
