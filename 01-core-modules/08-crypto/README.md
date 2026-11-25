# Crypto

> Mengamankan data aplikasi dengan pembentukan hash satu arah, kode otentikasi HMAC, derivasi kunci password aman (`scrypt`), enkripsi simetris terotentikasi (AES-GCM), dan tanda tangan digital menggunakan modul bawaan `node:crypto`.

## Kenapa Perlu?

Aplikasi backend modern mengelola informasi sensitif seperti kredensial pengguna, token akses, transaksi finansial, dan data rahasia antar-layanan. Mengandalkan metode enkripsi manual atau algoritma usang membuka celah keamanan kritis seperti eksfiltrasi password melalui GPU cracking, timing attack pada perbandingan token rahasia, serta manipulasi payload melalui serangan padding oracle. Modul bawaan `node:crypto` menyediakan antarmuka kriptografi berstandar industri dengan akselerasi OpenSSL native untuk menjamin kerahasiaan (*confidentiality*), integritas (*integrity*), dan keabsahan (*authenticity*) data secara performan.

## Konsep Inti

- Gunakan pembangkit angka acak berderajat kriptografi (*CSPRNG*) seperti `crypto.randomBytes()`, `crypto.randomUUID()`, dan `crypto.randomInt()` alih-alih `Math.random()`.
- Gunakan `crypto.timingSafeEqual()` untuk membandingkan token atau digest rahasia guna mencegah kebocoran informasi melalui durasi pemrosesan (*timing attack*).
- Jangan gunakan hash cepat (MD5/SHA-256) untuk menyimpan kata sandi; gunakan *Key Derivation Function* (KDF) lambat dan tahan akselerasi hardware seperti `crypto.scrypt`.
- Untuk kerahasiaan data simetris, gunakan mode enkripsi terotentikasi (*Authenticated Encryption with Associated Data* / AEAD) seperti `aes-256-gcm` yang menghasilkan *authentication tag* untuk mencegah manipulasi data (*tampering*).
- Pastikan *Initialization Vector* (IV) selalu unik dan dihasilkan secara acak untuk setiap operasi enkripsi simetris, serta tidak pernah digunakan ulang dengan kunci yang sama.
- Gunakan kriptografi asimetris dengan pasangan kunci publik-privat (`crypto.generateKeyPairSync`, `crypto.createSign`, `crypto.createVerify`) untuk verifikasi identitas pengirim dan integritas dokumen tanpa membagikan kunci privat.

## Langkah 1: Menghasilkan Entropi dan Data Acak Kriptografis

Kita membangkitkan byte acak berderajat kriptografi (*CSPRNG*), UUID v4 standar RFC 4122, dan bilangan bulat acak bebas bias modulo, serta menangani batasan nilai input secara defensif.

Buat file `random-entropy.mjs`.

```js
import crypto from 'node:crypto';

// Normal: generate 16 cryptographically strong random bytes (CSPRNG)
const tokenBytes = crypto.randomBytes(16);
console.log('Random bytes length:', tokenBytes.length);
console.log('Random hex string length:', tokenBytes.toString('hex').length);

// Normal: generate cryptographically secure RFC 4122 v4 UUID
const uuid = crypto.randomUUID();
console.log('UUID format valid:', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid));

// Normal: generate secure random integer within [min, max) without modulo bias
const securePin = crypto.randomInt(1000, 10000);
console.log('Secure PIN range valid (1000-9999):', securePin >= 1000 && securePin < 10000);

// Edge-case: handle invalid range where min >= max
try {
  crypto.randomInt(10, 5);
} catch (err) {
  console.log('Invalid range error:', err.name, err.code);
}

// Edge-case: handle negative byte size input
try {
  crypto.randomBytes(-1);
} catch (err) {
  console.log('Invalid bytes size error:', err.name, err.code);
}
```

Jalankan file:

```bash
node random-entropy.mjs
```

Output:

```
Random bytes length: 16
Random hex string length: 32
UUID format valid: true
Secure PIN range valid (1000-9999): true
Invalid range error: RangeError ERR_OUT_OF_RANGE
Invalid bytes size error: RangeError ERR_OUT_OF_RANGE
```

Metode `crypto.randomBytes()` menghasilkan Buffer biner dengan entropi tinggi dari CSPRNG sistem operasi, sedangkan `crypto.randomUUID()` mencetak identifier unik versi 4 tanpa dependensi pihak ketiga. Fungsi `crypto.randomInt()` mengeliminasi risiko *modulo bias* yang sering muncul saat membatasi rentang angka acak. Kedua fungsi ini melempar `RangeError` ketika menerima argumen di luar batas yang diperbolehkan.

## Langkah 2: Menghitung Hash Integritas dan Membandingkan Digest Secara Aman

Kita menghitung intisari (*digest*) hash satu arah menggunakan algoritma SHA-256 dan membandingkannya secara aman terhadap serangan waktu (*timing attack*).

Buat file `hash-digest.mjs`.

```js
import crypto from 'node:crypto';

// Normal: calculate one-way SHA-256 hash digests
const hashA = crypto.createHash('sha256').update('secret-payload-data').digest();
const hashB = crypto.createHash('sha256').update('secret-payload-data').digest();
const hashC = crypto.createHash('sha256').update('different-payload').digest();

console.log('Hash digest length (bytes):', hashA.length);
console.log('Hashes match:', crypto.timingSafeEqual(hashA, hashB));
console.log('Hashes differ:', crypto.timingSafeEqual(hashA, hashC));

// Edge-case: timingSafeEqual throws when comparing buffers of unequal length
const shortBuf = Buffer.from('abc');
const longBuf = Buffer.from('abcdef');
try {
  crypto.timingSafeEqual(shortBuf, longBuf);
} catch (err) {
  console.log('Unequal length error:', err.name, err.code);
}

// Edge-case: defensive comparison by normalizing length through SHA-256 hashing
function safeCompare(inputA, inputB) {
  const digestA = crypto.createHash('sha256').update(inputA).digest();
  const digestB = crypto.createHash('sha256').update(inputB).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
console.log('Defensive compare different lengths:', safeCompare('abc', 'abcdef'));
console.log('Defensive compare identical:', safeCompare('secret', 'secret'));
```

Jalankan file:

```bash
node hash-digest.mjs
```

Output:

```
Hash digest length (bytes): 32
Hashes match: true
Hashes differ: false
Unequal length error: RangeError ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH
Defensive compare different lengths: false
Defensive compare identical: true
```

Fungsi `crypto.createHash('sha256')` membentuk intisari kriptografis 32 byte yang deterministik dan tidak dapat dibalik. Pembandingan rahasia wajib menggunakan `crypto.timingSafeEqual()`, yang membandingkan setiap byte dengan durasi konstan sehingga penyerang tidak dapat menebak isi token dari perbedaan waktu respon. Karena `timingSafeEqual()` menuntut panjang Buffer yang identik, hashing awal pada kedua masukan menjadi teknik defensif standar untuk menormalkan panjang byte tanpa membocorkan informasi.

## Langkah 3: Membuat dan Memverifikasi Tanda Tangan HMAC untuk Integritas Pesan

Kita menerapkan mekanisme otentikasi payload webhook berbasis Hash-based Message Authentication Code (HMAC) menggunakan kunci rahasia bersama (*shared secret*).

Buat file `hmac-auth.mjs`.

```js
import crypto from 'node:crypto';

const webhookSecret = 'whsec_99482f8a1e2b4c5d6e7f';
const payload = JSON.stringify({ event: 'payment.success', amount: 50000 });

// Normal: generate HMAC signature using shared secret
function signPayload(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

const signature = signPayload(webhookSecret, payload);
console.log('Signature hex length:', signature.length);

// Normal: verify HMAC signature in constant time
function verifyPayload(secret, data, receivedSignature) {
  const expectedSig = signPayload(secret, data);
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const receivedBuf = Buffer.from(receivedSignature, 'hex');

  // Edge-case: prevent timingSafeEqual execution if buffer lengths differ
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

console.log('Valid signature verified:', verifyPayload(webhookSecret, payload, signature));

// Edge-case: detect tampering in payload content
const tamperedPayload = JSON.stringify({ event: 'payment.success', amount: 999999 });
console.log('Tampered payload verified:', verifyPayload(webhookSecret, tamperedPayload, signature));

// Edge-case: handle corrupted or invalid signature format
console.log('Invalid signature format handled:', verifyPayload(webhookSecret, payload, 'invalidhex'));
```

Jalankan file:

```bash
node hmac-auth.mjs
```

Output:

```
Signature hex length: 64
Valid signature verified: true
Tampered payload verified: false
Invalid signature format handled: false
```

Fungsi `crypto.createHmac()` menggabungkan data payload dengan kunci rahasia bersama untuk menghasilkan tanda tangan kriptografis yang membuktikan keaslian pengirim dan integritas isi pesan. Perubahan satu karakter saja pada payload menghasilkan nilai digest yang sama sekali berbeda, sehingga manipulasi data di tengah transmisi jaringan langsung terdeteksi. Pengecekan panjang buffer sebelum memanggil `crypto.timingSafeEqual()` mencegah exception fatal saat menerima tanda tangan malformed.

## Langkah 4: Mengamankan Kredensial dengan Derivasi Kunci Password (scrypt)

Kita mengamankan kata sandi pengguna menggunakan fungsi derivasi kunci lambat `crypto.scrypt` dan `crypto.scryptSync` dengan salt acak dan parameter biaya memori tinggi.

Buat file `password-kdf.mjs`.

```js
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

// Normal: asynchronous password hashing with scrypt and unique salt
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  // Cost parameters: N (CPU/memory cost), r (block size), p (parallelization)
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

// Normal: synchronous verification via scryptSync and timingSafeEqual
function verifyPasswordSync(password, storedRecord) {
  const parts = storedRecord.split(':');
  if (parts.length !== 2) return false;

  const [saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(keyHex, 'hex');

  const derivedKey = crypto.scryptSync(password, salt, expectedKey.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expectedKey, derivedKey);
}

const record = await hashPassword('SuperSecretPassword!2026');
console.log('Record format valid:', record.includes(':') && record.split(':')[0].length === 32);

console.log('Verify correct password:', verifyPasswordSync('SuperSecretPassword!2026', record));
console.log('Verify wrong password:', verifyPasswordSync('WrongPassword', record));

// Edge-case: handle malformed or corrupted password records
console.log('Malformed record handled:', verifyPasswordSync('SuperSecretPassword!2026', 'malformed-string'));

// Edge-case: invalid scrypt cost parameters throw error
try {
  crypto.scryptSync('pass', 'salt', 32, { N: 1 }); // N must be a power of 2 greater than 1
} catch (err) {
  console.log('Invalid scrypt cost parameter:', err.name, err.code);
}
```

Jalankan file:

```bash
node password-kdf.mjs
```

Output:

```
Record format valid: true
Verify correct password: true
Verify wrong password: false
Malformed record handled: false
Invalid scrypt cost parameter: RangeError ERR_CRYPTO_INVALID_SCRYPT_PARAMS
```

Algoritma `scrypt` dirancang secara *memory-hard* untuk menahan serangan brute-force berbasis GPU dan ASIC dengan mensyaratkan alokasi RAM yang besar saat komputasi. Setiap kata sandi wajib dipasangkan dengan salt unik 16 byte dari `crypto.randomBytes()` agar tabel pencarian yang telah dihitung sebelumnya (*rainbow tables*) menjadi tidak berguna. Format penyimpanan `salt:key` memungkinkan aplikasi memverifikasi password secara mandiri saat proses autentikasi login.

## Langkah 5: Enkripsi dan Dekripsi Simetris Terotentikasi (AES-256-GCM)

Kita mengenkripsi dan mendekripsi payload rahasia menggunakan mode terotentikasi AES-256-GCM dengan pengikatan Additional Authenticated Data (AAD) dan validasi authentication tag.

Buat file `symmetric-cipher.mjs`.

```js
import crypto from 'node:crypto';

const algorithm = 'aes-256-gcm';
const secretKey = crypto.randomBytes(32); // 256-bit symmetric key

// Normal: authenticated encryption (AEAD) with AES-256-GCM and AAD
function encrypt(text, aadText = '') {
  const iv = crypto.randomBytes(12); // Recommended 12 bytes for GCM
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

  if (aadText) {
    cipher.setAAD(Buffer.from(aadText, 'utf8'));
  }

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
  };
}

// Normal: authenticated decryption with auth tag verification
function decrypt(ciphertextHex, ivHex, authTagHex, aadText = '') {
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(algorithm, secretKey, iv, {
    authTagLength: 16,
  });

  decipher.setAuthTag(authTag);
  if (aadText) {
    decipher.setAAD(Buffer.from(aadText, 'utf8'));
  }

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

const originalData = 'Sensitive customer credit card info';
const aadHeader = 'user-tenant-123';
const encryptedEnvelope = encrypt(originalData, aadHeader);

console.log('Ciphertext generated:', typeof encryptedEnvelope.ciphertext === 'string');
console.log('IV hex length (12 bytes = 24 hex):', encryptedEnvelope.iv.length);
console.log('Auth tag hex length (16 bytes = 32 hex):', encryptedEnvelope.authTag.length);

const decryptedData = decrypt(
  encryptedEnvelope.ciphertext,
  encryptedEnvelope.iv,
  encryptedEnvelope.authTag,
  aadHeader
);
console.log('Decrypted matches original:', decryptedData === originalData);

// Edge-case: tampered ciphertext rejected during finalization
try {
  const tamperedCiphertext = encryptedEnvelope.ciphertext.slice(0, -2) + 'ff';
  decrypt(tamperedCiphertext, encryptedEnvelope.iv, encryptedEnvelope.authTag, aadHeader);
} catch (err) {
  console.log('Tampered ciphertext detected:', err.message);
}

// Edge-case: tampered AAD header triggers authentication failure
try {
  decrypt(encryptedEnvelope.ciphertext, encryptedEnvelope.iv, encryptedEnvelope.authTag, 'wrong-tenant');
} catch (err) {
  console.log('Tampered AAD detected:', err.message);
}
```

Jalankan file:

```bash
node symmetric-cipher.mjs
```

Output:

```
Ciphertext generated: true
IV hex length (12 bytes = 24 hex): 24
Auth tag hex length (16 bytes = 32 hex): 32
Decrypted matches original: true
Tampered ciphertext detected: Unsupported state or unable to authenticate data
Tampered AAD detected: Unsupported state or unable to authenticate data
```

Mode Galois/Counter Mode (GCM) menyediakan enkripsi terotentikasi (AEAD) yang sekaligus menjamin kerahasiaan (*confidentiality*) dan keaslian (*authenticity*) data. Metode `cipher.getAuthTag()` menghasilkan tag 16 byte yang harus diverifikasi via `decipher.setAuthTag()` sebelum `decipher.final()` dipanggil. Jika ciphertext atau metadata AAD dimanipulasi sekecil apa pun, `decipher.final()` akan langsung melempar exception dan membatalkan pembacaan data.

## Langkah 6: Membuat Kunci Asimetris dan Memverifikasi Digital Signature

Kita menghasilkan pasangan kunci kriptografi asimetris (RSA) secara sinkron, menandatangani payload dengan kunci privat, dan memverifikasi tanda tangan menggunakan kunci publik.

Buat file `asymmetric-signature.mjs`.

```js
import crypto from 'node:crypto';

// Normal: synchronously generate asymmetric RSA key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log('Public key generated (PEM):', publicKey.startsWith('-----BEGIN PUBLIC KEY-----'));
console.log('Private key generated (PEM):', privateKey.startsWith('-----BEGIN PRIVATE KEY-----'));

const message = 'Document approval transaction';

// Normal: sign payload using private key
const signer = crypto.createSign('SHA256');
signer.update(message);
signer.end();
const signature = signer.sign(privateKey, 'hex');
console.log('Signature length (hex):', signature.length);

// Normal: verify signature validity using public key
const verifier = crypto.createVerify('SHA256');
verifier.update(message);
verifier.end();
const isValid = verifier.verify(publicKey, signature, 'hex');
console.log('Signature valid:', isValid);

// Edge-case: modified payload fails signature verification
const tamperedVerifier = crypto.createVerify('SHA256');
tamperedVerifier.update('Tampered document approval');
tamperedVerifier.end();
console.log('Tampered message valid:', tamperedVerifier.verify(publicKey, signature, 'hex'));

// Edge-case: corrupted signature string returns false without crashing
const invalidSigVerifier = crypto.createVerify('SHA256');
invalidSigVerifier.update(message);
invalidSigVerifier.end();
console.log('Corrupted signature valid:', invalidSigVerifier.verify(publicKey, '00'.repeat(signature.length / 2), 'hex'));
```

Jalankan file:

```bash
node asymmetric-signature.mjs
```

Output:

```
Public key generated (PEM): true
Private key generated (PEM): true
Signature length (hex): 512
Signature valid: true
Tampered message valid: false
Corrupted signature valid: false
```

Metode `crypto.generateKeyPairSync()` menghasilkan pasangan kunci asimetris yang diformat sesuai standar industri PKCS#8 (privat) dan SPKI (publik). Instance `crypto.createSign()` mengkalkulasi digest dan membubuhkan tanda tangan digital matematis dengan kunci privat, sementara pihak penerima cukup menggunakan `crypto.createVerify()` dengan kunci publik untuk memvalidasi keaslian dokumen tanpa perlu memiliki akses ke kunci privat pengirim.

## Referensi API

Berikut ringkasan API inti pada modul `node:crypto` yang dipraktikkan:

| API | Fungsi |
|---|---|
| `crypto.randomBytes(size, callback?)` | Menghasilkan buffer acak berderajat kriptografi (*CSPRNG*). `size` (number, wajib) adalah jumlah byte acak yang diminta (maksimal 2^31 - 1). `callback` (fungsi, opsional) menerima `(err, buf)`. Returns `Buffer` (jika dipanggil sinkron). |
| `crypto.randomUUID(options?)` | Menghasilkan UUID acak versi 4 standar RFC 4122. `options` (object, opsional) menerima `disableEntropyCache` (boolean, opsional, default `false`). Returns `string`. |
| `crypto.randomInt([min,] max, callback?)` | Menghasilkan bilangan bulat acak tanpa bias modulo dalam rentang `min <= n < max`. `min` (integer, opsional, default `0`), `max` (integer, wajib). `callback` (fungsi, opsional) menerima `(err, n)`. Returns `number`. |
| `crypto.createHash(algorithm, options?)` | Membuat instance kalkulasi hash satu arah. `algorithm` (string, wajib) nama cipher hash (misal `'sha256'`). `options` (object, opsional) opsi transform stream. Returns `Hash`. |
| `crypto.timingSafeEqual(a, b)` | Membandingkan dua buffer dengan durasi waktu konstan untuk mencegah *timing attack*. `a` dan `b` (Buffer \| TypedArray \| DataView, wajib) harus memiliki panjang byte yang persis sama. Returns `boolean`. |
| `crypto.createHmac(algorithm, key, options?)` | Membuat instance HMAC menggunakan shared secret key. `algorithm` (string, wajib) cipher hash. `key` (string \| Buffer, wajib) kunci rahasia bersama. `options` (object, opsional). Returns `Hmac`. |
| `crypto.scrypt(password, salt, keylen, options?, callback?)` | Menghitung fungsi derivasi kunci lambat asinkron untuk hashing password. `password` (string \| Buffer, wajib), `salt` (string \| Buffer, wajib), `keylen` (number, wajib), `options` (object, opsional) memuat `{ N, r, p }`. Returns `void` (atau `Promise<Buffer>` via promisify). |
| `crypto.scryptSync(password, salt, keylen, options?)` | Menghitung fungsi derivasi kunci lambat secara sinkron. Argumen sama dengan versi asinkron tanpa callback. Returns `Buffer`. |
| `crypto.createCipheriv(algorithm, key, iv, options?)` | Membuat instance Cipher enkripsi simetris. `algorithm` (string, wajib) misal `'aes-256-gcm'`, `key` (Buffer \| string, wajib) kunci rahasia, `iv` (Buffer \| string, wajib) vektor inisialisasi, `options` (object, opsional) konfigurasi stream. Returns `Cipher`. |
| `crypto.createDecipheriv(algorithm, key, iv, options?)` | Membuat instance Decipher dekripsi simetris. Argumen identik dengan `createCipheriv`, `options` menerima `authTagLength` (number, opsional). Returns `Decipher`. |
| `crypto.generateKeyPairSync(type, options)` | Menghasilkan pasangan kunci asimetris sinkron. `type` (string, wajib) jenis kunci (misal `'rsa'`, `'ed25519'`), `options` (object, wajib) memuat `modulusLength`, `publicKeyEncoding`, dan `privateKeyEncoding`. Returns `{ publicKey, privateKey }`. |
| `crypto.createSign(algorithm, options?)` | Membuat instance pembentuk tanda tangan digital dengan kunci privat. `algorithm` (string, wajib) algoritma hash penanda tangan (misal `'SHA256'`). `options` (object, opsional). Returns `Sign`. |
| `crypto.createVerify(algorithm, options?)` | Membuat instance pemverifikasi tanda tangan digital dengan kunci publik. `algorithm` (string, wajib) algoritma hash pemverifikasi. `options` (object, opsional). Returns `Verify`. |

## Kasus di Aplikasi

**Backend**

**Masalah:** Aplikasi multi-tenant menyimpan token OAuth pihak ketiga (seperti GitHub token atau Stripe access keys) ke dalam basis data. Menyimpan token dalam bentuk teks mentah (*plain text*) sangat berisiko jika database bocor, sementara enkripsi simetris biasa tanpa otentikasi rentan terhadap *cross-tenant swap attack* (penyerang memindahkan ciphertext terenkripsi milik tenant A ke kolom tenant B untuk didekripsi).

**Solusi:** Membangun brankas kredensial `SecretVault` yang menerapkan enkripsi simetris terotentikasi AES-256-GCM dengan kunci turunan `scryptSync`, mengikat ID tenant sebagai *Additional Authenticated Data* (AAD), dan memverifikasi integritas *authentication tag* sebelum mendekripsi token.

Buat file `encrypted-payload-vault.mjs`.

```js
import crypto from 'node:crypto';

// Application Use Case: Encrypted OAuth Token Vault with Multi-Tenant Isolation
class SecretVault {
  #derivedKey;

  constructor(masterPassphrase, masterSalt) {
    // Normal: derive fixed 256-bit (32-byte) key from passphrase and salt via scrypt
    this.#derivedKey = crypto.scryptSync(masterPassphrase, masterSalt, 32, {
      N: 16384,
      r: 8,
      p: 1,
    });
  }

  // Normal: seal plaintext with AES-256-GCM and bind tenantId as AAD
  seal(plaintext, tenantId) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.#derivedKey, iv);

    // Bind tenantId as additional authenticated data (AAD)
    cipher.setAAD(Buffer.from(tenantId, 'utf8'));

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext,
      iv: iv.toString('hex'),
      authTag,
      tenantId,
    };
  }

  // Normal: unseal ciphertext and verify auth tag and tenant identity
  unseal(envelope, requestedTenantId) {
    if (envelope.tenantId !== requestedTenantId) {
      throw new Error('Tenant mismatch: token cannot be unsealed for this tenant');
    }

    const iv = Buffer.from(envelope.iv, 'hex');
    const authTag = Buffer.from(envelope.authTag, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.#derivedKey, iv, {
      authTagLength: 16,
    });

    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from(requestedTenantId, 'utf8'));

    let decrypted = decipher.update(envelope.ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

const masterPass = 'Env-Master-Key-Secret-2026';
const masterSalt = 'tenant-vault-salt-987';
const vault = new SecretVault(masterPass, masterSalt);

const oauthToken = 'gho_9812471894y12784y12894719284';
const tenantId = 'org-acme-corp';

// Normal: seal and unseal valid tenant token
const sealed = vault.seal(oauthToken, tenantId);
console.log('Sealed ciphertext length:', sealed.ciphertext.length);
console.log('IV length (hex):', sealed.iv.length);
console.log('Auth tag length (hex):', sealed.authTag.length);

const unsealed = vault.unseal(sealed, tenantId);
console.log('Unsealed token matches:', unsealed === oauthToken);

// Edge-case: prevent cross-tenant token swap attacks
try {
  vault.unseal(sealed, 'org-hacker-tenant');
} catch (err) {
  console.log('Cross-tenant block:', err.message);
}

// Edge-case: detect tampering in ciphertext
try {
  const tampered = { ...sealed, ciphertext: sealed.ciphertext.slice(0, -2) + '00' };
  vault.unseal(tampered, tenantId);
} catch (err) {
  console.log('Tamper detection:', err.message);
}
```

Jalankan file:

```bash
node encrypted-payload-vault.mjs
```

Output:

```
Sealed ciphertext length: 64
IV length (hex): 24
Auth tag length (hex): 32
Unsealed token matches: true
Cross-tenant block: Tenant mismatch: token cannot be unsealed for this tenant
Tamper detection: Unsupported state or unable to authenticate data
```

## Pitfalls

- Menggunakan operator kesetaraan biasa (`===` atau `==`) untuk membandingkan token rahasia atau hash digest. Operator tersebut melakukan pemutusan awal (*early return*) saat menemukan karakter pertama yang berbeda, sehingga membocorkan durasi perbandingan yang dapat dimanfaatkan penyerang untuk menebak token (*timing attack*).
  ```js
  // ❌ Incorrect: early-exit leaks byte comparison duration
  if (userToken === secretApiKey) {
    // grant access
  }

  // ✅ Correct: constant-time byte comparison prevents timing analysis
  const bufA = Buffer.from(userToken);
  const bufB = Buffer.from(secretApiKey);
  const isValid = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  ```
- Menghasilkan token keamanan, salt, atau kode reset password menggunakan `Math.random()`. `Math.random()` adalah generator angka acak semu (PRNG) yang deterministik dan mudah diprediksi nilai internal state-nya oleh penyerang.
  ```js
  // ❌ Incorrect: predictable pseudorandom number generator
  const insecureOtp = Math.floor(100000 + Math.random() * 900000);

  // ✅ Correct: cryptographically secure random values (CSPRNG)
  const secureOtp = crypto.randomInt(100000, 1000000);
  ```
- Menggunakan mode cipher tidak aman seperti Electronic Codebook (ECB) atau AES-CBC tanpa integritas (HMAC). Mode ECB memetakan blok plaintext identik ke ciphertext identik sehingga membocorkan pola data, sedangkan CBC tanpa autentikasi rentan terhadap *bit-flipping attack* dan *padding oracle*.
  ```js
  // ❌ Incorrect: vulnerable unauthenticated cipher mode
  const cipher = crypto.createCipheriv('aes-256-ecb', key, null);

  // ✅ Correct: authenticated encryption with associated data (AEAD)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  ```
- Menggunakan kembali nilai Initialization Vector (IV) yang sama untuk beberapa proses enkripsi dengan kunci simetris yang sama pada mode AES-GCM. Penggunaan ulang IV (*IV reuse*) pada mode counter menghancurkan sifat kerahasiaan ciphertext dan memungkinkan pemulihan plaintext secara matematis.
  ```js
  // ❌ Incorrect: static or hardcoded IV reused across encryption calls
  const staticIv = Buffer.alloc(12, 0);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, staticIv);

  // ✅ Correct: fresh, unique random IV generated for each encryption operation
  const uniqueIv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, uniqueIv);
  ```
- Menggunakan hash cepat seperti SHA-256 atau MD5 tanpa salt untuk menyimpan kata sandi pengguna di basis data. Hash cepat dapat dihitung miliaran kali per detik menggunakan perangkat keras GPU modern dan sangat rentan terhadap pencocokan *rainbow tables*.
  ```js
  // ❌ Incorrect: fast unsalted hash vulnerable to GPU brute-forcing
  const passwordHash = crypto.createHash('sha256').update(rawPassword).digest('hex');

  // ✅ Correct: slow, memory-hard key derivation function with random salt
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(rawPassword, salt, 64, { N: 16384, r: 8, p: 1 });
  ```

## Referensi

- [Node.js Docs: Crypto](https://nodejs.org/api/crypto.html) — dokumentasi resmi modul `node:crypto`, fungsi hash, HMAC, KDF scrypt, cipher AES-GCM, dan tanda tangan digital.
- [Node.js Docs: Buffer](https://nodejs.org/api/buffer.html) — dokumentasi resmi alokasi memori biner dan konversi encoding heksadesimal/UTF-8.
- [Node.js Docs: Util (promisify)](https://nodejs.org/api/util.html#utilpromisifyoriginal) — dokumentasi fungsi `promisify` untuk mengubah fungsi callback `crypto.scrypt` menjadi Promise.
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) — panduan keamanan standar industri OWASP mengenai penyimpanan kredensial, derivasi kunci, dan enkripsi terotentikasi.

---

Berikutnya: [09 - Zlib](../09-zlib/README.md)
