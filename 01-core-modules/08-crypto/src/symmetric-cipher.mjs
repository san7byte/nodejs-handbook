import crypto from 'node:crypto';

const algorithm = 'aes-256-gcm';
const secretKey = crypto.randomBytes(32); // Kunci 256-bit

// Normal: enkripsi simetris terotentikasi (AEAD) dengan AES-256-GCM dan AAD
function encrypt(text, aadText = '') {
  const iv = crypto.randomBytes(12); // Standar rekomendasi 12 byte untuk mode GCM
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

// Normal: dekripsi dan verifikasi keaslian ciphertext beserta auth tag
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

console.log(
  'Ciphertext generated:',
  typeof encryptedEnvelope.ciphertext === 'string',
);
console.log('IV hex length (12 bytes = 24 hex):', encryptedEnvelope.iv.length);
console.log(
  'Auth tag hex length (16 bytes = 32 hex):',
  encryptedEnvelope.authTag.length,
);

const decryptedData = decrypt(
  encryptedEnvelope.ciphertext,
  encryptedEnvelope.iv,
  encryptedEnvelope.authTag,
  aadHeader,
);
console.log('Decrypted matches original:', decryptedData === originalData);

// Edge-case: manipulasi data ciphertext ditolak saat tahap finalisasi dekripsi
try {
  const tamperedCiphertext = encryptedEnvelope.ciphertext.slice(0, -2) + 'ff';
  decrypt(
    tamperedCiphertext,
    encryptedEnvelope.iv,
    encryptedEnvelope.authTag,
    aadHeader,
  );
} catch (err) {
  console.log('Tampered ciphertext detected:', err.message);
}

// Edge-case: manipulasi header AAD menyebabkan otentikasi gagal
try {
  decrypt(
    encryptedEnvelope.ciphertext,
    encryptedEnvelope.iv,
    encryptedEnvelope.authTag,
    'wrong-tenant',
  );
} catch (err) {
  console.log('Tampered AAD detected:', err.message);
}
