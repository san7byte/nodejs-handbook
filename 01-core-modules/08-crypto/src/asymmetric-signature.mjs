import crypto from 'node:crypto';

// Normal: membuat pasangan kunci asimetris publik dan privat (RSA)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

console.log(
  'Public key generated (PEM):',
  publicKey.startsWith('-----BEGIN PUBLIC KEY-----'),
);
console.log(
  'Private key generated (PEM):',
  privateKey.startsWith('-----BEGIN PRIVATE KEY-----'),
);

// console.log({ publicKey, privateKey });

const message = 'Document approval transaction';

// Normal: membubuhkan tanda tangan digital pada payload menggunakan kunci privat
const signer = crypto.createSign('SHA256');
signer.update(message);
signer.end();
const signature = signer.sign(privateKey, 'hex');
// console.log('Signature (hex):', signature);
console.log('Signature length (hex):', signature.length);

// Normal: verifikasi keabsahan tanda tangan menggunakan kunci publik
const verifier = crypto.createVerify('SHA256');
verifier.update(message);
verifier.end();
const isValid = verifier.verify(publicKey, signature, 'hex');
console.log('Signature valid:', isValid);

// Edge-case: payload yang dimodifikasi gagal diverifikasi
const tamperedVerifier = crypto.createVerify('SHA256');
tamperedVerifier.update('Tampered document approval');
tamperedVerifier.end();
console.log(
  'Tampered message valid:',
  tamperedVerifier.verify(publicKey, signature, 'hex'),
);

// Edge-case: format tanda tangan rusak menghasilkan false tanpa menyebabkan program crash
const invalidSigVerifier = crypto.createVerify('SHA256');
invalidSigVerifier.update(message);
invalidSigVerifier.end();
console.log(
  'Corrupted signature valid:',
  invalidSigVerifier.verify(
    publicKey,
    '00'.repeat(signature.length / 2),
    'hex',
  ),
);
