import crypto from 'node:crypto';

// Normal: menghasilkan 16 byte acak berderajat kriptografi (CSPRNG)
const tokenBytes = crypto.randomBytes(16);
console.log('Random bytes length:', tokenBytes.length);
console.log('Random hex string length:', tokenBytes.toString('hex').length);

// Normal: menghasilkan UUID v4 standar RFC 4122 yang aman secara kriptografis
const uuid = crypto.randomUUID();
console.log(
  'UUID format valid:',
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid,
  ),
);

// Normal: menghasilkan bilangan bulat acak aman dalam rentang [min, max) tanpa bias modulo
const securePin = crypto.randomInt(1000, 10000);
console.log(
  'Secure PIN range valid (1000-9999):',
  securePin >= 1000 && securePin < 10000,
);

// Edge-case: menangani rentang batas tidak valid di mana min >= max
try {
  crypto.randomInt(10, 5);
} catch (err) {
  console.log('Invalid range error:', err.name, err.code);
}

// Edge-case: menangani ukuran byte bernilai negatif
try {
  crypto.randomBytes(-1);
} catch (err) {
  console.log('Invalid bytes size error:', err.name, err.code);
}

console.log({ tokenBytes: tokenBytes.toString('base64'), uuid, securePin });
