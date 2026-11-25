import crypto from 'node:crypto';

// Normal: membuat kalkulasi digest hash SHA-256 satu arah
const hashA = crypto
  .createHash('sha256')
  .update('secret-payload-data')
  .digest();
const hashB = crypto
  .createHash('sha256')
  .update('secret-payload-data')
  .digest();
const hashC = crypto.createHash('sha256').update('different-payload').digest();

console.log('Hash digest length (bytes):', hashA.length);
console.log('Hashes match:', crypto.timingSafeEqual(hashA, hashB));
console.log('Hashes differ:', crypto.timingSafeEqual(hashA, hashC));

// Edge-case: timingSafeEqual melempar error jika membandingkan Buffer berbeda panjang
const shortBuf = Buffer.from('abc');
const longBuf = Buffer.from('abcdef');
try {
  crypto.timingSafeEqual(shortBuf, longBuf);
} catch (err) {
  console.log('Unequal length error:', err.name, err.code);
}

// Edge-case: pembandingan defensif dengan menormalkan panjang melalui hashing SHA-256
function safeCompare(inputA, inputB) {
  const digestA = crypto.createHash('sha256').update(inputA).digest();
  const digestB = crypto.createHash('sha256').update(inputB).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}
console.log(
  'Defensive compare different lengths:',
  safeCompare('abc', 'abcdef'),
);
console.log('Defensive compare identical:', safeCompare('secret', 'secret'));
const a = crypto.createHash('sha256').update('Test').digest('hex');
const b = crypto.createHash('sha256').update('Test').update('Test 2').digest();
