import crypto from 'node:crypto';

const webhookSecret = 'whsec_99482f8a1e2b4c5d6e7f';
const payload = JSON.stringify({ event: 'payment.success', amount: 50000 });

// Normal: membuat tanda tangan otentikasi HMAC dengan kunci rahasia bersama
function signPayload(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

const signature = signPayload(webhookSecret, payload);
console.log('Signature hex length:', signature.length);

// Normal: verifikasi tanda tangan HMAC secara konstan waktu (timing-safe)
function verifyPayload(secret, data, receivedSignature) {
  const expectedSig = signPayload(secret, data);
  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const receivedBuf = Buffer.from(receivedSignature, 'hex');

  // Edge-case: cegah eksekusi timingSafeEqual jika panjang buffer berbeda
  if (expectedBuf.length !== receivedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

console.log(
  'Valid signature verified:',
  verifyPayload(webhookSecret, payload, signature),
);

// Edge-case: deteksi manipulasi data (tampering) pada payload
const tamperedPayload = JSON.stringify({
  event: 'payment.success',
  amount: 999999,
});
console.log(
  'Tampered payload verified:',
  verifyPayload(webhookSecret, tamperedPayload, signature),
);

// Edge-case: penanganan format tanda tangan tidak valid atau rusak
console.log(
  'Invalid signature format handled:',
  verifyPayload(webhookSecret, payload, 'invalidhex'),
);
