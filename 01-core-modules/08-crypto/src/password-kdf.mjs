import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

// Normal: fungsi hashing password asinkron dengan scrypt dan salt unik
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  // Parameter biaya: N (CPU/memory cost), r (block size), p (parallelization)
  const key = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

// Normal: verifikasi sinkron menggunakan scryptSync dan perbandingan timing-safe
function verifyPasswordSync(password, storedRecord) {
  const parts = storedRecord.split(':');
  if (parts.length !== 2) return false;

  const [saltHex, keyHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expectedKey = Buffer.from(keyHex, 'hex');

  const derivedKey = crypto.scryptSync(password, salt, expectedKey.length, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return crypto.timingSafeEqual(expectedKey, derivedKey);
}

const record = await hashPassword('SuperSecretPassword!2026');
console.log(
  'Record format valid:',
  record.includes(':') && record.split(':')[0].length === 32,
);

console.log(
  'Verify correct password:',
  verifyPasswordSync('SuperSecretPassword!2026', record),
);
console.log(
  'Verify wrong password:',
  verifyPasswordSync('WrongPassword', record),
);

// Edge-case: penanganan record password berformat rusak
console.log(
  'Malformed record handled:',
  verifyPasswordSync('SuperSecretPassword!2026', 'malformed-string'),
);

// Edge-case: parameter scrypt tidak valid melempar error
try {
  crypto.scryptSync('pass', 'salt', 32, { N: 1 }); // Nilai N wajib berupa eksponen 2 > 1
} catch (err) {
  console.log('Invalid scrypt cost parameter:', err.name, err.code);
}
